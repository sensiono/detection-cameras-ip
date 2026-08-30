from __future__ import annotations

from pathlib import Path

import numpy as np


class FaceIndex:
    """Gallery of enrolled people. Embeddings are unit vectors, so cosine similarity
    is a single matrix product — no FAISS needed below ~100k identities."""

    def __init__(self, labels: list[str] | None = None, matrix: np.ndarray | None = None):
        self.labels: list[str] = labels or []
        self.matrix: np.ndarray = (
            matrix if matrix is not None else np.zeros((0, 512), dtype=np.float32)
        )

    def add(self, label: str, embedding: np.ndarray) -> None:
        self.labels.append(label)
        self.matrix = np.vstack([self.matrix, embedding.astype(np.float32)[None, :]])

    def search(self, embedding: np.ndarray, threshold: float) -> tuple[str | None, float]:
        if not self.labels:
            return None, 0.0
        scores = self.matrix @ embedding
        i = int(np.argmax(scores))
        score = float(scores[i])
        return (self.labels[i], score) if score >= threshold else (None, score)

    def save(self, path: str | Path) -> None:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        np.savez_compressed(path, labels=np.array(self.labels), matrix=self.matrix)

    @classmethod
    def load(cls, path: str | Path) -> "FaceIndex":
        path = Path(path)
        if not path.exists():
            return cls()
        data = np.load(path, allow_pickle=False)
        return cls(labels=list(data["labels"]), matrix=data["matrix"])
