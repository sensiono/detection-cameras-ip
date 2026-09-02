from __future__ import annotations

import base64
import binascii
import uuid

from django.core.files.base import ContentFile
from rest_framework import serializers

from .models import AccessLog, Alert, Attendance, AttendanceAudit, Camera, SystemSetting, User, Vehicle


from .plates import canonical



class EventSerializer(serializers.Serializer):
    """The AI service contract. Deliberately not a ModelSerializer: one incoming
    event can touch several tables, and the mapping is a decision, not a field copy."""

    kind = serializers.ChoiceField(
        choices=["attendance", "access", "unknown_face", "spoof_attempt", "signal_loss", "tamper_attempt"]
    )

    camera_id = serializers.CharField(max_length=64)
    subject = serializers.CharField(max_length=64, allow_blank=True)
    confidence = serializers.FloatField(min_value=0.0, max_value=1.0)
    at = serializers.DateTimeField()
    snapshot = serializers.CharField(required=False, allow_blank=True, allow_null=True)  # base64 JPEG


    def validate(self, attrs):
        if attrs["kind"] in ("attendance", "access") and not attrs["subject"]:
            raise serializers.ValidationError({"subject": "required for this kind"})
        return attrs

    def validate_snapshot(self, value: str):
        if not value:
            return None
        try:
            raw = base64.b64decode(value, validate=True)
        except (binascii.Error, ValueError):
            raise serializers.ValidationError("not valid base64")
        if len(raw) > 2_000_000:  # a plate crop is a few kB; anything larger is wrong
            raise serializers.ValidationError("snapshot too large")
        return ContentFile(raw, name=f"{uuid.uuid4().hex}.jpg")


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email", "nom", "prenom", "photo", "role")



class AttendanceAuditSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.__str__", read_only=True)

    class Meta:
        model = AttendanceAudit
        fields = (
            "id", "attendance", "user", "user_name", "date", "heure",
            "timestamp", "event_type", "camera_id", "confidence", "snapshot", "audit_hash",
        )
        read_only_fields = fields


class AttendanceSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source="user.__str__", read_only=True)
    audits = AttendanceAuditSerializer(many=True, read_only=True)

    class Meta:
        model = Attendance
        fields = (
            "id", "user", "user_name", "date", "check_in", "check_out",
            "statut", "camera_id", "confidence", "snapshot", "audit_hash", "audits",
        )
        read_only_fields = fields



class VehicleSerializer(serializers.ModelSerializer):
    class Meta:
        model = Vehicle
        fields = ("id", "plaque", "proprietaire", "type", "autorise", "user")

    def to_internal_value(self, data):
        """Canonicalise before validation, not inside it.

        `validate_plaque` would run *after* the uniqueness check, so registering
        "159 TU 8950" when "159 TN 8950" already exists passed validation and then
        hit the database constraint — a 500 where the admin should simply be told
        the car is already registered.
        """
        if "plaque" in data:
            data = {**data, "plaque": canonical(str(data["plaque"]))}
        return super().to_internal_value(data)


class AccessLogSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccessLog
        fields = (
            "id", "vehicle", "plaque", "date", "heure",
            "statut", "camera_id", "confidence", "snapshot", "audit_hash",
        )
        read_only_fields = fields



class AlertSerializer(serializers.ModelSerializer):
    class Meta:
        model = Alert
        fields = ("id", "kind", "message", "camera_id", "snapshot", "created_at", "seen")
        read_only_fields = ("id", "kind", "message", "camera_id", "snapshot", "created_at")


class CameraSerializer(serializers.ModelSerializer):
    class Meta:
        model = Camera
        fields = (
            "id", "cam_id", "name", "url", "task",
            "enabled", "location", "resolution", "fps", "created_at"
        )
        read_only_fields = ("id", "created_at")


class SystemSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SystemSetting
        fields = ("id", "key", "value", "description", "updated_at")
        read_only_fields = ("id", "updated_at")


