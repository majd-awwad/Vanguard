"""Validate the packaged sample and playback contract without network access."""

import json
from pathlib import Path
import unittest

from sonification import playback_event, playback_events


HERE = Path(__file__).resolve().parent


class GediSampleChecks(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.sample = json.loads((HERE / "sample.json").read_bytes())
        cls.selection = json.loads((HERE / "provenance.json").read_bytes())["selection"]

    def test_source_join_and_shot_order(self):
        verified = self.sample["VERIFIED"]
        self.assertEqual(verified["matched_shots_by_beam_and_exact_time"], 300)
        self.assertEqual(verified["l1b_only_shots"], [])
        self.assertEqual(len(verified["l2a_only_shots"]), 1)
        self.assertEqual(self.sample["selection"], self.selection)
        shots = self.sample["footprints"]
        self.assertEqual([int(row["shot_number"][-8:]) for row in shots], list(range(108399, 108405)))
        time = [row["VERIFIED"]["delta_time_s"] for row in shots]
        self.assertTrue(all(0.008 < b - a < 0.009 for a, b in zip(time, time[1:])))
        self.assertIsNone(shots[0]["DERIVED"]["distance_from_previous_footprint_m"])
        self.assertTrue(all(57 < row["DERIVED"]["distance_from_previous_footprint_m"] < 58 for row in shots[1:]))

    def test_waveforms_and_flags(self):
        for row in self.sample["footprints"]:
            verified, derived = row["VERIFIED"], row["DERIVED"]
            with self.subTest(shot=row["shot_number"]):
                self.assertEqual(len(verified["l1b_rxwaveform_adc_descending_height"]), verified["l1b_rx_sample_count"])
                self.assertAlmostEqual(derived["native_vertical_bin_spacing_m"], 0.14983, places=5)
                self.assertLess(derived["ray_to_l2a_center_separation_m"], 2)
                self.assertGreaterEqual(verified["l2a_sensitivity"], 0.95)
                self.assertEqual(verified["flags"]["quality_flag"], 1)
                for flag in ("degrade_flag", "l1b_degrade", "stale_return_flag", "elevation_bias_flag", "rx_clipbin_count"):
                    self.assertEqual(verified["flags"][flag], 0)
                profile = derived["relative_return_share_by_ascending_height_bin"]
                self.assertEqual(len(profile), 32)
                self.assertAlmostEqual(sum(profile), 1, places=8)
                self.assertAlmostEqual(sum(profile[14:20]), derived["comparison_fraction"], places=8)

    def test_comparison_survives_stress(self):
        rows = {row["shot_number"]: row["DERIVED"] for row in self.sample["footprints"]}
        lower = rows[self.selection["comparison_low_shot"]]
        higher = rows[self.selection["comparison_high_shot"]]
        scenarios = "comparison_selected_ground_stress"
        self.assertEqual(lower[scenarios]["scenarios"], 90)
        self.assertEqual(higher[scenarios]["scenarios"], 90)
        self.assertGreater(higher[scenarios]["min_fraction"] - lower[scenarios]["max_fraction"], 0.08)
        alternative = "comparison_product_ground_algorithms_stress"
        self.assertGreater(higher[alternative]["min_fraction"] - lower[alternative]["max_fraction"], 0.16)

    def test_vertical_timing_and_shared_gain(self):
        shot = self.selection["comparison_high_shot"]
        events = playback_events(self.sample, "vertical", shot=shot)
        self.assertEqual(len(events), 32)
        self.assertEqual(events[10]["height_band_m"], [0, 1])
        self.assertEqual(events[10]["onset_s"], 1.3)
        self.assertTrue(any(event["status"] == "positive_residual" for event in events[10:13]))
        self.assertTrue(any(event["status"] == "positive_residual" for event in events[14:20]))
        comparison = playback_events(self.sample, "horizontal", band=(4, 5))
        matching_event = next(event for event in comparison if event["shot_number"] == shot)
        self.assertEqual(events[14]["peak_linear_gain"], matching_event["peak_linear_gain"])

    def test_horizontal_timing_and_ordering(self):
        events = playback_events(self.sample, "horizontal", band=(4, 10))
        self.assertEqual(events, playback_events(self.sample, "horizontal", band=(4, 10)))
        self.assertEqual(len(events), 6)
        self.assertEqual(events[0]["onset_s"], 0.0)
        self.assertEqual(events[-1]["shot_number"], self.selection["comparison_high_shot"])
        self.assertGreater(events[-1]["peak_linear_gain"], events[1]["peak_linear_gain"])
        self.assertTrue(all(a["onset_s"] < b["onset_s"] for a, b in zip(events, events[1:])))

    def test_missing_and_below_threshold_are_distinct(self):
        self.assertEqual(playback_event("source", (0, 1), 0, 0.0, False)["status"], "below_processing_threshold")
        unavailable = playback_event("source", (0, 1), 0, None, False)
        self.assertEqual(unavailable["status"], "unavailable")
        self.assertIsNone(unavailable["return_fraction"])
        self.assertIsNone(unavailable["peak_linear_gain"])
        with self.assertRaises(ValueError):
            playback_events(self.sample, "horizontal", band=(-100, 1))


if __name__ == "__main__":
    unittest.main(verbosity=2)
