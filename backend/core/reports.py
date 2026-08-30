from __future__ import annotations

import io
from datetime import date, timedelta

from django.db.models import QuerySet
from openpyxl import Workbook
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from .models import Attendance, User

HEADERS = ("Date", "Nom", "Prénom", "Arrivée", "Départ", "Statut")


def daterange(start: date, end: date):
    for i in range((end - start).days + 1):
        yield start + timedelta(days=i)


def attendance_rows(start: date, end: date, include_absent: bool = True) -> list[tuple]:
    """Presences in the window, plus one 'Absent' line per member per day with no row.

    Absence is the absence of data, so it is computed here rather than stored — that
    keeps the cameras from having to know who was expected.
    """
    present: QuerySet = (
        Attendance.objects.filter(date__range=(start, end))
        .select_related("user")
        .order_by("date", "user__nom")
    )
    rows = [
        (
            a.date.isoformat(),
            a.user.nom,
            a.user.prenom,
            a.check_in.strftime("%H:%M"),
            a.check_out.strftime("%H:%M") if a.check_out else "",
            a.get_statut_display(),
        )
        for a in present
    ]
    if not include_absent:
        return rows

    members = list(User.objects.filter(role=User.Role.MEMBER))
    seen = {(a.date, a.user_id) for a in present}
    for day in daterange(start, end):
        for member in members:
            if (day, member.id) not in seen:
                rows.append((day.isoformat(), member.nom, member.prenom, "", "", "Absent"))
    rows.sort(key=lambda r: (r[0], r[1]))
    return rows


def to_xlsx(rows: list[tuple], title: str) -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = "Présences"
    ws.append([title])
    ws.append(list(HEADERS))
    for row in rows:
        ws.append(list(row))
    for i, width in enumerate((12, 18, 18, 10, 10, 12), start=1):
        ws.column_dimensions[ws.cell(row=2, column=i).column_letter].width = width
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def to_pdf(rows: list[tuple], title: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, title=title)
    styles = getSampleStyleSheet()
    table = Table([list(HEADERS)] + [list(r) for r in rows], repeatRows=1)
    table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#2f4f6f")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.25, colors.grey),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f2f2f2")]),
            ]
        )
    )
    doc.build([Paragraph(title, styles["Heading2"]), Spacer(1, 12), table])
    return buffer.getvalue()
