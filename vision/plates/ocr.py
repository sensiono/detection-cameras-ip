from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from fast_plate_ocr import LicensePlateRecognizer

from ..device import use_gpu
from ..schemas import BBox
from .normalize import normalize


class PlateOCR:
    """Plate-specific OCR. A general OCR engine is both slower and worse here,
    because plate models are trained on the exact fonts and aspect ratios."""

    def __init__(self, model: str, gpu: bool = True, config: "Path | None" = None):
        device = "cuda" if use_gpu(gpu) else "cpu"
        if str(model).endswith(".onnx"):
            # A model fine-tuned on local plates: it carries its own alphabet, so the
            # config file is not optional.
            if config is None:
                raise ValueError("un modèle .onnx local exige plates.ocr_config")
            self._ocr = LicensePlateRecognizer(
                onnx_model_path=model, plate_config_path=config, device=device
            )
        else:
            self._ocr = LicensePlateRecognizer(model, device=device)
        # The model states the colour space it was trained on; converting to the
        # wrong one silently costs accuracy instead of raising.
        self._grayscale = self._ocr.config.image_color_mode != "rgb"

    def read(self, frame: np.ndarray, bbox: BBox, pad: int = 4) -> tuple[str | None, float]:
        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]
        crop = frame[max(0, y1 - pad) : min(h, y2 + pad), max(0, x1 - pad) : min(w, x2 + pad)]
        if crop.size == 0:
            return None, 0.0
        code = cv2.COLOR_BGR2GRAY if self._grayscale else cv2.COLOR_BGR2RGB
        prediction = self._ocr.run(cv2.cvtColor(crop, code), return_confidence=True)[0]
        if prediction.char_probs is None:
            return normalize(prediction.plate), 0.0
        return normalize(prediction.plate), float(np.mean(prediction.char_probs))
