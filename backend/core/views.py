from __future__ import annotations

from datetime import date, datetime, timedelta

from django.conf import settings
from django.db.models import Count, Q
from django.http import HttpResponse, JsonResponse, StreamingHttpResponse

from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import reports
from .events_bus import event_bus
from .ingest import handle_event
from .models import AccessLog, Alert, Attendance, AttendanceAudit, Camera, SystemSetting, User, Vehicle
from .permissions import IsCameraService, IsSupervisorOrAdmin
from .serializers import (
    AccessLogSerializer,
    AlertSerializer,
    AttendanceAuditSerializer,
    AttendanceSerializer,
    CameraSerializer,
    EventSerializer,
    UserSerializer,
    VehicleSerializer,
)



# Global monotonic revision counter for ultra-fast polling
_EVENT_REVISION = 0


def bump_revision():
    global _EVENT_REVISION
    _EVENT_REVISION += 1


@api_view(["GET"])
@permission_classes([AllowAny])
def events_pulse(request):
    """Ultra-fast revision heartbeat check (1ms response, no gunicorn timeouts)."""
    return JsonResponse({
        "revision": _EVENT_REVISION,
        "unseen_alerts": Alert.objects.filter(seen=False).count(),
        "today_presences": Attendance.objects.filter(date=date.today()).count(),
        "today_accesses": AccessLog.objects.filter(date=date.today()).count(),
        "active_cameras": Camera.objects.filter(enabled=True).count(),
    })


def sse_stream(request):
    """Server-Sent Events (SSE) stream for real-time dashboard and table updates."""
    import queue

    def event_generator():
        q = event_bus.subscribe()
        yield 'event: connected\ndata: {"status": "connected"}\n\n'
        try:
            while True:
                try:
                    msg = q.get(timeout=5.0)
                    yield msg
                except queue.Empty:
                    yield ": keepalive\n\n"
        except (GeneratorExit, BaseException):
            pass
        finally:
            event_bus.unsubscribe(q)

    response = StreamingHttpResponse(event_generator(), content_type="text/event-stream")
    response["Cache-Control"] = "no-cache"
    response["X-Accel-Buffering"] = "no"
    return response




@api_view(["POST"])
@permission_classes([IsCameraService])
def events(request):
    """The single entry point for the AI service."""
    serializer = EventSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(handle_event(serializer.validated_data), status=status.HTTP_201_CREATED)


@api_view(["GET", "PATCH", "PUT"])
@permission_classes([IsAuthenticated])
def me(request):
    """Who am I? Also supports updating own profile details (username, email, prenom, nom)."""
    user = request.user
    if request.method in ("PATCH", "PUT"):
        data = request.data
        if "username" in data:
            new_username = str(data["username"]).strip()
            if not new_username:
                return Response(
                    {"detail": "Le nom d'utilisateur est obligatoire."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if new_username != user.username:
                if User.objects.filter(username__iexact=new_username).exclude(pk=user.pk).exists():
                    return Response(
                        {"detail": "Ce nom d'utilisateur est déjà utilisé."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.username = new_username
        if "email" in data:
            new_email = str(data["email"]).strip()
            if new_email and new_email.lower() != (user.email or "").lower():
                from django.core.validators import validate_email
                from django.core.exceptions import ValidationError
                try:
                    validate_email(new_email)
                except ValidationError:
                    return Response(
                        {"detail": "Format d'adresse e-mail invalide."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if User.objects.filter(email__iexact=new_email).exclude(pk=user.pk).exists():
                    return Response(
                        {"detail": "Cette adresse e-mail est déjà utilisée par un autre compte."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                user.email = new_email
            elif not new_email:
                user.email = ""
        if "prenom" in data:
            user.prenom = str(data["prenom"]).strip()
        if "nom" in data:
            user.nom = str(data["nom"]).strip()
        user.save()
        bump_revision()
    return Response(UserSerializer(user).data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    """Change password for the authenticated user."""
    user = request.user
    old_pwd = request.data.get("old_password")
    new_pwd = request.data.get("new_password")
    if not old_pwd or not new_pwd:
        return Response(
            {"detail": "L'ancien mot de passe et le nouveau mot de passe sont requis."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if not user.check_password(old_pwd):
        return Response(
            {"detail": "L'ancien mot de passe est incorrect."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if old_pwd == new_pwd:
        return Response(
            {"detail": "Le nouveau mot de passe doit être différent de l'ancien."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    if len(str(new_pwd)) < 6:
        return Response(
            {"detail": "Le nouveau mot de passe doit comporter au moins 6 caractères."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    from django.contrib.auth.password_validation import validate_password
    from django.core.exceptions import ValidationError
    try:
        validate_password(new_pwd, user=user)
    except ValidationError as e:
        return Response(
            {"detail": " ".join(e.messages)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    user.set_password(new_pwd)
    user.save()
    return Response({"detail": "Mot de passe modifié avec succès."})



def rebuild_face_gallery():
    """Rebuilds models/faces.npz from data/photos/."""
    import os
    from django.conf import settings
    base_dir = getattr(settings, "BASE_DIR", "/app")
    try:
        from vision.faces.engine import FaceEngine
        from vision.faces.enroll import enroll_directory
        from vision.config import Config
        cfg_path = os.path.join(base_dir, "config.yaml")
        if os.path.exists(cfg_path):
            cfg = Config.load(cfg_path)
            photos_dir = os.path.join(base_dir, "data", "photos")
            if os.path.isdir(photos_dir):
                index = enroll_directory(FaceEngine(cfg.faces, False), photos_dir)
                index.save(cfg.faces.index_path)
    except Exception:
        pass


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("nom", "prenom")
    serializer_class = UserSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        return qs.filter(role=role) if role else qs

    def perform_create(self, serializer):
        user = serializer.save()
        self._handle_uploaded_photos(user)
        event_bus.broadcast("members_changed", {"action": "create", "id": user.id})
        bump_revision()

    def perform_update(self, serializer):
        user = serializer.save()
        self._handle_uploaded_photos(user)
        event_bus.broadcast("members_changed", {"action": "update", "id": user.id})
        bump_revision()

    def perform_destroy(self, instance):
        import os
        import shutil
        from django.conf import settings
        user_id = instance.id
        instance.delete()
        base_dir = getattr(settings, "BASE_DIR", "/app")
        user_photos_dir = os.path.join(base_dir, "data", "photos", str(user_id))
        if os.path.isdir(user_photos_dir):
            shutil.rmtree(user_photos_dir, ignore_errors=True)
        rebuild_face_gallery()
        event_bus.broadcast("members_changed", {"action": "delete", "id": user_id})
        bump_revision()

    def _handle_uploaded_photos(self, user):
        import os
        import shutil
        from django.conf import settings
        base_dir = getattr(settings, "BASE_DIR", "/app")
        user_dir = os.path.join(base_dir, "data", "photos", str(user.id))
        os.makedirs(user_dir, exist_ok=True)

        files = self.request.FILES.getlist("photos")
        if files:
            for idx, f in enumerate(files):
                dest = os.path.join(user_dir, f"photo_{idx+1}_{f.name}")
                with open(dest, "wb+") as destination:
                    for chunk in f.chunks():
                        destination.write(chunk)
                if idx == 0 and not user.photo:
                    user.photo.save(f"{user.username}_{idx+1}.jpg", f, save=False)
            user.save(update_fields=["photo"])
        elif user.photo:
            try:
                if os.path.isfile(user.photo.path):
                    shutil.copy2(user.photo.path, os.path.join(user_dir, "ref.jpg"))
            except Exception:
                pass

        rebuild_face_gallery()

    @action(detail=False, methods=["post"])
    def sync_faces(self, request):
        """Rebuilds the face gallery index from all user profile photos."""
        rebuild_face_gallery()
        return Response({"enrolled": User.objects.exclude(photo="").count(), "message": "Galerie faciale synchronisée"})




class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        qs = Attendance.objects.select_related("user").order_by("-date", "-id")
        params = self.request.query_params
        if user_id := params.get("user"):
            qs = qs.filter(user_id=user_id)
        if statut := params.get("statut"):
            qs = qs.filter(statut=statut)
        if start := params.get("from"):
            qs = qs.filter(date__gte=start)
        if end := params.get("to"):
            qs = qs.filter(date__lte=end)
        return qs


class AttendanceAuditViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AttendanceAuditSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        qs = AttendanceAudit.objects.select_related("user", "attendance").order_by("-date", "-heure", "-id")
        params = self.request.query_params
        if user_id := params.get("user"):
            qs = qs.filter(user_id=user_id)
        if att_id := params.get("attendance"):
            qs = qs.filter(attendance_id=att_id)
        if start := params.get("from"):
            qs = qs.filter(date__gte=start)
        if end := params.get("to"):
            qs = qs.filter(date__lte=end)
        return qs


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all().order_by("-id")
    serializer_class = VehicleSerializer
    permission_classes = [IsSupervisorOrAdmin]




class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AccessLogSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        qs = AccessLog.objects.select_related("vehicle").order_by("-date", "-id")
        params = self.request.query_params
        if statut := params.get("statut"):
            qs = qs.filter(statut=statut)
        if start := params.get("from"):
            qs = qs.filter(date__gte=start)
        if end := params.get("to"):
            qs = qs.filter(date__lte=end)
        return qs


class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Alert.objects.all().order_by("-created_at")
    serializer_class = AlertSerializer
    permission_classes = [IsSupervisorOrAdmin]

    @action(detail=True, methods=["post"])
    def seen(self, request, pk=None):
        alert = self.get_object()
        alert.seen = True
        alert.save(update_fields=["seen"])
        event_bus.broadcast("alert_seen", {"id": alert.id})
        bump_revision()
        return Response(self.get_serializer(alert).data)

    @action(detail=False, methods=["post"])
    def mark_all_seen(self, request):
        count = Alert.objects.filter(seen=False).update(seen=True)
        event_bus.broadcast("alert_seen", {"all": True})
        bump_revision()
        return Response({"marked": count})




class CameraViewSet(viewsets.ModelViewSet):
    queryset = Camera.objects.all().order_by("id")
    serializer_class = CameraSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def perform_create(self, serializer):
        cam = serializer.save()
        event_bus.broadcast("cameras_changed", {"action": "create", "id": cam.id})
        bump_revision()

    def perform_update(self, serializer):
        cam = serializer.save()
        event_bus.broadcast("cameras_changed", {"action": "update", "id": cam.id})
        bump_revision()

    def perform_destroy(self, instance):
        cam_id = instance.id
        instance.delete()
        event_bus.broadcast("cameras_changed", {"action": "delete", "id": cam_id})
        bump_revision()


def _window(request) -> tuple[date, date]:
    today = date.today()
    start = request.query_params.get("from")
    end = request.query_params.get("to")
    parse = lambda s: datetime.strptime(s, "%Y-%m-%d").date()  # noqa: E731
    return (parse(start) if start else today - timedelta(days=30), parse(end) if end else today)


@api_view(["GET"])
@permission_classes([IsSupervisorOrAdmin])
def attendance_report(request, fmt: str):
    """`/api/reports/attendance.xlsx` and `.pdf` — the cahier's report livrable."""
    start, end = _window(request)
    include_absent = request.query_params.get("absent", "1") == "1"
    rows = reports.attendance_rows(start, end, include_absent)
    title = f"Rapport de présence du {start:%d/%m/%Y} au {end:%d/%m/%Y}"
    if fmt == "xlsx":
        body = reports.to_xlsx(rows, title)
        content_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        body = reports.to_pdf(rows, title)
        content_type = "application/pdf"
    response = HttpResponse(body, content_type=content_type)
    response["Content-Disposition"] = f'attachment; filename="presences.{fmt}"'
    return response


@api_view(["GET"])
@permission_classes([IsSupervisorOrAdmin])
def dashboard(request):
    """The numbers the supervision screen shows, in one round trip."""
    today = date.today()
    members = User.objects.filter(role=User.Role.MEMBER).count()
    present = Attendance.objects.filter(date=today).count()
    access = AccessLog.objects.filter(date=today).aggregate(
        autorises=Count("id", filter=Q(statut=AccessLog.Status.AUTHORIZED)),
        refuses=Count("id", filter=Q(statut=AccessLog.Status.REFUSED)),
    )
    active_cameras = Camera.objects.filter(enabled=True).count()
    return Response(
        {
            "date": today,
            "membres": members,
            "presents": present,
            "absents": max(members - present, 0),
            "retards": Attendance.objects.filter(
                date=today, statut=Attendance.Status.LATE
            ).count(),
            **access,
            "alertes_non_vues": Alert.objects.filter(seen=False).count(),
            "active_cameras": active_cameras,
        }
    )


@api_view(["GET", "PATCH", "POST"])
@permission_classes([IsAuthenticated])
def system_settings(request):
    """Retrieve or update company-wide configuration parameters."""
    if request.method == "GET":
        late_after = SystemSetting.get("late_after", getattr(settings, "LATE_AFTER", "08:30"))
        company_name = SystemSetting.get("company_name", "Entreprise")
        return Response({
            "late_after": late_after,
            "company_name": company_name,
        })

    # Only supervisors or admins can modify system settings
    if not (request.user.is_staff or getattr(request.user, "role", None) in (User.Role.ADMIN, User.Role.SUPERVISOR)):
        return Response({"detail": "Permission refusée."}, status=status.HTTP_403_FORBIDDEN)

    data = request.data
    if "late_after" in data:
        val = str(data["late_after"]).strip()
        try:
            datetime.strptime(val, "%H:%M")
            SystemSetting.set("late_after", val, "Heure limite de pointage à l'heure")
        except (ValueError, TypeError):
            return Response(
                {"detail": "Format d'heure invalide. Utilisez le format HH:MM (ex: 08:30, 09:00)."},
                status=status.HTTP_400_BAD_REQUEST,
            )

    if "company_name" in data:
        SystemSetting.set("company_name", str(data["company_name"]).strip(), "Nom de l'entreprise")

    bump_revision()
    return Response({
        "late_after": SystemSetting.get("late_after", getattr(settings, "LATE_AFTER", "08:30")),
        "company_name": SystemSetting.get("company_name", "Entreprise"),
    })


