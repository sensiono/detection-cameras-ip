from __future__ import annotations

from rest_framework.permissions import SAFE_METHODS, BasePermission

from .models import User


class IsSupervisorOrAdmin(BasePermission):
    """Both dashboard roles may read. Only the administrator changes anything —
    that is the whole difference between the two roles in the cahier."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        if not (user and user.is_authenticated):
            return False
        if user.is_superuser or user.role == User.Role.ADMIN:
            return True
        return user.role == User.Role.SUPERVISOR and request.method in SAFE_METHODS


class IsCameraService(BasePermission):
    """The AI service posts events and does nothing else."""

    def has_permission(self, request, view) -> bool:
        return bool(request.user and request.user.is_authenticated)
