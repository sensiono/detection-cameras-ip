"""The anti-spoofing gate. The point of these tests is not the model — it is that a
face judged fake can never reach the gallery, whatever the model says afterwards."""

from pathlib import Path

import numpy as np
import pytest

from vision.faces.liveness import LivenessChecker, expand_bbox, softmax
from vision.pipeline import AttendanceRecognizer


class FakeFace:
    def __init__(self, bbox, score=0.9):
        self.bbox = bbox
        self.score = score
        self.embedding = np.array([1.0, 0.0, 0.0], dtype=np.float32)


class FakeEngine:
    def __init__(self, faces):
        self._faces = faces

    def detect(self, frame):
        return self._faces


class SpyIndex:
    """Records whether the gallery was consulted at all."""

    def __init__(self, result=("user_42", 0.8)):
        self.result = result
        self.searched = False

    def search(self, embedding, threshold):
        self.searched = True
        return self.result


class FakeLiveness:
    def __init__(self, value):
        self.value = value

    def score(self, frame, bbox):
        return self.value


FRAME = np.zeros((480, 640, 3), dtype=np.uint8)


def recognizer(live_value, index=None):
    index = index or SpyIndex()
    return (
        AttendanceRecognizer(
            FakeEngine([FakeFace((100, 100, 200, 220))]),
            index,
            threshold=0.42,
            liveness=FakeLiveness(live_value),
            live_threshold=0.60,
        ),
        index,
    )


def test_spoof_is_reported_and_never_reaches_the_gallery():
    reco, index = recognizer(live_value=0.10)
    kinds = [sighting[0] for sighting in reco(FRAME)]
    assert kinds == ["spoof_attempt"]
    assert index.searched is False   # the decisive assertion


def test_real_face_is_matched_normally():
    reco, index = recognizer(live_value=0.95)
    assert [s[0] for s in reco(FRAME)] == ["attendance"]
    assert index.searched is True


def test_threshold_is_inclusive_at_the_boundary():
    assert [s[0] for s in recognizer(live_value=0.60)[0](FRAME)] == ["attendance"]
    assert [s[0] for s in recognizer(live_value=0.599)[0](FRAME)] == ["spoof_attempt"]


def test_without_a_checker_behaviour_is_unchanged():
    index = SpyIndex()
    reco = AttendanceRecognizer(
        FakeEngine([FakeFace((10, 10, 60, 70))]), index, threshold=0.42
    )
    assert [s[0] for s in reco(FRAME)] == ["attendance"]


def test_context_crop_is_wider_than_the_face_but_stays_in_frame():
    # A 100x120 face at the centre, doubled, must grow on all four sides.
    assert expand_bbox((270, 180, 370, 300), 2.0, 640, 480) == (220, 120, 420, 360)


def test_context_crop_slides_inside_the_frame_without_changing_shape():
    """A face against the edge must keep the requested window size.

    Clipping instead of sliding would shrink the crop and shift the face off-centre;
    the model, trained on centred windows, then calls real faces attacks.
    """
    x1, y1, x2, y2 = expand_bbox((0, 0, 40, 40), 3.0, 640, 480)
    assert (x2 - x1, y2 - y1) == (120, 120)  # 40 * 3, not clipped to 80
    assert (x1, y1) == (0, 0)


def test_context_crop_shrinks_the_scale_when_the_frame_is_too_small():
    """A face filling the frame cannot get 3x of context; the scale gives way.

    Returning a window larger than the frame would produce an empty or distorted
    crop, which is how a whole gallery ends up scored as spoofed.
    """
    x1, y1, x2, y2 = expand_bbox((10, 10, 110, 110), 3.0, 120, 120)
    assert 0 <= x1 < x2 <= 119 and 0 <= y1 < y2 <= 119
    assert (x2 - x1) == (y2 - y1)  # square in, square out: no aspect distortion


def test_softmax_is_a_distribution():
    probabilities = softmax(np.array([2.0, 1.0, 0.1], dtype=np.float32))
    assert probabilities.sum() == pytest.approx(1.0, rel=1e-6)
    assert int(np.argmax(probabilities)) == 0


# --- the ONNX path, exercised with a 244-byte stand-in model ------------------
# Its logits are the per-channel means of the crop, so a green frame must score
# high (REAL_INDEX == 1 == the green channel) and a blue frame must score low.

FIXTURE = Path(__file__).parent / "fixtures" / "tiny_antispoof.onnx"


def frame_of(colour):
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    frame[:, :] = colour
    return frame


def test_missing_model_fails_loudly_rather_than_silently_allowing_everyone():
    with pytest.raises(FileNotFoundError, match="anti-spoofing"):
        LivenessChecker("models/does-not-exist.onnx", gpu=False)


def test_scores_a_real_looking_crop_high_and_a_spoofed_one_low():
    checker = LivenessChecker(FIXTURE, scale=1.0, gpu=False)
    bbox = (270, 180, 370, 300)
    live = checker.score(frame_of((0, 255, 0)), bbox)     # green -> class 1
    spoof = checker.score(frame_of((255, 0, 0)), bbox)    # blue  -> class 0
    assert live > 0.9
    assert spoof < 0.1


def test_a_box_outside_the_frame_is_never_judged_live():
    checker = LivenessChecker(FIXTURE, scale=1.0, gpu=False)
    # Sliding it back inside would score an unrelated patch of the scene, and a
    # blank wall can read as live. Refusing is the only safe answer.
    assert checker.score(frame_of((0, 255, 0)), (700, 700, 720, 720)) == 0.0
    assert expand_bbox((700, 700, 720, 720), 2.7, 640, 480) == (0, 0, 0, 0)


# --- evaluation helpers -------------------------------------------------------

def test_ground_truth_is_read_from_the_file_name():
    from vision.evaluate import expected_plate

    assert expected_plate(Path("159 tn 8950.jpg")) == "159TN8950"
    assert expected_plate(Path("159TN8950_2.jpg")) == "159TN8950"   # second shot
    assert expected_plate(Path("IMG4021.jpg")) is None              # unlabelled


def test_far_and_frr_move_in_opposite_directions():
    from vision.evaluate import FaceScores

    scores = FaceScores(
        genuine=np.array([0.50, 0.60, 0.70]),
        impostor=np.array([0.10, 0.30, 0.55]),
    )
    strict_far, strict_frr = scores.rates(0.65)
    loose_far, loose_frr = scores.rates(0.20)
    assert strict_far < loose_far      # a high bar lets fewer impostors in
    assert strict_frr > loose_frr      # ...and turns more real people away


def test_equal_error_point_prefers_the_safer_threshold_on_a_tie():
    from vision.evaluate import FaceScores

    # Genuine and impostor scores are far apart, so a whole band scores 0/0.
    scores = FaceScores(genuine=np.array([0.90]), impostor=np.array([0.10]))
    threshold, far, frr = scores.best_threshold()
    assert (far, frr) == (0.0, 0.0)
    assert 0.30 < threshold < 0.70     # the middle of the band, not either end


def test_iou_is_symmetric_and_bounded():
    from vision.evaluate import iou

    a, b = (0, 0, 10, 10), (5, 5, 15, 15)
    assert iou(a, a) == 1.0
    assert iou(a, b) == iou(b, a)
    assert iou(a, (20, 20, 30, 30)) == 0.0
    assert 0 < iou(a, b) < 1


def test_detection_totals_never_divide_by_zero():
    from vision.evaluate import DetectionTotals

    empty = DetectionTotals()
    assert (empty.recall, empty.precision, empty.mean_iou) == (0.0, 0.0, 0.0)


def test_prefilled_label_needs_two_distinct_digit_groups():
    from vision.label import guess

    assert guess("117P3989") == "117TN3989"
    assert guess("12898086") == "128TN8086"     # no separator survived the OCR
    assert guess("106JJ2131") == "106TN2131"
    assert guess("7") == ""                     # one digit is not a plate
    assert guess("") == ""
