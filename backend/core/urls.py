from django.urls import include, path
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from . import views

router = DefaultRouter()
router.register("users", views.UserViewSet)
router.register("attendance", views.AttendanceViewSet, basename="attendance")
router.register("attendance-audits", views.AttendanceAuditViewSet, basename="attendance-audits")
router.register("vehicles", views.VehicleViewSet)
router.register("cameras", views.CameraViewSet)
router.register("logs", views.AccessLogViewSet, basename="logs")

router.register("alerts", views.AlertViewSet)

urlpatterns = [
    path("cameras/<str:cam_id>/stream/", views.camera_stream, name="camera-stream"),
    path("cameras/<str:cam_id>/snapshot/", views.camera_snapshot, name="camera-snapshot"),
    path("cameras/<str:cam_id>/frame/", views.ingest_camera_frame, name="camera-frame"),

    path("events/pulse/", views.events_pulse, name="events-pulse"),
    path("events/stream/", views.sse_stream, name="sse-stream"),
    path("events/", views.events, name="events"),

    path("auth/login/", TokenObtainPairView.as_view(), name="login"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="refresh"),
    path("auth/me/", views.me, name="me"),
    path("auth/change-password/", views.change_password, name="change-password"),
    path("dashboard/", views.dashboard, name="dashboard"),
    path("settings/", views.system_settings, name="system-settings"),

    path("reports/attendance.<str:fmt>", views.attendance_report, name="attendance-report"),
    path("", include(router.urls)),
]
