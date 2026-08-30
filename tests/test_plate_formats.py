"""Every Tunisian plate format, and what this system does with it.

Only the standard civil format is parsed. The others are normalised so they can be
matched against a row an administrator typed, and nothing more: a system that guesses
at a format it does not know produces confident, wrong answers.
"""

from vision.plates.normalize import is_recognised, normalize


class TestStandardCivilPlate:
    """XXX تونس XXXX — the one that matters at a school or company gate."""

    def test_the_arabic_word_is_read_as_tn_or_tu(self):
        assert normalize("159 TN 8950") == "159TN8950"
        assert normalize("159 TU 8950") == "159TN8950"

    def test_leading_zeros_never_split_one_car_into_two_rows(self):
        assert normalize("062 TN 0528") == normalize("62 TN 528") == "62TN528"

    def test_digit_confusions_are_undone(self):
        assert normalize("156TNS415") == "156TN5415"   # S read for 5
        assert normalize("1O6 TN 2I3I") == "106TN2131"  # O for 0, I for 1

    def test_it_is_the_format_the_rest_of_the_code_relies_on(self):
        assert is_recognised(normalize("159 TN 8950"))


class TestOtherFormats:
    """Normalised and logged, never parsed. Each stays distinct from the others."""

    def test_rental_car_uses_the_standard_format(self):
        # White on blue, but the string is identical — nothing to implement.
        assert normalize("126 TN 8202") == "126TN8202"

    def test_government_plate_survives_its_dash(self):
        assert normalize("20-130486") == "20130486"
        assert not is_recognised(normalize("20-130486"))

    def test_diplomatic_plates_keep_their_letters(self):
        # 46 CD س د 02 — the Arabic is dropped, CD is not mistaken for a country word.
        assert normalize("46 CD 02") == "46CD02"
        assert normalize("12 CMD 01") == "12CMD01"
        assert normalize("12 MD 34") == "12MD34"

    def test_a_diplomatic_plate_is_never_reissued_as_a_civil_one(self):
        """The trap: `46 CD 02` looks like digits-letters-digits. Accepting any
        letter as تونس would file this diplomatic car under the civil plate 46TN2."""
        assert normalize("46 CD 02") != "46TN2"
        assert not is_recognised(normalize("46 CD 02"))

    def test_military_and_temporary_plates_are_kept_as_digits(self):
        assert normalize("21551") == "21551"           # military, 5 digits
        assert normalize("73141 ت ن") == "73141"       # temporary, Arabic dropped

    def test_dealer_plate_keeps_only_its_digits(self):
        assert normalize("12345 ع ع") == "12345"

    def test_temporary_import_is_parsed_because_it_is_latin(self):
        assert normalize("RS 1234") == "RS1234"
        assert is_recognised("RS1234")


class TestRejections:
    def test_nothing_usable_returns_none(self):
        assert normalize("!!") is None
        assert normalize("") is None
        assert normalize("12") is None                  # too short to be a plate
        assert normalize("1234567890123") is None       # too long to be one


class TestTrainedModelContract:
    """The service must be able to load a locally trained OCR, not only a hub name."""

    def test_a_local_onnx_without_its_config_is_refused(self):
        import pytest

        from vision.plates.ocr import PlateOCR

        # The alphabet lives in the YAML: loading the weights without it would decode
        # every prediction against the wrong character set and fail silently.
        with pytest.raises(ValueError, match="ocr_config"):
            PlateOCR("models/tn_ocr.onnx", gpu=False, config=None)
