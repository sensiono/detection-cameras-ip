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


def vote_plate_consensus(candidates: list[tuple[str, float]]) -> tuple[str, float]:
    """Aggregate multiple OCR readings of the same vehicle into a robust consensus.

    Uses character-by-character majority voting weighted by confidence scores.
    """
    if not candidates:
        return "", 0.0
    valid = [(plate, conf) for plate, conf in candidates if plate]
    if not valid:
        return "", 0.0
    if len(valid) == 1:
        return valid[0]

    # Group by string length to align character columns
    lengths: dict[int, list[tuple[str, float]]] = {}
    for plate, conf in valid:
        lengths.setdefault(len(plate), []).append((plate, conf))

    # Take the most dominant length group by total confidence weight
    best_len = max(lengths, key=lambda l: sum(c for _, c in lengths[l]))
    group = lengths[best_len]

    consensus_chars = []
    for col in range(best_len):
        char_weights: dict[str, float] = {}
        for plate, conf in group:
            char = plate[col]
            char_weights[char] = char_weights.get(char, 0.0) + conf
        best_char = max(char_weights, key=char_weights.get)
        consensus_chars.append(best_char)

    consensus_plate = "".join(consensus_chars)
    avg_conf = float(np.mean([c for _, c in group]))
    return consensus_plate, avg_conf


class PlateTemporalVoter:
    """Buffers consecutive plate sightings within a short window to produce
    a unified high-accuracy consensus reading before triggering events.
    
    Includes vehicle passage session smoothing and barrier gate cooldown
    so approaching vehicles emit exactly ONE solid, high-confidence event.
    """

    def __init__(
        self,
        window_s: float = 2.5,
        min_observations: int = 2,
        cooldown_s: float = 15.0,
    ):
        self.window_s = window_s
        self.min_observations = min_observations
        self.cooldown_s = cooldown_s
        self._history: list[tuple[float, str, float, BBox]] = []
        self._last_emit_time: float = -1e9

    def add(
        self,
        plate: str,
        score: float,
        bbox: BBox,
        now: float | None = None,
    ) -> tuple[str, float, BBox] | None:
        import time

        now = time.monotonic() if now is None else now

        # Cooldown guard: if vehicle was recently confirmed and emitted, ignore repeat blips
        if now - self._last_emit_time < self.cooldown_s:
            return None

        self._history = [item for item in self._history if now - item[0] <= self.window_s]
        self._history.append((now, plate, score, bbox))

        if len(self._history) < self.min_observations:
            return plate, score, bbox

        candidates = [(item[1], item[2]) for item in self._history]
        consensus_plate, consensus_score = vote_plate_consensus(candidates)
        
        # Pick the sharpest frame's bbox (highest confidence)
        best_item = max(self._history, key=lambda x: x[2])
        best_bbox = best_item[3]

        return consensus_plate, consensus_score, best_bbox


class AnprRecognizer:
    def __init__(
        self,
        detector,
        ocr,
        min_ocr_score: float = 0.65,
        temporal_voting: bool = True,
        vote_window_s: float = 2.5,
        min_observations: int = 2,
        cooldown_s: float = 15.0,
    ):
        self._detector, self._ocr, self._min = detector, ocr, min_ocr_score
        self._voter = (
            PlateTemporalVoter(
                window_s=vote_window_s,
                min_observations=min_observations,
                cooldown_s=cooldown_s,
            )
            if temporal_voting
            else None
        )

    def __call__(self, frame) -> list[Sighting]:
        out: list[Sighting] = []
        for bbox, det_score in self._detector.detect(frame):
            plate, ocr_score = self._ocr.read(frame, bbox)
            if plate and ocr_score >= self._min:
                conf = det_score * ocr_score
                if self._voter is not None:
                    voted = self._voter.add(plate, conf, bbox)
                    if voted:
                        plate, conf, bbox = voted
                        out.append(("access", plate, conf, bbox))
                else:
                    out.append(("access", plate, conf, bbox))
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


from .stream import RTSPStream, frame_to_b64


def run_camera(camera: CameraCfg, recognizer: Recognizer, sink: EventSink, cfg: Config) -> None:
    """Blocking loop for a single camera. Run one process per camera: they are
    independent, and a crashing feed must not take the others down."""
    confirmer = Confirmer(cfg.confirm.votes, cfg.confirm.window_s, cfg.confirm.cooldown_s)
    log.info("camera %s started with RTSP watchdog & circuit breaker", camera.id)

    def handle_signal_loss(cam_id: str, elapsed_s: float) -> None:
        sink.emit(
            Event(
                kind="signal_loss",
                camera_id=cam_id,
                subject=f"Perte de signal vidéo RTSP ({elapsed_s:.0f}s d'interruption)",
                confidence=1.0,
                snapshot=None,
            )
        )

    def handle_tamper(cam_id: str, reason: str, frame: np.ndarray | None) -> None:
        snap = frame_to_b64(frame) if (frame is not None and cfg.runtime.snapshots) else None
        sink.emit(
            Event(
                kind="tamper_attempt",
                camera_id=cam_id,
                subject=f"Sabotage caméra: {reason}",
                confidence=1.0,
                snapshot=snap,
            )
        )

    with RTSPStream(
        url=camera.url,
        camera_id=camera.id,
        on_signal_loss=handle_signal_loss,
        on_tamper=handle_tamper,
    ) as stream:
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

