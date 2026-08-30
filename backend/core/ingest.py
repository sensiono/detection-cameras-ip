from __future__ import annotations

import logging
from datetime import datetime, time

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from .models import AccessLog, Alert, Attendance, User, Vehicle
from .notify import raise_alert

log = logging.getLogger(__name__)


def _late_after() -> time:
    return datetime.strptime(settings.LATE_AFTER, "%H:%M").time()


@transaction.atomic
def handle_event(data: dict) -> dict:
    """Turn one recognition event into rows. This is where authorisation lives:
    the AI service reads plates, the database decides who may come in."""
    at = timezone.localtime(data["at"])
    kind = data["kind"]
    if kind == "attendance":
        return _attendance(data, at)
    if kind == "access":
        return _access(data, at)
    return _alert_only(data, kind)


def _attendance(data: dict, at: datetime) -> dict:
    subject = data["subject"].removeprefix("user_")  # tolerate both id forms
    user = User.objects.filter(pk=subject).first()
    if user is None:
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
        return {"status": "checked_in", "attendance": row.id, "statut": row.statut}
    # Any later sighting is a departure until a further one replaces it.
    row.check_out = at.time()
    row.save(update_fields=["check_out"])
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
}


def _alert_only(data: dict, kind: str) -> dict:
    alert_kind, message = _ALERTS[kind]
    alert = raise_alert(alert_kind, message, data["camera_id"], data.get("snapshot"))
    return {"status": "alert", "alert": alert.id}
