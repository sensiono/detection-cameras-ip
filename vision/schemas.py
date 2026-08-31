from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Literal

import numpy as np

BBox = tuple[int, int, int, int]  # x1, y1, x2, y2


@dataclass(slots=True)
class FaceDetection:
    bbox: BBox
    score: float
    embedding: np.ndarray  # L2-normalised, shape (512,)


@dataclass(slots=True)
class PlateDetection:
    bbox: BBox
    score: float
    text: str
    ocr_score: float


@dataclass(slots=True)
class Event:
    """The only thing this service sends to the backend."""

    kind: Literal[
        "attendance", "access", "unknown_face", "spoof_attempt", "signal_loss", "tamper_attempt"
    ]

    camera_id: str
    subject: str  # user id (attendance), plate string (access), empty if unknown
    confidence: float
    at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    snapshot: str | None = None  # base64 JPEG crop, evidence for the log row

    def as_payload(self) -> dict:
        payload = {
            "kind": self.kind,
            "camera_id": self.camera_id,
            "subject": self.subject,
            "confidence": round(self.confidence, 4),
            "at": self.at.isoformat(),
        }
        if self.snapshot:
            payload["snapshot"] = self.snapshot
        return payload
