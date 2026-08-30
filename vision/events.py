from __future__ import annotations

import logging
from typing import Protocol

import httpx

from .config import SinkCfg
from .schemas import Event

log = logging.getLogger(__name__)


class EventSink(Protocol):
    def emit(self, event: Event) -> None: ...


class LogSink:
    """Used in tests and during model tuning, so the AI part runs without Django."""

    def emit(self, event: Event) -> None:
        log.info("EVENT %s", event.as_payload())


class HttpSink:
    """Posts to the Django REST endpoint. The DB is never touched from here:
    one owner per table keeps the two codebases independent."""

    def __init__(self, cfg: SinkCfg):
        self._client = httpx.Client(
            base_url=cfg.url,
            headers={"Authorization": f"Token {cfg.token}"},
            timeout=cfg.timeout_s,
        )

    def emit(self, event: Event) -> None:
        try:
            self._client.post("", json=event.as_payload()).raise_for_status()
        except httpx.HTTPError as exc:  # never let the backend stall the cameras
            log.error("sink failed for %s: %s", event.subject, exc)
