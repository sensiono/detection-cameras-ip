from __future__ import annotations

from datetime import date, datetime, timedelta

from django.db.models import Count, Q
from django.http import HttpResponse
from rest_framework import status, viewsets
from rest_framework.decorators import action, api_view, permission_classes
from rest_framework.response import Response

from . import reports
from .ingest import handle_event
from .models import AccessLog, Alert, Attendance, User, Vehicle
from .permissions import IsCameraService, IsSupervisorOrAdmin
from .serializers import (
    AccessLogSerializer,
    AlertSerializer,
    AttendanceSerializer,
    EventSerializer,
    UserSerializer,
    VehicleSerializer,
)


@api_view(["POST"])
@permission_classes([IsCameraService])
def events(request):
    """The single entry point for the AI service."""
    serializer = EventSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    return Response(handle_event(serializer.validated_data), status=status.HTTP_201_CREATED)


@api_view(["GET"])
def me(request):
    """Who am I? The dashboard needs the role to know what to render."""
    return Response(UserSerializer(request.user).data)


class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by("nom", "prenom")
    serializer_class = UserSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        qs = super().get_queryset()
        role = self.request.query_params.get("role")
        return qs.filter(role=role) if role else qs


class AttendanceViewSet(viewsets.ReadOnlyModelViewSet):
    """Read-only on purpose: presences are written by the cameras, never by hand.
    Correcting one is an admin action, and it belongs in the Django admin with its
    audit trail, not in a REST endpoint anyone with a token can call."""

    serializer_class = AttendanceSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        qs = Attendance.objects.select_related("user")
        params = self.request.query_params
        if user_id := params.get("user"):
            qs = qs.filter(user_id=user_id)
        if start := params.get("from"):
            qs = qs.filter(date__gte=start)
        if end := params.get("to"):
            qs = qs.filter(date__lte=end)
        return qs


class VehicleViewSet(viewsets.ModelViewSet):
    queryset = Vehicle.objects.all()
    serializer_class = VehicleSerializer
    permission_classes = [IsSupervisorOrAdmin]


class AccessLogViewSet(viewsets.ReadOnlyModelViewSet):
    serializer_class = AccessLogSerializer
    permission_classes = [IsSupervisorOrAdmin]

    def get_queryset(self):
        qs = AccessLog.objects.select_related("vehicle")
        params = self.request.query_params
        if statut := params.get("statut"):
            qs = qs.filter(statut=statut)
        if start := params.get("from"):
            qs = qs.filter(date__gte=start)
        if end := params.get("to"):
            qs = qs.filter(date__lte=end)
        return qs


class AlertViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Alert.objects.all()
    serializer_class = AlertSerializer
    permission_classes = [IsSupervisorOrAdmin]

    @action(detail=True, methods=["post"])
    def seen(self, request, pk=None):
        alert = self.get_object()
        alert.seen = True
        alert.save(update_fields=["seen"])
        return Response(self.get_serializer(alert).data)


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
        }
    )
