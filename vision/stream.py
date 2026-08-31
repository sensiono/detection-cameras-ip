from __future__ import annotations

import base64
import logging
import random
import threading
import time
from collections.abc import Callable, Iterator
from typing import Literal

import cv2
import numpy as np

log = logging.getLogger(__name__)

CircuitState = Literal["CLOSED", "OPEN", "HALF_OPEN"]


def frame_to_b64(frame: np.ndarray, max_width: int = 480) -> str | None:
    """Encode whole frame or downscaled version to base64 JPEG proof."""
    h, w = frame.shape[:2]
    if w > max_width:
        scale = max_width / w
        frame = cv2.resize(frame, (max_width, int(h * scale)))
    ok, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 75])
    return base64.b64encode(buf).decode() if ok else None


class RTSPStream:
    """Industrial RTSP client with Circuit Breaker, Exponential Backoff,
    Signal Loss watchdog, and real-time Anti-Tampering heuristics.
    """

    def __init__(
        self,
        url: str | int,
        camera_id: str = "camera",
        initial_backoff_s: float = 1.0,
        max_backoff_s: float = 30.0,
        backoff_multiplier: float = 2.0,
        signal_loss_threshold_s: float = 8.0,
        on_signal_loss: Callable[[str, float], None] | None = None,
        on_tamper: Callable[[str, str, np.ndarray | None], None] | None = None,
    ):
        self.url = url
        self.camera_id = camera_id
        self.initial_backoff_s = initial_backoff_s
        self.max_backoff_s = max_backoff_s
        self.backoff_multiplier = backoff_multiplier
        self.signal_loss_threshold_s = signal_loss_threshold_s

        self.on_signal_loss = on_signal_loss
        self.on_tamper = on_tamper

        self._frame: np.ndarray | None = None
        self._lock = threading.Lock()
        self._stop = threading.Event()

        # Circuit breaker states
        self.state: CircuitState = "CLOSED"
        self._current_backoff = self.initial_backoff_s
        self._last_healthy_frame_time = time.time()
        self._signal_loss_alerted = False

        # Anti-tampering tracking
        self._blackout_start: float | None = None
        self._glare_start: float | None = None
        self._last_tamper_alert_time: float = 0.0
        self._tamper_cooldown_s: float = 60.0

        self._thread = threading.Thread(target=self._loop, daemon=True)

    def __enter__(self) -> "RTSPStream":
        self._thread.start()
        return self

    def __exit__(self, *_) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def _open_capture(self, source: int | str) -> cv2.VideoCapture:
        import sys

        if isinstance(source, int) or str(source).isdigit():
            idx = int(source)
            if sys.platform.startswith("win"):
                cap = cv2.VideoCapture(idx, cv2.CAP_DSHOW)
                if cap.isOpened():
                    return cap
                cap.release()
            return cv2.VideoCapture(idx)
        elif str(source).startswith(("rtsp://", "rtsps://", "http://", "https://")):
            return cv2.VideoCapture(str(source), cv2.CAP_FFMPEG)
        else:
            return cv2.VideoCapture(source)

    def _loop(self) -> None:
        while not self._stop.is_set():
            source = int(self.url) if str(self.url).isdigit() else self.url
            is_file = isinstance(source, str) and not str(source).startswith(("rtsp://", "rtsps://", "http://", "https://"))
            log.info("[%s] Connecting to stream %s (state: %s)...", self.camera_id, self.url, self.state)
            
            cap = self._open_capture(source)
            if not is_file:
                cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)

            if not cap.isOpened():
                self._handle_disconnect()
                continue

            fps = cap.get(cv2.CAP_PROP_FPS) if is_file else 0
            frame_delay = (1.0 / max(fps, 1.0)) if (is_file and fps and 1.0 <= fps <= 120.0) else 0.0

            # Connected successfully -> probe frame
            self.state = "HALF_OPEN"
            consecutive_success = 0

            while not self._stop.is_set():
                ok, frame = cap.read()
                if not ok or frame is None or frame.size == 0:
                    if is_file:
                        # Seamlessly loop local video test files
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        ok, frame = cap.read()
                        if not ok or frame is None or frame.size == 0:
                            break
                    else:
                        break

                now = time.time()
                self._last_healthy_frame_time = now
                consecutive_success += 1

                if self.state != "CLOSED" and consecutive_success >= 5:
                    log.info("[%s] Stream stabilized, circuit CLOSED (nominal).", self.camera_id)
                    self.state = "CLOSED"
                    self._current_backoff = self.initial_backoff_s
                    self._signal_loss_alerted = False

                with self._lock:
                    self._frame = frame

                # Run anti-tampering heuristics every 10 frames
                if consecutive_success % 10 == 0:
                    self._check_tampering(frame, now)

                if is_file and frame_delay > 0:
                    time.sleep(frame_delay)

            cap.release()
            self._handle_disconnect()


    def _handle_disconnect(self) -> None:
        self.state = "OPEN"
        now = time.time()
        elapsed_down = now - self._last_healthy_frame_time

        if elapsed_down >= self.signal_loss_threshold_s and not self._signal_loss_alerted:
            self._signal_loss_alerted = True
            log.warning("[%s] WATCHDOG: Signal loss detected! Stream down for %.1fs", self.camera_id, elapsed_down)
            if self.on_signal_loss:
                try:
                    self.on_signal_loss(self.camera_id, elapsed_down)
                except Exception as exc:
                    log.error("[%s] Error in signal loss callback: %s", self.camera_id, exc)

        # Exponential backoff with jitter: sleep = backoff * (0.8 + 0.4 * random)
        jitter = 0.8 + 0.4 * random.random()
        sleep_time = min(self.max_backoff_s, self._current_backoff * jitter)
        log.warning(
            "[%s] Stream %s unavailable. Circuit OPEN, retrying in %.2fs (backoff factor: %.1fs)",
            self.camera_id, self.url, sleep_time, self._current_backoff,
        )
        self._current_backoff = min(self.max_backoff_s, self._current_backoff * self.backoff_multiplier)
        time.sleep(sleep_time)

    def _check_tampering(self, frame: np.ndarray, now: float) -> None:
        """Inspects frame luminance and variance to detect physical tampering."""
        # 160x120 fast grayscale calculation
        small = cv2.resize(frame, (160, 120), interpolation=cv2.INTER_NEAREST)
        gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)

        mean_val = float(np.mean(gray))
        var_val = float(np.var(gray))

        # 1. Blackout / Covered lens (pitch black or physical obstruction)
        if mean_val < 12.0 and var_val < 8.0:
            if self._blackout_start is None:
                self._blackout_start = now
            elif (now - self._blackout_start) >= 4.0:
                self._raise_tamper_alert("Lentille masquée ou obscurcie (noir complet)", frame, now)
        else:
            self._blackout_start = None

        # 2. Flashlight / Laser Blinding (extreme glare)
        if mean_val > 242.0 and var_val < 18.0:
            if self._glare_start is None:
                self._glare_start = now
            elif (now - self._glare_start) >= 4.0:
                self._raise_tamper_alert("Éblouissement / Saturation lumineuse anormale", frame, now)
        else:
            self._glare_start = None

    def _raise_tamper_alert(self, reason: str, frame: np.ndarray, now: float) -> None:
        if now - self._last_tamper_alert_time < self._tamper_cooldown_s:
            return
        self._last_tamper_alert_time = now
        log.error("[%s] SECURITY ALERT: Camera tampering detected! %s", self.camera_id, reason)
        if self.on_tamper:
            try:
                self.on_tamper(self.camera_id, reason, frame)
            except Exception as exc:
                log.error("[%s] Error in tamper callback: %s", self.camera_id, exc)

    def frames(
        self,
        stride: int = 1,
        adaptive: bool = False,
        idle_stride: int = 10,
        motion_threshold: float = 0.02,
    ) -> Iterator[np.ndarray]:
        """Yield the newest frame."""
        last: np.ndarray | None = None
        prev_gray: np.ndarray | None = None
        i = 0
        current_stride = stride

        while not self._stop.is_set():
            with self._lock:
                frame = self._frame
            if frame is None or frame is last:
                time.sleep(0.005)
                continue
            last = frame

            if adaptive:
                small = cv2.resize(
                    cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY), (160, 120), interpolation=cv2.INTER_NEAREST
                )
                if prev_gray is not None:
                    motion_level = float(np.mean(cv2.absdiff(small, prev_gray)) / 255.0)
                    current_stride = stride if motion_level >= motion_threshold else idle_stride
                prev_gray = small
            else:
                current_stride = stride

            i += 1
            if i % current_stride == 0:
                yield frame
