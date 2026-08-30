from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

from .engine import FaceEngine
from .index import FaceIndex


def enroll_directory(engine: FaceEngine, root: str | Path) -> FaceIndex:
    """Build the gallery from `root/<user_id>/*.jpg`.

    Several photos per person are averaged: that single line buys most of the
    robustness to lighting and pose you would otherwise chase with augmentation.
    """
    index = FaceIndex()
    for person_dir in sorted(Path(root).iterdir()):
        if not person_dir.is_dir():
            continue
        vectors = []
        for img_path in sorted(person_dir.glob("*.[jp][pn]g")):
            image = cv2.imread(str(img_path))
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
