from __future__ import annotations

import re

_KEEP = re.compile(r"[^0-9A-Z]")

# O/I/Q/S/B are the classic misreads of 0/1/0/5/8. The substitution is only ever a
# valid guess in a position we *know* must hold a digit, so it is applied while
# testing the civil pattern and never to a string of an unknown format — a plate
# whose format we cannot name may legitimately contain those letters.
_CONFUSIONS = str.maketrans({"O": "0", "I": "1", "Q": "0", "S": "5", "B": "8"})

# Standard civil plate: "NNN تونس NNNN" — 3-digit série, the word, 4-digit numéro
# (ATTT format). Real plates omit leading zeros, so a 2-digit série and a 3-digit
# numéro are common; the canonical form drops those zeros on both sides so that
# "62 تونس 0528" and "062 تونس 528" cannot become two rows for one car.
#
# Only TN and TU are accepted for تونس, never an arbitrary letter: the current OCR
# also emits P, J and C there, but widening the pattern would swallow a diplomatic
# plate like "46 CD 02" and silently reissue it as the civil plate 46TN2.
_TN_CIVIL = re.compile(r"^(\d{1,3})T[NU](\d{1,4})$")

# Foreign vehicles under temporary import ("régime suspensif").
_TN_ADMIN = re.compile(r"^(RS|CD|MD)(\d{1,6})$")


def is_recognised(plate: str | None) -> bool:
    """True only for a plate in a format we actually parse.

    Every other Tunisian format — gouvernement, militaire, corps diplomatique,
    remorquage, essai — is still normalised and still logged, but its structure is
    not interpreted. Refusing to guess is what keeps two different plates from
    collapsing onto one string.
    """
    if not plate:
        return False
    return bool(_TN_CIVIL.match(plate) or _TN_ADMIN.match(plate))


def normalize(raw: str) -> str | None:
    """Canonical, comparable plate string, or None if it cannot be one.

    Normalising *before* the DB lookup is what stops a working demo from failing on
    a stray space or an O read as a 0.
    """
    text = _KEEP.sub("", raw.upper())
    if not text:
        return None
    if _TN_ADMIN.match(text):
        return text
    match = _TN_CIVIL.match(text.translate(_CONFUSIONS))
    if match:
        serie, numero = match.groups()
        return f"{int(serie)}TN{int(numero)}"
    # Unknown format: cleaned and comparable, but not reinterpreted.
    return text if 4 <= len(text) <= 10 else None
