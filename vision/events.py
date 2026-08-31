from __future__ import annotations

import json
import logging
import sqlite3
import threading
import time
from pathlib import Path
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
    """Posts to the Django REST endpoint with automatic local SQLite store-and-forward
    buffering so zero events are lost during transient network or backend outages."""

    def __init__(self, cfg: SinkCfg, queue_path: str | Path | None = None):
        self._url = cfg.url
        self._token = cfg.token
        self._timeout = cfg.timeout_s
        self._client = httpx.Client(
            base_url=self._url,
            headers={"Authorization": f"Token {self._token}"},
            timeout=self._timeout,
        )
        self._queue_path = Path(queue_path) if queue_path else Path("data/events_buffer.sqlite")
        self._lock = threading.Lock()
        self._init_queue()

        self._stop = threading.Event()
        self._flusher_thread = threading.Thread(target=self._flusher_loop, daemon=True)
        self._flusher_thread.start()

    def _init_queue(self) -> None:
        self._queue_path.parent.mkdir(parents=True, exist_ok=True)
        with self._lock:
            conn = sqlite3.connect(self._queue_path)
            try:
                conn.execute(
                    """
                    CREATE TABLE IF NOT EXISTS pending_events (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        payload TEXT NOT NULL,
                        created_at REAL NOT NULL
                    )
                    """
                )
                conn.commit()
            finally:
                conn.close()

    def _enqueue(self, payload: dict) -> None:
        with self._lock:
            conn = sqlite3.connect(self._queue_path)
            try:
                conn.execute(
                    "INSERT INTO pending_events (payload, created_at) VALUES (?, ?)",
                    (json.dumps(payload), time.time()),
                )
                conn.commit()
            finally:
                conn.close()
        log.info("event buffered locally (pending queue size: %d)", self.pending_count())

    def pending_count(self) -> int:
        with self._lock:
            conn = sqlite3.connect(self._queue_path)
            try:
                cursor = conn.execute("SELECT COUNT(*) FROM pending_events")
                return cursor.fetchone()[0]
            finally:
                conn.close()

    def flush(self) -> int:
        """Attempt to drain buffered events to the backend."""
        drained = 0
        with self._lock:
            conn = sqlite3.connect(self._queue_path)
            try:
                rows = conn.execute("SELECT id, payload FROM pending_events ORDER BY id ASC LIMIT 50").fetchall()
                for row_id, payload_str in rows:
                    try:
                        payload = json.loads(payload_str)
                        self._client.post("", json=payload).raise_for_status()
                        conn.execute("DELETE FROM pending_events WHERE id = ?", (row_id,))
                        conn.commit()
                        drained += 1
                    except Exception as exc:
                        log.warning("failed to flush buffered event %d: %s", row_id, exc)
                        break
            finally:
                conn.close()
        return drained


    def _flusher_loop(self) -> None:
        while not self._stop.is_set():
            time.sleep(5.0)
            if self.pending_count() > 0:
                self.flush()

    def emit(self, event: Event) -> None:
        payload = event.as_payload()
        try:
            self._client.post("", json=payload).raise_for_status()
        except httpx.HTTPError as exc:
            log.error("sink failed for %s (%s); spooling to local queue", event.subject, exc)
            self._enqueue(payload)

    def close(self) -> None:
        self._stop.set()
        if self._flusher_thread.is_alive():
            self._flusher_thread.join(timeout=1.0)
        self._client.close()

    def __enter__(self) -> "HttpSink":
        return self

    def __exit__(self, *_) -> None:
        self.close()


