from __future__ import annotations

from datetime import date, timedelta

from django.urls import reverse
from django.utils import timezone
from rest_framework.authtoken.models import Token
from rest_framework.test import APITestCase

from .ingest import handle_event
from .models import AccessLog, Alert, Attendance, AttendanceAudit, User, Vehicle



class EventIngestionTests(APITestCase):
    """Everything the cameras can send, including what the cahier does not specify."""

    def setUp(self):
        self.member = User.objects.create_user(
            username="m1", password="x", nom="Ben Ali", prenom="Sarra", role=User.Role.MEMBER
        )
        self.service = User.objects.create_user(username="ai", password="x")
        self.client.credentials(
            HTTP_AUTHORIZATION=f"Token {Token.objects.create(user=self.service).key}"
        )
        self.url = reverse("events")

    def post(self, **overrides):
        payload = {
            "kind": "attendance",
            "camera_id": "cam-entrance",
            "subject": str(self.member.id),
            "confidence": 0.8,
            "at": timezone.now().isoformat(),
        }
        payload.update(overrides)
        return self.client.post(self.url, payload, format="json")

    def test_first_sighting_checks_in_second_checks_out_and_audits_both(self):
        assert self.post().data["status"] == "checked_in"
        assert self.post().data["status"] == "checked_out"
        assert Attendance.objects.count() == 1  # one row a day, not one per frame
        assert AttendanceAudit.objects.count() == 2
        audits = list(AttendanceAudit.objects.order_by("timestamp"))
        assert audits[0].event_type == AttendanceAudit.EventType.CHECK_IN
        assert audits[1].event_type == AttendanceAudit.EventType.DEPARTURE_UPDATE


    def test_unknown_user_is_ignored_not_500(self):
        response = self.post(subject="99999")
        assert response.status_code == 201
        assert response.data["status"] == "ignored"
        assert Attendance.objects.count() == 0

    def test_known_plate_is_authorised(self):
        Vehicle.objects.create(plaque="123TN4567", autorise=True)
        response = self.post(kind="access", subject="123TN4567", camera_id="cam-gate")
        assert response.data["status"] == AccessLog.Status.AUTHORIZED
        assert Alert.objects.count() == 0

    def test_unknown_plate_is_refused_and_alerts(self):
        response = self.post(kind="access", subject="999TN9999", camera_id="cam-gate")
        assert response.data["status"] == AccessLog.Status.REFUSED
        assert AccessLog.objects.get().vehicle is None
        assert Alert.objects.get().kind == Alert.Kind.REFUSED_PLATE

    def test_blacklisted_plate_is_refused_even_though_known(self):
        Vehicle.objects.create(plaque="123TN4567", autorise=False)
        response = self.post(kind="access", subject="123TN4567")
        assert response.data["status"] == AccessLog.Status.REFUSED

    def test_unknown_face_raises_an_alert(self):
        response = self.post(kind="unknown_face", subject="")
        assert response.status_code == 201
        assert Alert.objects.get().kind == Alert.Kind.UNKNOWN_FACE

    def test_spoof_attempt_alerts_and_never_marks_attendance(self):
        response = self.post(kind="spoof_attempt", subject="")
        assert response.status_code == 201
        assert Alert.objects.get().kind == Alert.Kind.SPOOF_ATTEMPT
        assert Attendance.objects.count() == 0

    def test_anonymous_cannot_post_events(self):
        self.client.credentials()
        assert self.post().status_code == 401


class RoleTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="a", password="x", role=User.Role.ADMIN)
        self.super = User.objects.create_user(
            username="s", password="x", role=User.Role.SUPERVISOR
        )

    def test_supervisor_reads_but_cannot_write_vehicles(self):
        self.client.force_authenticate(self.super)
        assert self.client.get("/api/vehicles/").status_code == 200
        assert self.client.post("/api/vehicles/", {"plaque": "1TN1"}).status_code == 403

    def test_me_returns_the_caller_role(self):
        self.client.force_authenticate(self.super)
        assert self.client.get("/api/auth/me/").data["role"] == User.Role.SUPERVISOR

    def test_admin_can_write_and_plate_is_canonicalised(self):
        self.client.force_authenticate(self.admin)
        response = self.client.post("/api/vehicles/", {"plaque": "123 tn 4567"})
        assert response.status_code == 201
        assert Vehicle.objects.get().plaque == "123TN4567"


class PlateCanonicalisationTests(APITestCase):
    """The camera and the admin form must produce the same string for the same car.

    These cases mirror `tests/test_plate_formats.py` in the vision service: the two
    codebases deploy separately, so the agreement between them is pinned by a shared
    set of examples rather than by a shared import.
    """

    def setUp(self):
        self.admin = User.objects.create_user(username="a", password="x", role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)

    def add(self, plaque):
        return self.client.post("/api/vehicles/", {"plaque": plaque})

    def test_spacing_and_leading_zeros_collapse_to_one_row(self):
        assert self.add("062 TN 0528").status_code == 201
        # The camera reads this same car as "62TN528"; a second row would mean the
        # gate refuses it half the time.
        assert self.add("62TN528").status_code == 400
        assert Vehicle.objects.get().plaque == "62TN528"

    def test_the_two_spellings_of_the_arabic_word_are_one_plate(self):
        assert self.add("159 TN 8950").status_code == 201
        assert self.add("159 TU 8950").status_code == 400

    def test_a_diplomatic_plate_is_not_turned_into_a_civil_one(self):
        assert self.add("46 CD 02").status_code == 201
        assert Vehicle.objects.get().plaque == "46CD02"

    def test_government_plate_keeps_its_digits(self):
        assert self.add("20-130486").status_code == 201
        assert Vehicle.objects.get().plaque == "20130486"


class ReportTests(APITestCase):
    def setUp(self):
        self.admin = User.objects.create_user(username="a", password="x", role=User.Role.ADMIN)
        self.present = User.objects.create_user(username="p", password="x", nom="Present")
        self.absent = User.objects.create_user(username="b", password="x", nom="Absent")
        Attendance.objects.create(
            user=self.present, date=date.today(), check_in="08:00", statut="present"
        )
        self.client.force_authenticate(self.admin)

    def test_xlsx_and_pdf_are_produced(self):
        for fmt, magic in (("xlsx", b"PK"), ("pdf", b"%PDF")):
            response = self.client.get(f"/api/reports/attendance.{fmt}")
            assert response.status_code == 200
            assert response.content.startswith(magic)

    def test_absent_member_appears_in_the_report(self):
        from .reports import attendance_rows

        rows = attendance_rows(date.today(), date.today())
        statuses = {r[1]: r[5] for r in rows}
        assert statuses["Present"] == "Présent"
        assert statuses["Absent"] == "Absent"


class EnterpriseGDPRAndResilienceTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(username="sarah", password="x", nom="Sarah", role=User.Role.MEMBER)
        self.admin = User.objects.create_user(username="admin", password="x", role=User.Role.ADMIN)
        self.client.force_authenticate(self.admin)

    def test_sha256_audit_hash_generated_on_creation(self):
        att = Attendance.objects.create(
            user=self.user, date=date.today(), check_in="08:15", statut="present", camera_id="cam-entrance"
        )
        assert len(att.audit_hash) == 64
        
        audit = AttendanceAudit.objects.create(
            attendance=att, user=self.user, date=date.today(), heure="08:15",
            event_type=AttendanceAudit.EventType.CHECK_IN, camera_id="cam-entrance", confidence=0.98
        )
        assert len(audit.audit_hash) == 64

        log = AccessLog.objects.create(
            plaque="159TN8950", date=date.today(), heure="08:15", statut="autorise", camera_id="cam-gate"
        )
        assert len(log.audit_hash) == 64

    def test_signal_loss_and_tampering_alerts_ingestion(self):
        now = timezone.now()
        res_loss = handle_event({
            "kind": "signal_loss",
            "camera_id": "cam-entrance",
            "subject": "Perte de signal vidéo (12s)",
            "confidence": 1.0,
            "at": now,
        })
        assert res_loss["status"] == "alert"
        alert_loss = Alert.objects.get(id=res_loss["alert"])
        assert alert_loss.kind == Alert.Kind.SIGNAL_LOSS
        assert "Perte de signal" in alert_loss.message

        res_tamper = handle_event({
            "kind": "tamper_attempt",
            "camera_id": "cam-gate",
            "subject": "Sabotage: Lentille masquée",
            "confidence": 1.0,
            "at": now,
        })
        assert res_tamper["status"] == "alert"
        alert_tamper = Alert.objects.get(id=res_tamper["alert"])
        assert alert_tamper.kind == Alert.Kind.TAMPER_ATTEMPT

    def test_gdpr_retention_purge_command(self):
        from io import StringIO
        from django.core.management import call_command
        from django.core.files.base import ContentFile

        old_date = date.today() - timedelta(days=45)
        att_old = Attendance.objects.create(
            user=self.user, date=old_date, check_in="08:00", statut="present", camera_id="cam-1"
        )
        att_old.snapshot.save("test_att.jpg", ContentFile(b"fake_image_bytes"))
        
        audit_old = AttendanceAudit.objects.create(
            attendance=att_old, user=self.user, date=old_date, heure="08:00",
            event_type=AttendanceAudit.EventType.CHECK_IN, camera_id="cam-1", confidence=0.95
        )
        audit_old.snapshot.save("test_audit.jpg", ContentFile(b"fake_image_bytes"))

        out = StringIO()
        call_command("purge_snapshots", days=30, stdout=out)
        output = out.getvalue()
        assert "Successfully purged" in output

        att_old.refresh_from_db()
        audit_old.refresh_from_db()
        assert not bool(att_old.snapshot)
        assert not bool(audit_old.snapshot)
        assert len(att_old.audit_hash) == 64
        assert len(audit_old.audit_hash) == 64
        assert att_old.date == old_date

