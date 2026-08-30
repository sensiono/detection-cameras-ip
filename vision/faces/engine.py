from __future__ import annotations

import numpy as np
from insightface.app import FaceAnalysis

from ..config import FacesCfg
from ..device import use_gpu
from ..schemas import FaceDetection


class FaceEngine:
    """Detection + 512-d ArcFace embedding in one pass (InsightFace buffalo_l).

    No training happens here. Recognition is metric learning: the pretrained model
    already maps any face to a vector, so enrolling a person = storing one vector.
    """

    def __init__(self, cfg: FacesCfg, gpu: bool = True):
        gpu = use_gpu(gpu)
        providers = ["CUDAExecutionProvider"] if gpu else ["CPUExecutionProvider"]
        self._app = FaceAnalysis(name=cfg.model, providers=providers)
        self._app.prepare(ctx_id=0 if gpu else -1, det_size=(cfg.det_size, cfg.det_size))
        self._min_score = cfg.min_det_score

    def detect(self, frame: np.ndarray) -> list[FaceDetection]:
        out = []
        for f in self._app.get(frame):
            if f.det_score < self._min_score:
                continue  # blurry or extreme-profile faces cause most false matches
            out.append(
                FaceDetection(
                    bbox=tuple(int(v) for v in f.bbox),
                    score=float(f.det_score),
                    embedding=f.normed_embedding.astype(np.float32),
                )
            )
        return out
