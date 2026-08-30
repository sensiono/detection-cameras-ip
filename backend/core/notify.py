from __future__ import annotations

import logging

from django.conf import settings
from django.core.mail import send_mail

from .models import Alert

log = logging.getLogger(__name__)


def raise_alert(kind: str, message: str, camera_id: str = "", snapshot=None) -> Alert:
    """Record what the admin must see, and email it. The row is the source of truth:
    mail can fail, the dashboard counter must not."""
    if snapshot is not None:
        snapshot.seek(0)  # the same crop was already saved on the log row
    alert = Alert.objects.create(
        kind=kind, message=message, camera_id=camera_id, snapshot=snapshot
    )
    if settings.ALERT_EMAIL:
        try:
            send_mail(
                subject=f"[Vision] {alert.get_kind_display()}",
                message=f"{message}\nCaméra : {camera_id or 'inconnue'}",
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[settings.ALERT_EMAIL],
                fail_silently=False,
            )
        except Exception as exc:  # a dead SMTP server must not drop the event
            log.error("alert mail failed: %s", exc)
    return alert
