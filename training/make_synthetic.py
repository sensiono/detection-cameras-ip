#!/usr/bin/env python3
"""Synthesise Tunisian civil plates from real plate pixels.

197 hand-labelled crops is thin for training an OCR. Rather than render plates with
a font that is not the plate font, this composes them from real glyphs cut out of
real Tunisian plates: the digits come from the Kaggle digit set, the word تونس from
crops of photographs. Every pixel of a synthetic plate has been on a car.

    python training/make_synthetic.py --digits DIR --words DIR --out DIR -n 20000
"""
from __future__ import annotations

import argparse
import csv
import random
from pathlib import Path

import cv2
import numpy as np

PLATE_H = 96


def load_glyphs(digits_dir: Path) -> dict[str, list[np.ndarray]]:
    glyphs: dict[str, list[np.ndarray]] = {}
    for digit in "0123456789":
        files = sorted((digits_dir / digit).glob("*.jpg"))
        glyphs[digit] = [cv2.imread(str(f), cv2.IMREAD_GRAYSCALE) for f in files]
        glyphs[digit] = [g for g in glyphs[digit] if g is not None]
        if not glyphs[digit]:
            raise SystemExit(f"aucun glyphe pour le chiffre {digit}")
    return glyphs


def paste_glyph(canvas: np.ndarray, glyph: np.ndarray, x: int, height: int) -> int:
    """Paste one white-on-black glyph, scaled to `height`, and return the new x."""
    scale = height / glyph.shape[0]
    width = max(1, int(glyph.shape[1] * scale))
    resized = cv2.resize(glyph, (width, height), interpolation=cv2.INTER_CUBIC)
    y = (canvas.shape[0] - height) // 2
    region = canvas[y : y + height, x : x + width]
    if region.shape[:2] == resized.shape[:2]:
        # Glyphs are white on black, so lighten rather than overwrite: the border of
        # one glyph must not erase the one before it.
        np.maximum(region, resized, out=region)
    return x + width


# Real Tunisian plates are 89% four-digit on the right, so a faithful generator
# teaches the model to pad every marginal last character to four. These weights
# deliberately over-represent the short groups -- the rare case needs gradient, not
# a matching histogram. Left group stays near its real 29/71 split, which the model
# already reads correctly.
_NUMERO_WEIGHTS = {1: 0.02, 2: 0.08, 3: 0.35, 4: 0.55}
_SERIE_WEIGHTS = {1: 0.05, 2: 0.32, 3: 0.63}


def _digits(rng: random.Random, weights: dict[int, float]) -> str:
    """A number with a length drawn from `weights`, never with a leading zero."""
    n = rng.choices(list(weights), weights=list(weights.values()))[0]
    lo = 1 if n == 1 else 10 ** (n - 1)
    return str(rng.randint(lo, 10**n - 1))


# The série is a registration series, capped in practice around 250, so the
# three-digit bucket is 100..250 rather than 100..999.
_SERIE_RANGES = {1: (1, 9), 2: (10, 99), 3: (100, 250)}


def random_plate_text(rng: random.Random) -> tuple[str, str]:
    n = rng.choices(list(_SERIE_WEIGHTS), weights=list(_SERIE_WEIGHTS.values()))[0]
    serie = rng.randint(*_SERIE_RANGES[n])
    return str(serie), _digits(rng, _NUMERO_WEIGHTS)


def compose(text: tuple[str, str], glyphs, words, rng: random.Random) -> np.ndarray:
    serie, numero = text
    digit_h = rng.randint(int(PLATE_H * 0.55), int(PLATE_H * 0.72))
    word = rng.choice(words)
    word_h = int(digit_h * rng.uniform(0.85, 1.15))
    word_w = max(1, int(word.shape[1] * word_h / word.shape[0]))

    gap = rng.randint(2, 8)
    pad = rng.randint(10, 26)
    width = pad * 2 + word_w + rng.randint(14, 30)
    width += sum(int(glyphs[c][0].shape[1] * digit_h / glyphs[c][0].shape[0]) + gap
                 for c in serie + numero)

    canvas = np.zeros((PLATE_H, width), np.uint8)
    x = pad
    for char in serie:
        x = paste_glyph(canvas, rng.choice(glyphs[char]), x, digit_h) + gap
    x += rng.randint(4, 14)
    y = (PLATE_H - word_h) // 2
    resized_word = cv2.resize(word, (word_w, word_h), interpolation=cv2.INTER_CUBIC)
    region = canvas[y : y + word_h, x : x + word_w]
    if region.shape[:2] == resized_word.shape[:2]:
        np.maximum(region, resized_word, out=region)
    x += word_w + rng.randint(4, 14)
    for char in numero:
        x = paste_glyph(canvas, rng.choice(glyphs[char]), x, digit_h) + gap
    return canvas[:, : min(width, x + pad)]


def colourise(mask: np.ndarray, rng: random.Random) -> np.ndarray:
    """Ink and background colours drawn from what the real photographs show:
    mostly white on black, but sun-bleached browns and greens are common."""
    background = np.array([rng.randint(8, 60)] * 3, np.float32)
    background += np.random.uniform(-14, 14, 3)               # slight colour cast
    ink = np.array([rng.randint(160, 255)] * 3, np.float32)
    ink += np.random.uniform(-12, 12, 3)
    alpha = (mask.astype(np.float32) / 255.0)[..., None]
    plate = background * (1 - alpha) + ink * alpha
    plate = np.clip(plate, 0, 255).astype(np.uint8)
    # White border frame, present on almost every plate.
    if rng.random() < 0.85:
        cv2.rectangle(plate, (2, 2), (plate.shape[1] - 3, plate.shape[0] - 3),
                      tuple(int(v) for v in ink), rng.randint(1, 3))
    return plate


def degrade(plate: np.ndarray, rng: random.Random) -> np.ndarray:
    """Make it look photographed rather than generated: the real crops are skewed,
    motion-blurred and JPEG-crushed, and a model trained on clean plates learns none
    of that."""
    h, w = plate.shape[:2]
    shift = lambda m: rng.uniform(-m, m)  # noqa: E731
    src = np.float32([[0, 0], [w, 0], [w, h], [0, h]])
    dst = np.float32([
        [shift(w * 0.05), shift(h * 0.16)],
        [w + shift(w * 0.05), shift(h * 0.16)],
        [w + shift(w * 0.05), h + shift(h * 0.16)],
        [shift(w * 0.05), h + shift(h * 0.16)],
    ])
    plate = cv2.warpPerspective(plate, cv2.getPerspectiveTransform(src, dst), (w, h),
                                borderMode=cv2.BORDER_REPLICATE)
    if rng.random() < 0.75:
        k = rng.choice([3, 5, 7])
        plate = (cv2.GaussianBlur(plate, (k, k), 0) if rng.random() < 0.6
                 else cv2.blur(plate, (k, 1)))          # motion blur, horizontal
    plate = np.clip(plate.astype(np.float32) * rng.uniform(0.55, 1.35)
                    + rng.uniform(-30, 30), 0, 255).astype(np.uint8)
    if rng.random() < 0.8:
        noise = np.random.normal(0, rng.uniform(3, 16), plate.shape)
        plate = np.clip(plate + noise, 0, 255).astype(np.uint8)
    if rng.random() < 0.7:
        quality = rng.randint(18, 70)
        plate = cv2.imdecode(cv2.imencode(".jpg", plate,
                             [cv2.IMWRITE_JPEG_QUALITY, quality])[1], cv2.IMREAD_COLOR)
    return plate


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--digits", required=True, type=Path)
    parser.add_argument("--words", required=True, type=Path)
    parser.add_argument("--out", required=True, type=Path)
    parser.add_argument("-n", "--count", type=int, default=20000)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--split-name", default="synth")
    args = parser.parse_args()

    rng = random.Random(args.seed)
    np.random.seed(args.seed)
    glyphs = load_glyphs(args.digits)
    words = [cv2.imread(str(p), cv2.IMREAD_GRAYSCALE) for p in sorted(args.words.glob("*"))]
    words = [w for w in words if w is not None]
    if not words:
        raise SystemExit("aucun mot تونس dans --words")

    images = args.out / args.split_name
    images.mkdir(parents=True, exist_ok=True)
    with open(args.out / f"{args.split_name}.csv", "w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["image_path", "plate_text"])
        for i in range(args.count):
            serie, numero = random_plate_text(rng)
            plate = degrade(colourise(compose((serie, numero), glyphs, words, rng), rng), rng)
            name = f"{i:06d}.jpg"
            cv2.imwrite(str(images / name), plate)
            writer.writerow([f"{args.split_name}/{name}", f"{serie}TN{numero}"])
    print(f"{args.count} plaques synthétiques -> {images}")


if __name__ == "__main__":
    main()
