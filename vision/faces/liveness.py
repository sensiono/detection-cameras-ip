from __future__ import annotations

import logging
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort

from ..device import use_gpu
from ..schemas import BBox

log = logging.getLogger(__name__)

# MiniFASNet outputs 3 classes. Index 1 is the real face -- verified on the upstream
# labelled samples (image_T1 real -> 1.000 on class 1; image_F1/F2 spoof -> class 2).
# The HuggingFace ONNX card claims [live, print, replay] with live at 0; it is wrong.
REAL_INDEX = 1


def expand_bbox(bbox: BBox, scale: float, width: int, height: int) -> BBox:
    """Widen the face box by `scale`, keeping it centred and inside the frame.

    Anti-spoofing models are trained on a *context* crop, not on the face alone:
    the giveaway is usually the edge of the phone, the paper border or the moiré
    around the face, so cropping tight to the face throws away the evidence.

    When the frame is too small for the full context, the scale is **reduced** and
    the window **slid** back inside -- never clipped. Clipping changes the aspect
    ratio and moves the face off-centre, and the model, trained on centred crops,
    then calls every real face an attack. This mirrors `CropImage._get_new_box`
    in minivision-ai/Silent-Face-Anti-Spoofing, which is what the weights expect.
    """
    x1, y1, x2, y2 = bbox
    box_w, box_h = x2 - x1, y2 - y1
    if box_w <= 0 or box_h <= 0:
        return bbox
    # A box that does not overlap the frame at all would be *slid* inside by the
    # logic below and judged on some unrelated patch of wall -- which can come back
    # "live". Refuse it instead; the caller reads an empty crop as not-live.
    if x2 <= 0 or y2 <= 0 or x1 >= width or y1 >= height:
        return (0, 0, 0, 0)
    scale = min((height - 1) / box_h, (width - 1) / box_w, scale)
    new_w, new_h = box_w * scale, box_h * scale
    cx, cy = x1 + box_w / 2, y1 + box_h / 2

    left, top = cx - new_w / 2, cy - new_h / 2
    right, bottom = cx + new_w / 2, cy + new_h / 2
    if left < 0:
        right -= left
        left = 0
    if top < 0:
        bottom -= top
        top = 0
    if right > width - 1:
        left -= right - width + 1
        right = width - 1
    if bottom > height - 1:
        top -= bottom - height + 1
        bottom = height - 1
    return int(left), int(top), int(right), int(bottom)


def softmax(logits: np.ndarray) -> np.ndarray:
    shifted = logits - np.max(logits)
    exp = np.exp(shifted)
    return exp / exp.sum()


class LivenessChecker:
    """Passive anti-spoofing on a single frame.

    Without this, a photo held up to the camera marks its owner present: ArcFace
    compares faces, and a photo of a face *is* that face. Passive rather than a
    blink challenge because attendance has to work on people walking past.
    """

    def __init__(self, model_path: str | Path, scale: float = 2.7, gpu: bool = True):
        path = Path(model_path)
        if not path.exists():
            raise FileNotFoundError(
                f"modèle anti-spoofing introuvable : {path}. "
                "Téléchargez un modèle MiniFASNet ONNX, ou mettez "
                "faces.liveness.enabled à false en assumant le risque."
            )
        providers = ["CUDAExecutionProvider"] if use_gpu(gpu) else ["CPUExecutionProvider"]
        self._session = ort.InferenceSession(str(path), providers=providers)
        self._input = self._session.get_inputs()[0]
        # The model states its own input size; no need to configure it twice.
        _, _, self._height, self._width = self._input.shape
        self._scale = scale

    def score(self, frame: np.ndarray, bbox: BBox) -> float:
        """Probability that this face belongs to a real person in front of the lens."""
        height, width = frame.shape[:2]
        x1, y1, x2, y2 = expand_bbox(bbox, self._scale, width, height)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            return 0.0  # nothing to judge: treat as not live, never as live
        # Raw 0-255, NOT divided by 255: MiniFASNet's batch-norm statistics expect
        # that domain. Scaled to [0, 1] the network saturates and returns class 2
        # for every input, noise included -- a liveness gate that always says the
        # same thing, which is worse than none because it looks like it works.
        blob = cv2.resize(crop, (self._width, self._height)).astype(np.float32)
        blob = np.transpose(blob, (2, 0, 1))[None, ...]
        logits = self._session.run(None, {self._input.name: blob})[0][0]
        return float(softmax(logits)[REAL_INDEX])
