from __future__ import annotations

import re

_KEEP = re.compile(r"[^0-9A-Z]")
# Standard Tunisian civil plate: 3-digit série, تونس, 4-digit numéro. Leading zeros
# are dropped on both groups so "062 TN 0528" typed by an administrator and "62TN528"
# read by a camera are the same row.
_TN_CIVIL = re.compile(r"^(\d{1,3})T[NU](\d{1,4})$")


def canonical(raw: str) -> str:
    """Sanitise a plate typed by a human so it compares equal to what the cameras send.

    This deliberately does *not* undo OCR character confusions — that guess only makes
    sense on machine-read text (`vision/plates/normalize.py`). It must, however, agree
    with the vision service on the civil format, or an authorised car is refused.
    """
    text = _KEEP.sub("", raw.upper())
    match = _TN_CIVIL.match(text)
    if match:
        serie, numero = match.groups()
        return f"{int(serie)}TN{int(numero)}"
    return text
