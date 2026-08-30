from __future__ import annotations

import logging
import threading
import time
from collections.abc import Iterator

import cv2
import numpy as np

log = logging.getLogger(__name__)


class RTSPStream:
    """Reads an RTSP feed in a background thread and always exposes the *latest* frame.

    `url` is anything OpenCV opens: an rtsp:// URL, a video file, or a digit for a
    local webcam — so the pipeline can be developed and demoed without the camera.

    Decoding in a thread is what keeps the pipeline real-time: if inference is slower
    than the camera, old frames are dropped instead of queued.
    """

    def __init__(self, url: str, reconnect_s: float = 3.0):
        self.url = url
        self.reconnect_s = reconnect_s
        self._frame: np.ndarray | None = None
        self._lock = threading.Lock()
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._loop, daemon=True)

    def __enter__(self) -> "RTSPStream":
        self._thread.start()
        return self

    def __exit__(self, *_) -> None:
        self._stop.set()
        self._thread.join(timeout=5)

    def _loop(self) -> None:
        while not self._stop.is_set():
            source = int(self.url) if str(self.url).isdigit() else self.url
            cap = cv2.VideoCapture(source, cv2.CAP_FFMPEG)
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
            if not cap.isOpened():
                log.warning("cannot open %s, retrying", self.url)
                time.sleep(self.reconnect_s)
                continue
            while not self._stop.is_set():
                ok, frame = cap.read()
                if not ok:
                    break
                with self._lock:
                    self._frame = frame
            cap.release()
            log.warning("stream %s dropped, reconnecting", self.url)
            time.sleep(self.reconnect_s)

    def frames(self, stride: int = 1) -> Iterator[np.ndarray]:
        """Yield the newest frame, skipping `stride - 1` out of every `stride`."""
        last: np.ndarray | None = None
        i = 0
        while not self._stop.is_set():
            with self._lock:
                frame = self._frame
            if frame is None or frame is last:
                time.sleep(0.005)
                continue
            last = frame
            i += 1
            if i % stride == 0:
                yield frame
