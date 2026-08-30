from __future__ import annotations

from django.contrib.auth.models import AbstractUser
from django.db import models


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

    class Meta:
        unique_together = ("user", "date")  # the DB, not the app, enforces one row a day
        ordering = ("-date", "-check_in")

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

    class Meta:
        ordering = ("-date", "-heure")

    def __str__(self) -> str:
        return f"{self.plaque} {self.date} {self.statut}"


class Alert(models.Model):
    """What the admin has to look at: a refused plate, a face nobody knows, or a
    photo held up to the camera. One model for all three, so the dashboard has a
    single unread counter."""

    class Kind(models.TextChoices):
        REFUSED_PLATE = "refused_plate", "Plaque refusée"
        UNKNOWN_FACE = "unknown_face", "Visage inconnu"
        SPOOF_ATTEMPT = "spoof_attempt", "Tentative d'usurpation"

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
