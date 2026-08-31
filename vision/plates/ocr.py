from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from fast_plate_ocr import LicensePlateRecognizer

from ..device import use_gpu
from ..schemas import BBox
from .normalize import normalize



def apply_clahe(image: np.ndarray, clip_limit: float = 2.0, grid_size: tuple[int, int] = (8, 8)) -> np.ndarray:
    """Enhance contrast adaptively, ideal for low-light, night IR, or harsh sunlight."""
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=grid_size)
    if len(image.shape) == 2:
        return clahe.apply(image)
    lab = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    l_clahe = clahe.apply(l)
    return cv2.cvtColor(cv2.merge((l_clahe, a, b)), cv2.COLOR_LAB2BGR)


class PlateOCR:
    """Plate-specific OCR with Dual-Pass Engine:
    - Primary: Specialized Tunisian civil plate model (`models/tn_ocr.onnx`)
    - Extended/Alphanumeric: Global A-Z model (`cct-s-v2-global-model`) for RS (Régime Suspensif), CD, MD, and foreign formats.
    """

    def __init__(
        self,
        model: str,
        gpu: bool = True,
        config: "Path | None" = None,
        enhance_contrast: bool = False,
        enable_global_fallback: bool = True,
    ):
        device = "cuda" if use_gpu(gpu) else "cpu"
        self._device = device
        self._enhance_contrast = enhance_contrast
        self._enable_global_fallback = enable_global_fallback

        if str(model).endswith(".onnx"):
            # A model fine-tuned on local plates: carries its own alphabet
            if config is None:
                raise ValueError("un modèle .onnx local exige plates.ocr_config")
            self._ocr = LicensePlateRecognizer(
                onnx_model_path=model, plate_config_path=config, device=device
            )
            self._global_ocr = (
                LicensePlateRecognizer("cct-s-v2-global-model", device=device)
                if enable_global_fallback
                else None
            )
        else:
            self._ocr = LicensePlateRecognizer(model, device=device)
            self._global_ocr = None

        self._grayscale = self._ocr.config.image_color_mode != "rgb"

    def read(
        self, frame: np.ndarray, bbox: BBox, pad: int = 4, enhance: bool | None = None
    ) -> tuple[str | None, float]:
        x1, y1, x2, y2 = bbox
        h, w = frame.shape[:2]
        crop = frame[max(0, y1 - pad) : min(h, y2 + pad), max(0, x1 - pad) : min(w, x2 + pad)]
        if crop.size == 0:
            return None, 0.0

        if enhance or (enhance is None and self._enhance_contrast):
            crop = apply_clahe(crop)

        # 1. Run specialized TN civil model
        code = cv2.COLOR_BGR2GRAY if self._grayscale else cv2.COLOR_BGR2RGB
        pred_tn = self._ocr.run(cv2.cvtColor(crop, code), return_confidence=True)[0]
        plate_tn = normalize(pred_tn.plate)
        conf_tn = float(np.mean(pred_tn.char_probs)) if pred_tn.char_probs is not None else 0.0

        # 2. If global fallback is enabled, evaluate full alphanumeric A-Z model
        if self._global_ocr is not None:
            pred_g = self._global_ocr.run(crop, return_confidence=True)[0]
            plate_g = normalize(pred_g.plate)
            conf_g = float(np.mean(pred_g.char_probs)) if pred_g.char_probs is not None else 0.0

            # If global model detects RS (Régime Suspensif), CD, MD, or special format -> prefer global
            from .normalize import _TN_ADMIN
            if plate_g and _TN_ADMIN.match(plate_g):
                return plate_g, conf_g

            # If TN model yielded no valid match or global has higher confidence on valid plate
            if not plate_tn and plate_g:
                return plate_g, conf_g
            if plate_g and conf_g > (conf_tn + 0.10):
                return plate_g, conf_g

        return plate_tn, conf_tn


