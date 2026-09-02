from __future__ import annotations

import logging
from datetime import datetime, time

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .events_bus import event_bus
from .models import AccessLog, Alert, Attendance, AttendanceAudit, User, Vehicle
from .notify import raise_alert


log = logging.getLogger(__name__)


def _late_after() -> time:
    try:
        from .models import SystemSetting
        val = SystemSetting.get("late_after", getattr(settings, "LATE_AFTER", "08:30"))
    except Exception:
        val = getattr(settings, "LATE_AFTER", "08:30")
    try:
        return datetime.strptime(val, "%H:%M").time()
    except (ValueError, TypeError):
        return datetime.strptime("08:30", "%H:%M").time()



@transaction.atomic
def handle_event(data: dict) -> dict:
    """Turn one recognition event into rows. This is where authorisation lives:
    the AI service reads plates, the database decides who may come in."""
    at = timezone.localtime(data["at"])
    kind = data["kind"]
    if kind == "attendance":
        res = _attendance(data, at)
    elif kind == "access":
        res = _access(data, at)
    else:
        res = _alert_only(data, kind)

    # Broadcast to connected SSE frontend clients
    event_bus.broadcast("update", {"kind": kind, "result": res, "camera_id": data.get("camera_id")})
    from .views import bump_revision
    bump_revision()
    return res




def _attendance(data: dict, at: datetime) -> dict:
    raw_subject = data["subject"]
    subject = raw_subject.removeprefix("user_")  # tolerate both id forms

    user = None
    if str(subject).isdigit():
        user = User.objects.filter(pk=int(subject)).first()
    if user is None:
        user = User.objects.filter(username__iexact=subject).first()
    if user is None:
        user = User.objects.filter(username__iexact=raw_subject).first()
    if user is None:
        if not str(subject).isdigit() and len(subject) > 0:
            user = User.objects.create(
                username=subject,
                nom=subject.capitalize(),
                prenom="",
                role=User.Role.MEMBER,
            )
            log.info("auto-created member account for enrolled subject: %s", subject)
        else:
            log.warning("attendance for unknown user %s", data["subject"])
            return {"status": "ignored", "reason": "unknown user"}



    statut = Attendance.Status.LATE if at.time() > _late_after() else Attendance.Status.PRESENT
    row, created = Attendance.objects.get_or_create(
        user=user,
        date=at.date(),
        defaults={
            "check_in": at.time(),
            "statut": statut,
            "camera_id": data["camera_id"],
            "confidence": data["confidence"],
            "snapshot": data.get("snapshot"),
        },
    )
    if created:
        AttendanceAudit.objects.create(
            attendance=row,
            user=user,
            date=at.date(),
            heure=at.time(),
            event_type=AttendanceAudit.EventType.CHECK_IN,
            camera_id=data["camera_id"],
            confidence=data["confidence"],
            snapshot=data.get("snapshot"),
        )
        return {"status": "checked_in", "attendance": row.id, "statut": row.statut}

    # Any later sighting is a departure until a further one replaces it.
    row.check_out = at.time()
    row.save(update_fields=["check_out"])

    AttendanceAudit.objects.create(
        attendance=row,
        user=user,
        date=at.date(),
        heure=at.time(),
        event_type=AttendanceAudit.EventType.DEPARTURE_UPDATE,
        camera_id=data["camera_id"],
        confidence=data["confidence"],
        snapshot=data.get("snapshot"),
    )
    return {"status": "checked_out", "attendance": row.id}



def _access(data: dict, at: datetime) -> dict:
    plaque = data["subject"]
    vehicle = Vehicle.objects.filter(plaque=plaque).first()
    authorized = bool(vehicle and vehicle.autorise)
    row = AccessLog.objects.create(
        vehicle=vehicle,
        plaque=plaque,
        date=at.date(),
        heure=at.time(),
        statut=AccessLog.Status.AUTHORIZED if authorized else AccessLog.Status.REFUSED,
        camera_id=data["camera_id"],
        confidence=data["confidence"],
        snapshot=data.get("snapshot"),
    )
    if not authorized:
        reason = "non enregistrée" if vehicle is None else "non autorisée"
        raise_alert(
            Alert.Kind.REFUSED_PLATE,
            f"Plaque {plaque} {reason}",
            data["camera_id"],
            data.get("snapshot"),
        )
    return {"status": row.statut, "log": row.id}


# Events that produce no attendance and no access row, only something to look at.
_ALERTS = {
    "unknown_face": (Alert.Kind.UNKNOWN_FACE, "Visage non reconnu"),
    "spoof_attempt": (Alert.Kind.SPOOF_ATTEMPT, "Visage présenté sur photo ou écran"),
    "signal_loss": (Alert.Kind.SIGNAL_LOSS, "Perte de signal vidéo RTSP"),
    "tamper_attempt": (Alert.Kind.TAMPER_ATTEMPT, "Obstruction / Sabotage caméra"),
}


def _alert_only(data: dict, kind: str) -> dict:
    default_msg = f"Alerte système: {kind}"
    alert_kind, message = _ALERTS.get(kind, (kind, default_msg))
    custom_msg = data.get("subject") or message
    alert = raise_alert(alert_kind, custom_msg, data["camera_id"], data.get("snapshot"))
    return {"status": "alert", "alert": alert.id}

