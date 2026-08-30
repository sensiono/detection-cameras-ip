from __future__ import annotations

import base64
import logging
from typing import Protocol

import cv2
import numpy as np

from .config import CameraCfg, Config
from .confirm import Confirmer
from .events import EventSink
from .schemas import BBox, Event
from .stream import RTSPStream

log = logging.getLogger(__name__)

# (kind, subject, confidence, bbox) — the bbox is what makes the snapshot possible.
Sighting = tuple[str, str, float, BBox]


class Recognizer(Protocol):
    """One frame in, zero or more sightings out. Everything camera-, debounce- and
    delivery-related lives outside, so a recognizer stays testable with a plain
    numpy array."""

    def __call__(self, frame: np.ndarray) -> list[Sighting]: ...


class AttendanceRecognizer:
    def __init__(self, engine, index, threshold: float, liveness=None, live_threshold: float = 0.60):
        self._engine, self._index, self._threshold = engine, index, threshold
        self._liveness, self._live_threshold = liveness, live_threshold

    def __call__(self, frame) -> list[Sighting]:
        out: list[Sighting] = []
        for face in self._engine.detect(frame):
            # Liveness runs before matching, never after: a spoof must not be able
            # to reach the gallery at all, and rejecting early is also cheaper.
            if self._liveness is not None:
                live = self._liveness.score(frame, face.bbox)
                if live < self._live_threshold:
                    out.append(("spoof_attempt", "", 1.0 - live, face.bbox))
                    continue
            label, score = self._index.search(face.embedding, self._threshold)
            if label:
                out.append(("attendance", label, score, face.bbox))
            else:
                # A clearly detected face that matches nobody is the interesting case:
                # it is a stranger at the door, not a failure to report.
                out.append(("unknown_face", "", face.score, face.bbox))
        return out


class AnprRecognizer:
    def __init__(self, detector, ocr, min_ocr_score: float = 0.75):
        self._detector, self._ocr, self._min = detector, ocr, min_ocr_score

    def __call__(self, frame) -> list[Sighting]:
        out: list[Sighting] = []
        for bbox, det_score in self._detector.detect(frame):
            plate, ocr_score = self._ocr.read(frame, bbox)
            if plate and ocr_score >= self._min:
                out.append(("access", plate, det_score * ocr_score, bbox))
        return out


def crop_b64(frame: np.ndarray, bbox: BBox, pad: int = 12, max_width: int = 640) -> str | None:
    """JPEG crop around the detection, base64-encoded. A log line nobody can verify
    is worth little; this is the evidence attached to it."""
    h, w = frame.shape[:2]
    x1, y1, x2, y2 = bbox
    crop = frame[max(0, y1 - pad) : min(h, y2 + pad), max(0, x1 - pad) : min(w, x2 + pad)]
    if crop.size == 0:
        return None
    if crop.shape[1] > max_width:
        scale = max_width / crop.shape[1]
        crop = cv2.resize(crop, (max_width, int(crop.shape[0] * scale)))
    ok, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
    return base64.b64encode(buf).decode() if ok else None


def run_camera(camera: CameraCfg, recognizer: Recognizer, sink: EventSink, cfg: Config) -> None:
    """Blocking loop for a single camera. Run one process per camera: they are
    independent, and a crashing feed must not take the others down."""
    confirmer = Confirmer(cfg.confirm.votes, cfg.confirm.window_s, cfg.confirm.cooldown_s)
    log.info("camera %s started", camera.id)
    with RTSPStream(camera.url) as stream:
        for frame in stream.frames(stride=cfg.runtime.frame_stride):
            for kind, subject, confidence, bbox in recognizer(frame):
                # Unknowns share one key, so a stranger loitering raises one alert.
                if not confirmer.accept(f"{camera.id}:{kind}:{subject}"):
                    continue
                sink.emit(
                    Event(
                        kind=kind,
                        camera_id=camera.id,
                        subject=subject,
                        confidence=confidence,
                        snapshot=crop_b64(frame, bbox) if cfg.runtime.snapshots else None,
                    )
                )
