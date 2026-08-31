from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from .engine import FaceEngine
from .index import FaceIndex

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def _read_image(path: Path | str) -> np.ndarray | None:
    """Robust image loader supporting Unicode/accented paths on Windows."""
    try:
        data = np.fromfile(str(path), dtype=np.uint8)
        if data.size == 0:
            return None
        return cv2.imdecode(data, cv2.IMREAD_COLOR)
    except Exception:
        return None


def enroll_directory(engine: FaceEngine, root: str | Path) -> FaceIndex:
    """Build the gallery from `root/<user_id>/*`.

    Several photos per person are averaged: that single line buys most of the
    robustness to lighting and pose you would otherwise chase with augmentation.
    """
    index = FaceIndex()
    for person_dir in sorted(Path(root).iterdir()):
        if not person_dir.is_dir():
            continue
        vectors = []
        image_files = sorted(
            p for p in person_dir.iterdir() if p.is_file() and p.suffix.lower() in VALID_EXTENSIONS
        )
        for img_path in image_files:
            image = _read_image(img_path)
            if image is None:
                continue
            faces = engine.detect(image)
            if len(faces) != 1:
                continue  # enrolment photos must contain exactly one face
            vectors.append(faces[0].embedding)
        if not vectors:
            continue
        mean = np.mean(vectors, axis=0)
        index.add(person_dir.name, mean / np.linalg.norm(mean))
    return index

