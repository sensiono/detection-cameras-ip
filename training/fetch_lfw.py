"""Materialise a slice of LFW as data/faces_lfw/<person>/*.jpg.

LFW is the standard face-verification benchmark: it gives a defensible FAR/FRR
curve and an equal-error-rate threshold before you have any real employee photos.
It is NOT the production gallery -- that must be your own people, shot on your own
camera. Use this to choose `faces.match_threshold`, not to claim the system works.
"""

from __future__ import annotations

import argparse
import collections
import pathlib

import pyarrow.parquet as pq

URL = "https://huggingface.co/datasets/logasja/lfw/resolve/main/data/train-00000-of-00001.parquet"


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("parquet", help=f"fichier LFW parquet (voir {URL})")
    ap.add_argument("--out", default="data/faces_lfw")
    ap.add_argument("--people", type=int, default=200, help="nombre d'identités")
    ap.add_argument("--per-person", type=int, default=5, help="photos par identité")
    args = ap.parse_args()

    table = pq.read_table(args.parquet)
    import json  # noqa: PLC0415 -- one-off script

    meta = json.loads(table.schema.metadata[b"huggingface"])
    labels = meta["info"]["features"]["label"]["names"]

    by_person: dict[int, list[bytes]] = collections.defaultdict(list)
    for label, image in zip(table["label"].to_pylist(), table["image"].to_pylist()):
        by_person[label].append(image["bytes"])

    # Only people with enough photos: one photo enrols nobody, and eval-faces needs
    # to enrol half and test the other half.
    usable = [p for p, imgs in by_person.items() if len(imgs) >= args.per_person]
    usable.sort(key=lambda p: -len(by_person[p]))
    chosen = usable[: args.people]

    out = pathlib.Path(args.out)
    written = 0
    for person in chosen:
        folder = out / labels[person]
        folder.mkdir(parents=True, exist_ok=True)
        for i, blob in enumerate(by_person[person][: args.per_person]):
            (folder / f"{i:02d}.jpg").write_bytes(blob)
            written += 1
    print(f"{len(chosen)} identités, {written} photos -> {out}")
    assert len(chosen) == args.people, f"seulement {len(chosen)} identités disponibles"


if __name__ == "__main__":
    main()
