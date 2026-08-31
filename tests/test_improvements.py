import tempfile
from pathlib import Path
import numpy as np
import pytest

from vision.plates.ocr import apply_clahe
from vision.pipeline import vote_plate_consensus, PlateTemporalVoter
from vision.events import HttpSink
from vision.schemas import Event
from vision.config import SinkCfg


def test_plate_consensus_majority_voting():
    candidates = [
        ("159TN8950", 0.95),
        ("159TN8950", 0.90),
        ("159TN8958", 0.70),  # 8 misread as 0 on one frame
    ]
    plate, conf = vote_plate_consensus(candidates)
    assert plate == "159TN8950"
    assert conf > 0.80


def test_plate_temporal_voter_window():
    voter = PlateTemporalVoter(window_s=2.0, min_observations=2)
    res1 = voter.add("159TN8950", 0.90, (10, 10, 100, 50), now=0.0)
    assert res1 == ("159TN8950", 0.90, (10, 10, 100, 50))

    # Add second observation with a character glitch
    res2 = voter.add("159TN8958", 0.80, (12, 10, 102, 50), now=0.5)
    assert res2 is not None
    plate, conf, bbox = res2
    assert plate == "159TN8950"  # consensus overrides the single-frame glitch


def test_clahe_contrast_enhancement():
    img_gray = np.full((100, 100), 50, dtype=np.uint8)
    enhanced_gray = apply_clahe(img_gray)
    assert enhanced_gray.shape == (100, 100)

    img_color = np.full((100, 100, 3), 50, dtype=np.uint8)
    enhanced_color = apply_clahe(img_color)
    assert enhanced_color.shape == (100, 100, 3)


def test_http_sink_offline_sqlite_queue():
    with tempfile.TemporaryDirectory() as tmpdir:
        db_path = Path(tmpdir) / "test_queue.sqlite"
        cfg = SinkCfg(url="http://invalid-unreachable-host-9999:8000/api/events/", token="tok", timeout_s=0.5)
        with HttpSink(cfg, queue_path=db_path) as sink:
            ev = Event(kind="attendance", camera_id="cam-1", subject="u_test", confidence=0.92)
            sink.emit(ev)
            assert sink.pending_count() == 1
            assert db_path.exists()

