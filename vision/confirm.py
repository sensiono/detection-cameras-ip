from __future__ import annotations

import time
from collections import defaultdict, deque


class Confirmer:
    """Turns a noisy per-frame stream of identities into clean, de-duplicated events.

    Two guards, and they replace a full tracker for this use case:
      * vote  — the same identity must be seen `votes` times within `window_s`
                (kills one-off false matches);
      * cooldown — once emitted, that identity is muted for `cooldown_s`
                (one attendance row per person, not one per frame).
    """

    def __init__(self, votes: int = 3, window_s: float = 5.0, cooldown_s: float = 300.0):
        self.votes = votes
        self.window_s = window_s
        self.cooldown_s = cooldown_s
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._last_emit: dict[str, float] = {}

    def accept(self, key: str, now: float | None = None) -> bool:
        now = now if now is not None else time.monotonic()
        if now - self._last_emit.get(key, -1e9) < self.cooldown_s:
            return False
        hits = self._hits[key]
        hits.append(now)
        while hits and now - hits[0] > self.window_s:
            hits.popleft()
        if len(hits) < self.votes:
            return False
        hits.clear()
        self._last_emit[key] = now
        return True
