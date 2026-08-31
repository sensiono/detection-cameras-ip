from __future__ import annotations

import json
import logging
import queue
import threading

log = logging.getLogger(__name__)


class EventBus:
    """Thread-safe Pub/Sub event bus for Server-Sent Events (SSE)."""

    def __init__(self) -> None:
        self._subscribers: list[queue.Queue] = []
        self._lock = threading.Lock()

    def subscribe(self) -> queue.Queue:
        q: queue.Queue = queue.Queue(maxsize=100)
        with self._lock:
            self._subscribers.append(q)
            log.info("SSE client connected. Active subscribers: %d", len(self._subscribers))
        return q

    def unsubscribe(self, q: queue.Queue) -> None:
        with self._lock:
            if q in self._subscribers:
                self._subscribers.remove(q)
                log.info("SSE client disconnected. Active subscribers: %d", len(self._subscribers))

    def broadcast(self, event_type: str, payload: dict) -> None:
        msg = f"event: {event_type}\ndata: {json.dumps(payload, default=str)}\n\n"
        with self._lock:
            dead: list[queue.Queue] = []
            for q in self._subscribers:
                try:
                    q.put_nowait(msg)
                except queue.Full:
                    dead.append(q)
            for q in dead:
                self._subscribers.remove(q)


event_bus = EventBus()
