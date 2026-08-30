from __future__ import annotations

import numpy as np
from ultralytics import YOLO

from ..config import PlatesCfg
from ..device import use_gpu
from ..schemas import BBox


class PlateDetector:
    """YOLO fine-tuned on license plates. Detecting the plate directly (instead of
    car -> plate) halves the pipeline and loses nothing at gate distances."""

    def __init__(self, cfg: PlatesCfg, gpu: bool = True):
        self._model = YOLO(str(cfg.weights))
        self._conf = cfg.conf
        self._device = 0 if use_gpu(gpu) else "cpu"

    def detect(self, frame: np.ndarray) -> list[tuple[BBox, float]]:
        result = self._model.predict(
            frame, conf=self._conf, device=self._device, verbose=False
        )[0]
        boxes = result.boxes
        return [
            (tuple(int(v) for v in xyxy), float(conf))
            for xyxy, conf in zip(boxes.xyxy.tolist(), boxes.conf.tolist())
        ]
