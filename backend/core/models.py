from __future__ import annotations

import hashlib
from django.contrib.auth.models import AbstractUser
from django.db import models


def compute_sha256_hash(*parts: str | int | float | None) -> str:
    """Computes a deterministic, tamper-evident SHA-256 cryptographic hash for an audit record."""
    raw = "|".join(str(p if p is not None else "") for p in parts)
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


class User(AbstractUser):
    """One table for everyone, as in the cahier des charges: the people the cameras
    recognise (`member`) and the people who log into the dashboard (`admin`,
    `supervisor`). `id` is what the AI service sends back as the event subject."""

    class Role(models.TextChoices):
        ADMIN = "admin", "Administrateur"
        SUPERVISOR = "supervisor", "Agent de supervision"
        MEMBER = "member", "Personne suivie"

    nom = models.CharField(max_length=80, blank=True)
    prenom = models.CharField(max_length=80, blank=True)
    photo = models.ImageField(upload_to="photos/", blank=True, null=True)
    role = models.CharField(max_length=16, choices=Role.choices, default=Role.MEMBER)

    def __str__(self) -> str:
        return f"{self.prenom} {self.nom}".strip() or self.username

    @property
    def is_staff_role(self) -> bool:
        return self.role in (self.Role.ADMIN, self.Role.SUPERVISOR)


class Attendance(models.Model):
    """One row per person per day. The first sighting sets `check_in`, every later
    one moves `check_out` — which is why entry and exit need no second camera."""

    class Status(models.TextChoices):
        PRESENT = "present", "Présent"
        LATE = "late", "En retard"

    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="attendances")
    date = models.DateField()
    check_in = models.TimeField()
    check_out = models.TimeField(null=True, blank=True)
    statut = models.CharField(max_length=16, choices=Status.choices, default=Status.PRESENT)
    camera_id = models.CharField(max_length=64, blank=True)
    confidence = models.FloatField(default=0.0)
    snapshot = models.ImageField(upload_to="attendance/", blank=True, null=True)
    audit_hash = models.CharField(max_length=64, blank=True, db_index=True)

    class Meta:
        unique_together = ("user", "date")  # the DB, not the app, enforces one row a day
        ordering = ("-date", "-check_in")

    def save(self, *args, **kwargs):
        if not self.audit_hash:
            self.audit_hash = compute_sha256_hash(
                "attendance", self.user_id, self.date, self.check_in, self.statut, self.camera_id
            )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.user} {self.date} {self.statut}"


class Vehicle(models.Model):
    class Type(models.TextChoices):
        BUS = "bus", "Bus"
        CAR = "car", "Voiture"
        OTHER = "other", "Autre"

    plaque = models.CharField(max_length=16, unique=True)  # stored normalised
    proprietaire = models.CharField(max_length=160, blank=True)
    type = models.CharField(max_length=16, choices=Type.choices, default=Type.CAR)
    autorise = models.BooleanField(default=True)
    user = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True, related_name="vehicles"
    )

    class Meta:
        ordering = ("plaque",)

    def __str__(self) -> str:
        return self.plaque


class AccessLog(models.Model):
    """Every plate read at the gate, recognised or not. `vehicle` is null when the
    plate is unknown — that case is the point of the system, not an error."""

    class Status(models.TextChoices):
        AUTHORIZED = "autorise", "Autorisé"
        REFUSED = "refuse", "Refusé"

    vehicle = models.ForeignKey(
        Vehicle, on_delete=models.SET_NULL, null=True, blank=True, related_name="logs"
    )
    plaque = models.CharField(max_length=16)
    date = models.DateField()
    heure = models.TimeField()
    statut = models.CharField(max_length=16, choices=Status.choices)
    camera_id = models.CharField(max_length=64, blank=True)
    confidence = models.FloatField(default=0.0)
    snapshot = models.ImageField(upload_to="access/", blank=True, null=True)
    audit_hash = models.CharField(max_length=64, blank=True, db_index=True)

    class Meta:
        ordering = ("-date", "-heure")

    def save(self, *args, **kwargs):
        if not self.audit_hash:
            self.audit_hash = compute_sha256_hash(
                "access_log", self.plaque, self.date, self.heure, self.statut, self.camera_id
            )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.plaque} {self.date} {self.statut}"


class Alert(models.Model):
    """What the admin has to look at: a refused plate, a face nobody knows, or a
    photo held up to the camera, signal loss, or tampering. One model for all,
    so the dashboard has a single unread counter."""

    class Kind(models.TextChoices):
        REFUSED_PLATE = "refused_plate", "Plaque refusée"
        UNKNOWN_FACE = "unknown_face", "Visage inconnu"
        SPOOF_ATTEMPT = "spoof_attempt", "Tentative d'usurpation"
        SIGNAL_LOSS = "signal_loss", "Perte de signal caméra"
        TAMPER_ATTEMPT = "tamper_attempt", "Sabotage / Obstruction caméra"

    kind = models.CharField(max_length=32, choices=Kind.choices)
    message = models.CharField(max_length=255)
    camera_id = models.CharField(max_length=64, blank=True)
    snapshot = models.ImageField(upload_to="alerts/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    seen = models.BooleanField(default=False)

    class Meta:
        ordering = ("-created_at",)

    def __str__(self) -> str:
        return f"{self.kind} {self.message}"


class AttendanceAudit(models.Model):
    """Complete audit trail of every face detection passage, capturing both the initial
    check-in and every subsequent check-out departure update with its exact timestamp, photo proof,
    and immutable SHA-256 audit hash.
    """

    class EventType(models.TextChoices):
        CHECK_IN = "check_in", "Arrivée (Check-in)"
        DEPARTURE_UPDATE = "departure_update", "Mise à jour départ (Check-out)"
        PASSAGE = "passage", "Passage"

    attendance = models.ForeignKey(
        Attendance, on_delete=models.CASCADE, related_name="audits", null=True, blank=True
    )
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="attendance_audits")
    date = models.DateField()
    heure = models.TimeField()
    timestamp = models.DateTimeField(auto_now_add=True)
    event_type = models.CharField(
        max_length=32, choices=EventType.choices, default=EventType.CHECK_IN
    )
    camera_id = models.CharField(max_length=64, blank=True)
    confidence = models.FloatField(default=0.0)
    snapshot = models.ImageField(upload_to="attendance_audits/", blank=True, null=True)
    audit_hash = models.CharField(max_length=64, blank=True, db_index=True)

    class Meta:
        ordering = ("-date", "-heure", "-id")

    def save(self, *args, **kwargs):
        if not self.audit_hash:
            self.audit_hash = compute_sha256_hash(
                "audit", self.user_id, self.date, self.heure, self.event_type, self.camera_id, self.confidence
            )
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.user} {self.date} {self.heure} ({self.event_type})"


class Camera(models.Model):
    """Dynamic and configurable surveillance camera stream entity."""

    class Task(models.TextChoices):
        ATTENDANCE = "attendance", "Pointage Facial"
        ANPR = "anpr", "Portail & Véhicules (ANPR)"

    cam_id = models.CharField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=128)
    url = models.CharField(max_length=512)
    task = models.CharField(max_length=32, choices=Task.choices, default=Task.ATTENDANCE)
    enabled = models.BooleanField(default=True)
    location = models.CharField(max_length=128, blank=True)
    resolution = models.CharField(max_length=32, default="1080p")
    fps = models.IntegerField(default=25)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ("id",)

    def __str__(self) -> str:
        return f"{self.name} ({self.cam_id}) - {self.task}"

