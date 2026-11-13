"""Produce deterministic playback events for the packaged GEDI sample."""

import argparse
import json
from math import isfinite, sqrt
from pathlib import Path


HERE = Path(__file__).resolve().parent
MAPPING_VERSION = "gedi-relative-return-v1"
BASE_FREQUENCY_HZ = 440
MAX_PEAK_GAIN = 0.32
NOTE_DURATION_S = 0.095
ATTACK_S = 0.009
RELEASE_S = 0.026
VERTICAL_SECONDS_PER_M = 0.13
HORIZONTAL_METRES_PER_S = 65


def playback_event(shot, band, onset, fraction, positive_return):
    """An event marks every observed bin, including silent or unavailable bins."""
    if fraction is None:
        status = "unavailable"
    else:
        if not isfinite(fraction) or not 0 <= fraction <= 1:
            raise ValueError("Return fraction must be finite and within [0, 1]")
        status = "positive_residual" if positive_return else "below_processing_threshold"
    return {
        "shot_number": shot,
        "height_band_m": list(band),
        "onset_s": round(onset, 9),
        "status": status,
        "return_fraction": fraction,
        "peak_linear_gain": (
            round(MAX_PEAK_GAIN * sqrt(fraction), 9) if status == "positive_residual" else None
        ),
    }


def playback_events(sample, axis, *, shot=None, band=None):
    edges = sample["DERIVED"]["height_bin_edges_m_ascending"]
    if axis == "vertical":
        observation = next((row for row in sample["footprints"] if row["shot_number"] == shot), None)
        if observation is None:
            raise ValueError(f"Unknown shot_number: {shot}")
        derived = observation["DERIVED"]
        profile = derived["relative_return_share_by_ascending_height_bin"]
        positive = set(derived["positive_residual_bin_indices_0_based"])
        return [
            playback_event(shot, (lower, upper), (lower - edges[0]) * VERTICAL_SECONDS_PER_M, value, index in positive)
            for index, (lower, upper, value) in enumerate(zip(edges[:-1], edges[1:], profile, strict=True))
        ]
    if axis != "horizontal":
        raise ValueError(f"Unknown axis: {axis}")
    if band is None or len(band) != 2 or band[0] not in edges or band[1] not in edges or band[0] >= band[1]:
        raise ValueError("Select a non-empty height band with edges in the sample")
    low, high = (edges.index(edge) for edge in band)
    events = []
    for row in sample["footprints"]:
        derived = row["DERIVED"]
        profile = derived["relative_return_share_by_ascending_height_bin"][low:high]
        has_return = any(low <= index < high for index in derived["positive_residual_bin_indices_0_based"])
        fraction = None if any(value is None for value in profile) else round(sum(profile), 10)
        if fraction is not None and 1 < fraction <= 1 + 2e-9:
            fraction = 1.0  # Only correct accumulated decimal export rounding.
        onset = derived["cumulative_distance_m"] / HORIZONTAL_METRES_PER_S
        events.append(playback_event(row["shot_number"], band, onset, fraction, has_return))
    return events


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("axis", choices=("vertical", "horizontal"))
    parser.add_argument("--shot", help="Required shot_number for vertical playback")
    parser.add_argument("--band", nargs=2, type=int, help="Horizontal height band edges in metres")
    parser.add_argument("--sample", type=Path, default=HERE / "sample.json")
    args = parser.parse_args()
    sample = json.loads(args.sample.read_text(encoding="utf-8"))
    try:
        events = playback_events(sample, args.axis, shot=args.shot, band=args.band)
    except ValueError as exc:
        parser.error(str(exc))
    print(json.dumps({
        "mapping_version": MAPPING_VERSION,
        "axis": args.axis,
        "tone": {
            "wave": "sine",
            "frequency_hz": BASE_FREQUENCY_HZ,
            "phase_at_onset_rad": 0,
            "duration_s": NOTE_DURATION_S,
            "linear_attack_s": ATTACK_S,
            "linear_release_s": RELEASE_S,
        },
        "events": events,
    }, indent=2, allow_nan=False))


if __name__ == "__main__":
    main()
