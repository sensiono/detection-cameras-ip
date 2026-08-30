"""Measuring the two models on your own photos.

The numbers the cahier asks for in § 7 (« haute précision > 90 % ») are not a claim,
they are a measurement, and these two functions are how you produce them.
"""
from __future__ import annotations

import xml.etree.ElementTree as ET
from dataclasses import dataclass
from pathlib import Path

import cv2
import numpy as np

from .plates.normalize import is_recognised, normalize

IMAGES = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.JPEG", "*.PNG")


def images_in(folder: str | Path) -> list[Path]:
    root = Path(folder)
    return sorted(p for pattern in IMAGES for p in root.glob(pattern))


def expected_plate(path: Path) -> str | None:
    """Ground truth comes from the file name: `159TN8950.jpg`, or `159TN8950_2.jpg`
    for a second shot of the same car. Renaming a photo is the whole annotation
    process — no labelling tool, no CSV to keep in sync.

    A camera-generated name like `IMG4021.jpg` is *unlabelled*, not a plate: counting
    it as a wrong answer would invent errors the model never made.
    """
    candidate = normalize(path.stem.split("_")[0].split("-")[0])
    return candidate if is_recognised(candidate) else None


@dataclass
class PlateResult:
    path: Path
    expected: str | None
    detected: bool
    read: str | None
    confidence: float

    @property
    def correct(self) -> bool:
        return self.expected is not None and self.read == self.expected


def evaluate_plates(detector, ocr, folder: str | Path) -> list[PlateResult]:
    """Detect and read every photo in `folder`, one result per file."""
    results = []
    for path in images_in(folder):
        image = cv2.imread(str(path))
        if image is None:
            continue
        boxes = detector.detect(image)
        if not boxes:
            results.append(PlateResult(path, expected_plate(path), False, None, 0.0))
            continue
        # Several plates in one photo: keep the most confident detection.
        bbox, _ = max(boxes, key=lambda b: b[1])
        text, score = ocr.read(image, bbox)
        results.append(PlateResult(path, expected_plate(path), True, text, score))
    return results


def parse_voc(path: Path) -> list[tuple[int, int, int, int]]:
    """Boxes from a Pascal VOC .xml — the format LabelImg and most public plate
    datasets export."""
    root = ET.parse(path).getroot()
    boxes = []
    for obj in root.findall("object"):
        box = obj.find("bndbox")
        boxes.append(tuple(int(float(box.find(k).text)) for k in ("xmin", "ymin", "xmax", "ymax")))
    return boxes


def iou(a: tuple[int, ...], b: tuple[int, ...]) -> float:
    """Intersection over union. 1.0 is a perfect box, 0.0 no overlap at all."""
    ix1, iy1 = max(a[0], b[0]), max(a[1], b[1])
    ix2, iy2 = min(a[2], b[2]), min(a[3], b[3])
    inter = max(0, ix2 - ix1) * max(0, iy2 - iy1)
    if not inter:
        return 0.0
    area_a = (a[2] - a[0]) * (a[3] - a[1])
    area_b = (b[2] - b[0]) * (b[3] - b[1])
    return inter / (area_a + area_b - inter)


@dataclass
class DetectionTotals:
    images: int = 0
    truth: int = 0
    predicted: int = 0
    matched: int = 0
    iou_sum: float = 0.0

    @property
    def recall(self) -> float:
        return self.matched / self.truth if self.truth else 0.0

    @property
    def precision(self) -> float:
        return self.matched / self.predicted if self.predicted else 0.0

    @property
    def mean_iou(self) -> float:
        return self.iou_sum / self.matched if self.matched else 0.0


def evaluate_detection(detector, folder: str | Path, iou_threshold: float = 0.5):
    """Score the plate detector against Pascal VOC ground truth.

    Recall is the number that matters at a gate: a plate that is never detected can
    never be read, while a spurious box costs one wasted OCR call.
    """
    totals = DetectionTotals()
    misses = []
    for image_path in images_in(folder):
        xml_path = image_path.with_suffix(".xml")
        if not xml_path.exists():
            continue
        truth = parse_voc(xml_path)
        image = cv2.imread(str(image_path))
        if image is None or not truth:
            continue
        predicted = [bbox for bbox, _ in detector.detect(image)]
        totals.images += 1
        totals.truth += len(truth)
        totals.predicted += len(predicted)

        unused = list(predicted)
        hit = 0
        for gt in truth:
            if not unused:
                break
            best = max(unused, key=lambda p: iou(gt, p))
            score = iou(gt, best)
            if score >= iou_threshold:
                totals.matched += 1
                totals.iou_sum += score
                unused.remove(best)
                hit += 1
        if hit < len(truth):
            misses.append(image_path.name)
    return totals, misses


@dataclass
class FaceScores:
    genuine: np.ndarray   # similarities between photos of the same person
    impostor: np.ndarray  # ...and between photos of different people

    def rates(self, threshold: float) -> tuple[float, float]:
        """(FAR, FRR) at a threshold: wrongly accepted impostors, wrongly rejected
        genuine users. Lowering the threshold trades one for the other — there is no
        setting that removes both, which is the point worth making in the report."""
        far = float(np.mean(self.impostor >= threshold)) if self.impostor.size else 0.0
        frr = float(np.mean(self.genuine < threshold)) if self.genuine.size else 0.0
        return far, frr

    def best_threshold(self, grid: np.ndarray | None = None) -> tuple[float, float, float]:
        """Equal Error Rate point: where FAR and FRR cross. A defensible default when
        you have no reason to prefer one kind of mistake over the other."""
        grid = grid if grid is not None else np.arange(0.20, 0.80, 0.01)
        rates = {float(t): self.rates(float(t)) for t in grid}
        best = min((abs(a - b), a + b) for a, b in rates.values())
        # When the two distributions are well separated, a whole band of thresholds
        # scores identically. Take the middle of that band: the furthest point from
        # both kinds of mistake, rather than whichever end the loop happened to hit.
        band = [t for t, (a, b) in rates.items() if (abs(a - b), a + b) == best]
        threshold = float(np.median(band))
        return threshold, *self.rates(threshold)


def score_gallery(engine, folder: str | Path) -> FaceScores:
    """Enrol half of each person's photos, score the other half against everyone.

    Testing on the photos you enrolled measures nothing: the model would score a
    perfect 100 % by recognising images it has already stored.
    """
    enrolled: dict[str, np.ndarray] = {}
    probes: list[tuple[str, np.ndarray]] = []

    for person in sorted(p for p in Path(folder).iterdir() if p.is_dir()):
        vectors = []
        for path in images_in(person):
            image = cv2.imread(str(path))
            if image is None:
                continue
            faces = engine.detect(image)
            if len(faces) == 1:
                vectors.append(faces[0].embedding)
        if len(vectors) < 2:
            continue  # one photo cannot be both enrolled and tested
        half = max(1, len(vectors) // 2)
        mean = np.mean(vectors[:half], axis=0)
        enrolled[person.name] = mean / np.linalg.norm(mean)
        probes.extend((person.name, v) for v in vectors[half:])

    genuine, impostor = [], []
    for name, probe in probes:
        for other, reference in enrolled.items():
            (genuine if other == name else impostor).append(float(reference @ probe))
    return FaceScores(np.array(genuine), np.array(impostor))
