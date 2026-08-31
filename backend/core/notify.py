import json
import logging
import urllib.request
import urllib.parse

from django.conf import settings
from django.core.mail import send_mail

from .models import Alert

log = logging.getLogger(__name__)


def send_telegram_alert(alert: Alert, message: str, camera_id: str = "") -> None:
    token = getattr(settings, "TELEGRAM_BOT_TOKEN", None)
    chat_id = getattr(settings, "TELEGRAM_CHAT_ID", None)
    if not token or not chat_id:
        return

    text = f" *[Alerte Sécurité - {alert.get_kind_display()}]*\n\n{message}\n *Caméra:* `{camera_id or 'inconnue'}`\n *Heure:* `{alert.created_at.strftime('%Y-%m-%d %H:%M:%S')}`"
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = json.dumps({"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}).encode("utf-8")
    req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            log.info("telegram alert sent (status %d)", resp.status)
    except Exception as exc:
        log.warning("telegram dispatch failed: %s", exc)


def send_webhook_alert(alert: Alert, message: str, camera_id: str = "") -> None:
    webhook_url = getattr(settings, "ALERT_WEBHOOK_URL", None)
    if not webhook_url:
        return

    payload = json.dumps({
        "id": alert.id,
        "kind": alert.kind,
        "title": alert.get_kind_display(),
        "message": message,
        "camera_id": camera_id,
        "created_at": alert.created_at.isoformat(),
    }).encode("utf-8")
    req = urllib.request.Request(webhook_url, data=payload, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            log.info("webhook alert delivered (status %d)", resp.status)
    except Exception as exc:
        log.warning("webhook dispatch failed: %s", exc)


def raise_alert(kind: str, message: str, camera_id: str = "", snapshot=None) -> Alert:
    """Record what the admin must see, and email it. The row is the source of truth:
    mail can fail, the dashboard counter must not."""
    if snapshot is not None:
        snapshot.seek(0)  # the same crop was already saved on the log row
    alert = Alert.objects.create(
        kind=kind, message=message, camera_id=camera_id, snapshot=snapshot
    )

    # 1. Email notification
    if getattr(settings, "ALERT_EMAIL", None):
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

    # 2. Telegram Bot notification
    send_telegram_alert(alert, message, camera_id)

    # 3. Webhook notification
    send_webhook_alert(alert, message, camera_id)

    return alert

