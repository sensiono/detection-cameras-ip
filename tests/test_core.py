import numpy as np

from vision.confirm import Confirmer
from vision.faces.index import FaceIndex
from vision.plates.normalize import normalize


def unit(*values):
    v = np.array(values, dtype=np.float32)
    return v / np.linalg.norm(v)


def test_index_matches_above_threshold_only():
    index = FaceIndex(matrix=np.zeros((0, 3), dtype=np.float32))
    index.add("u1", unit(1, 0, 0))
    index.add("u2", unit(0, 1, 0))
    assert index.search(unit(1, 0.05, 0), 0.9)[0] == "u1"
    assert index.search(unit(0, 0, 1), 0.9)[0] is None


def test_confirmer_needs_votes_then_mutes():
    c = Confirmer(votes=2, window_s=5, cooldown_s=100)
    assert c.accept("u1", now=0) is False
    assert c.accept("u1", now=1) is True     # second vote inside the window
    assert c.accept("u1", now=2) is False    # cooldown
    assert c.accept("u1", now=3) is False


def test_confirmer_forgets_stale_votes():
    c = Confirmer(votes=2, window_s=5, cooldown_s=100)
    assert c.accept("u1", now=0) is False
    assert c.accept("u1", now=99) is False   # first vote expired


def test_plate_normalisation():
    assert normalize("123 tn 4567") == "123TN4567"
    assert normalize("O12-TN-3456") == "12TN3456"
    assert normalize("RS 1234") == "RS1234"
    assert normalize("!!") is None


def test_payload_omits_snapshot_when_absent():
    from datetime import datetime, timezone

    from vision.schemas import Event

    at = datetime(2026, 8, 29, 8, 12, tzinfo=timezone.utc)
    bare = Event("attendance", "cam-entrance", "42", 0.71, at)
    assert "snapshot" not in bare.as_payload()
    assert Event("access", "cam-gate", "123TN4567", 0.9, at, "abc").as_payload()["snapshot"] == "abc"


def test_country_word_collapses_to_one_spelling():
    """Measured on real photos: the OCR reads تونس as TN on one plate and TU on
    another. Both must key the same row, or the car is refused every other pass."""
    assert normalize("159TU8950") == "159TN8950"
    assert normalize("156TNS415") == "156TN5415"   # S misread for 5, corrected
    assert normalize("159TU8950") == normalize("159 TN 8950")
