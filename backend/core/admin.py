from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import AccessLog, Alert, Attendance, User, Vehicle


@admin.register(User)
class VisionUserAdmin(UserAdmin):
    list_display = ("username", "nom", "prenom", "role", "is_active")
    list_filter = ("role", "is_active")
    fieldsets = UserAdmin.fieldsets + (("Vision", {"fields": ("nom", "prenom", "photo", "role")}),)


@admin.register(Attendance)
class AttendanceAdmin(admin.ModelAdmin):
    list_display = ("date", "user", "check_in", "check_out", "statut", "camera_id")
    list_filter = ("statut", "date", "camera_id")
    search_fields = ("user__nom", "user__prenom")


@admin.register(Vehicle)
class VehicleAdmin(admin.ModelAdmin):
    list_display = ("plaque", "proprietaire", "type", "autorise")
    list_filter = ("type", "autorise")
    search_fields = ("plaque", "proprietaire")


@admin.register(AccessLog)
class AccessLogAdmin(admin.ModelAdmin):
    list_display = ("date", "heure", "plaque", "statut", "camera_id")
    list_filter = ("statut", "date", "camera_id")
    search_fields = ("plaque",)


@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ("created_at", "kind", "message", "camera_id", "seen")
    list_filter = ("kind", "seen")
