"""Reproduce the pinned historical GEDI case and its scientific checks."""

import argparse
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from io import BytesIO
import json
from pathlib import Path
from urllib.request import urlopen
from zipfile import ZipFile

import h5py
import numpy as np


HERE = Path(__file__).resolve().parent
WINDOW = (-10, 22)
NOISE_WINDOWS = (-20, 35)
NOISE_SIGMAS = 3
GROUND_SHIFTS = (-1, -0.5, 0, 0.5, 1)
CHECK_WINDOWS = ((-8, 20), WINDOW, (-12, 25))
CHECK_SIGMAS = (2, NOISE_SIGMAS, 4)
GPS_EPOCH = datetime(1980, 1, 6, tzinfo=timezone.utc)
GPS_MINUS_UTC_2019 = 18


def require(condition, message):
    if not condition:
        raise ValueError(message)


def verify_bytes(content, source, kind):
    require(
        len(content) == source[f"{kind}_bytes"]
        and sha256(content).hexdigest() == source[f"{kind}_sha256"],
        f"{kind} size or SHA-256 mismatch for {source['member']}",
    )


@contextmanager
def open_input(source, local_path):
    if local_path is None:
        with urlopen(source["url"], timeout=25) as response:
            archive = response.read(source["zip_bytes"] + 1)
        verify_bytes(archive, source, "zip")
        with ZipFile(BytesIO(archive)) as zipped:
            member = zipped.getinfo(source["member"])
            require(member.file_size == source["hdf5_bytes"], "Unexpected ZIP member size")
            content = zipped.read(member)
    else:
        with local_path.open("rb") as stream:
            content = stream.read(source["hdf5_bytes"] + 1)

    verify_bytes(content, source, "hdf5")
    with h5py.File(BytesIO(content), "r") as file:
        metadata = file["METADATA/DatasetIdentification"].attrs
        fields = {
            "fileName": "original_granule",
            "VersionID": "hdf5_version_id",
            "PGEVersion": "pge_version",
            "uuid": "uuid",
        }
        for attribute, key in fields.items():
            value = metadata[attribute][0]
            if isinstance(value, bytes):
                value = value.decode("utf-8")
            require(value == source[key], f"Unexpected HDF5 metadata: {attribute}")
        yield file


def shot_indices(file):
    indices = {}
    for name in file:
        if not name.startswith("BEAM"):
            continue
        for index, shot in enumerate(file[name]["shot_number"][:]):
            require(int(shot) not in indices, "Duplicate shot_number in a product")
            indices[int(shot)] = (name, index)
    return indices


def field(group, key, row):
    return group[key][row].item()


def along_track_step(first, second):
    lat1, lon1 = np.radians(first)
    lat2, lon2 = np.radians(second)
    haversine = np.sin((lat2 - lat1) / 2) ** 2
    haversine += np.cos(lat1) * np.cos(lat2) * np.sin((lon2 - lon1) / 2) ** 2
    return float(2 * 6_371_008.8 * np.arcsin(np.sqrt(haversine)))


def normalized_return(heights, adc, background, sigma, multiplier, window):
    """Return a common one-metre profile, or null for incomplete coverage."""
    lower, upper = window
    if min(heights) > lower or max(heights) < upper:
        return None
    included = (lower <= heights) & (heights < upper)
    residual = np.maximum(adc[included] - background - multiplier * sigma, 0)
    bin_indices = np.floor(heights[included] - lower).astype(int)
    totals = np.bincount(bin_indices, weights=residual, minlength=upper - lower)
    if totals.sum() <= 0 or np.any(np.bincount(bin_indices, minlength=upper - lower) == 0):
        return None
    return totals / totals.sum()


def share_in_band(profile, window, band):
    first, last = (edge - window[0] for edge in band)
    return float(profile[first:last].sum())


def check_contrast(heights, adc, noise, alternative_noise, offsets, band):
    fractions = []
    for offset in sorted(set(offsets)):
        for background, sigma in (noise, alternative_noise):
            for multiplier in CHECK_SIGMAS:
                for window in CHECK_WINDOWS:
                    profile = normalized_return(heights - offset, adc, background, sigma, multiplier, window)
                    if profile is None:
                        return None
                    fractions.append(share_in_band(profile, window, band))
    return {
        "min_fraction": round(min(fractions), 10),
        "max_fraction": round(max(fractions), 10),
        "scenarios": len(fractions),
    }


def read_footprint(l1, l2, i, j, shot, selection):
    def get1(path):
        return field(l1, path, i)

    def get2(path):
        return field(l2, path, j)

    ident = str(shot)
    padded_ident = f"{shot:018d}"
    require(int(padded_ident[:5]) == selection["orbit"], f"{ident}: orbit mismatch")
    require(
        int(padded_ident[5:7]) == get1("beam") == get2("beam") == selection["beam_number"]
        and get1("channel") == get2("channel") == selection["channel"],
        f"{ident}: beam or channel mismatch",
    )
    time = get1("geolocation/delta_time")
    require(get1("delta_time") == time == get2("delta_time"), f"{ident}: time mismatch")
    gps_offset = l1["ancillary/master_time_epoch"][0].item()
    utc = GPS_EPOCH + timedelta(seconds=gps_offset - GPS_MINUS_UTC_2019 + time)
    require(utc.date().isoformat() == "2019-04-18", f"{ident}: wrong acquisition date")
    algorithm = get2("selected_algorithm")
    flags = {
        "quality_flag": get2("quality_flag"),
        "surface_flag": get2("surface_flag"),
        "degrade_flag": get2("degrade_flag"),
        "l1b_degrade": get1("geolocation/degrade"),
        "stale_return_flag": get1("stale_return_flag"),
        "elevation_bias_flag": get2("elevation_bias_flag"),
        "rx_assess_quality_flag": get2("rx_assess/quality_flag"),
        "rx_assess_flag": get2("rx_assess/rx_assess_flag"),
        "rx_clipbin_count": get2("rx_assess/rx_clipbin_count"),
        "toploc_miss": get2(f"rx_processing_a{algorithm}/toploc_miss"),
    }
    positive_flags = {"quality_flag", "surface_flag", "rx_assess_quality_flag"}
    require(all(value == int(key in positive_flags) for key, value in flags.items()), f"{ident}: failed quality screening")
    sensitivity = get2("sensitivity")
    require(selection["minimum_sensitivity"] <= sensitivity <= 1, f"{ident}: sensitivity out of range")

    start, count = get1("rx_sample_start_index"), get1("rx_sample_count")
    waveform = l1["rxwaveform"]
    require(1 <= start and 2 <= count and start - 1 + count <= len(waveform), f"{ident}: invalid RX slice")
    adc = waveform[start - 1 : start - 1 + count].astype("float64")
    first, last = get1("geolocation/elevation_bin0"), get1("geolocation/elevation_lastbin")
    ground, highest = get2("elev_lowestmode"), get2("elev_highestreturn")
    rh100 = l2["rh"][j, 100].item()
    native_step = (first - last) / (count - 1)
    require(np.isfinite(adc).all() and np.all(adc >= 0), f"{ident}: invalid ADC data")
    require(0.13 < native_step < 0.16 and last < ground < highest < first, f"{ident}: invalid height axis")
    require(abs(rh100 - (highest - ground)) < 0.03, f"{ident}: RH100 units or ground reference mismatch")
    heights = np.linspace(first, last, count) - ground
    noise = (get1("noise_mean_corrected"), get1("noise_stddev_corrected"))
    quiet = adc[(heights < NOISE_WINDOWS[0]) | (heights >= NOISE_WINDOWS[1])]
    require(heights.min() < NOISE_WINDOWS[0] and heights.max() >= NOISE_WINDOWS[1], f"{ident}: missing noise tails")
    median = float(np.median(quiet))
    mad_sigma = float(1.4826 * np.median(np.abs(quiet - median)))
    require(noise[0] >= 0 and noise[1] > 0 and mad_sigma > 0, f"{ident}: invalid noise estimates")
    profile = normalized_return(heights, adc, *noise, NOISE_SIGMAS, WINDOW)
    require(profile is not None, f"{ident}: incomplete profile or no return above threshold")
    alternatives = []
    for method in range(1, 7):
        elevation = get2(f"geolocation/elev_lowestmode_a{method}")
        ran = get2(f"rx_processing_a{method}/rx_algrunflag")
        quality = get2(f"geolocation/quality_flag_a{method}")
        valid = ran == quality == 1 and last < elevation < highest
        alternatives.append({"algorithm": method, "elevation_m": elevation if valid else None})
    ground_offsets = [a["elevation_m"] - ground for a in alternatives if a["elevation_m"] is not None]
    band = selection["comparison_height_m"]
    selected_stress = check_contrast(heights, adc, noise, (median, mad_sigma), GROUND_SHIFTS, band)
    alternative_stress = check_contrast(heights, adc, noise, (median, mad_sigma), ground_offsets, band)
    require(selected_stress is not None and alternative_stress is not None, f"{ident}: contrast test has incomplete coverage")

    lat, lon = get2("lat_lowestmode"), get2("lon_lowestmode")
    rx_start = [get1("geolocation/latitude_bin0"), get1("geolocation/longitude_bin0")]
    rx_end = [get1("geolocation/latitude_lastbin"), get1("geolocation/longitude_lastbin")]
    require(-90 <= lat <= 90 and -180 <= lon <= 180, f"{ident}: invalid WGS84 coordinates")
    fraction_along_rx = (first - ground) / (first - last)
    predicted_position = np.asarray(rx_start) + fraction_along_rx * (np.asarray(rx_end) - rx_start)
    separation = along_track_step(predicted_position, [lat, lon])
    require(separation < 2, f"{ident}: L2A location does not match the L1B ray")

    return {
        "shot_number": ident,
        "VERIFIED": {
            "l1b_row_0_based": i,
            "l2a_row_0_based": j,
            "delta_time_s": time,
            "l1b_master_time_epoch_gps_s": gps_offset,
            "l1b_rx_bin0_lat_lon_deg": rx_start,
            "l1b_rx_lastbin_lat_lon_deg": rx_end,
            "l2a_center_lat_lon_deg": [lat, lon],
            "l1b_elevation_bin0_m_ellipsoid": first,
            "l1b_elevation_lastbin_m_ellipsoid": last,
            "l2a_elev_lowestmode_m_ellipsoid": ground,
            "l2a_elev_highestreturn_m_ellipsoid": highest,
            "l2a_rh100_m": rh100,
            "l2a_selected_algorithm": algorithm,
            "l2a_available_ground_algorithms_m_ellipsoid": alternatives,
            "l2a_sensitivity": sensitivity,
            "l2a_solar_elevation_deg": get2("solar_elevation"),
            "flags": flags,
            "l1b_noise_mean_adc": noise[0],
            "l1b_noise_stddev_adc": noise[1],
            "l1b_rx_sample_start_index_1_based": start,
            "l1b_rx_sample_count": count,
            "l1b_rxwaveform_adc_descending_height": adc.tolist(),
        },
        "DERIVED": {
            "utc": utc.isoformat(timespec="microseconds").replace("+00:00", "Z"),
            "ray_to_l2a_center_separation_m": round(separation, 4),
            "native_vertical_bin_spacing_m": round(native_step, 10),
            "quiet_tail_median_adc": round(median, 6),
            "quiet_tail_mad_sigma_adc": round(mad_sigma, 6),
            "relative_return_share_by_ascending_height_bin": np.round(profile, 10).tolist(),
            "positive_residual_bin_indices_0_based": np.flatnonzero(profile > 0).tolist(),
            "comparison_fraction": round(share_in_band(profile, WINDOW, band), 10),
            "comparison_selected_ground_stress": selected_stress,
            "comparison_product_ground_algorithms_stress": alternative_stress,
        },
    }


def extract(l1b, l2a, manifest):
    selection = manifest["selection"]
    index1, index2 = shot_indices(l1b), shot_indices(l2a)
    matches = sorted(index1.keys() & index2.keys())
    for shot in matches:
        beam, i = index1[shot]
        beam2, j = index2[shot]
        require(beam == beam2, f"{shot}: beam mismatch during join audit")
        require(
            field(l1b[beam], "geolocation/delta_time", i) == field(l2a[beam], "delta_time", j),
            f"{shot}: time mismatch during join audit",
        )
    beam = selection["beam_group"]
    selected = [
        shot for shot in matches
        if index1[shot][0] == beam
        and selection["first_shot_number_within_orbit"] <= shot % 100_000_000 <= selection["last_shot_number_within_orbit"]
    ]
    source_count = selection["last_shot_number_within_orbit"] - selection["first_shot_number_within_orbit"] + 1
    require(len(selected) == source_count, "Missing shot in selected consecutive sequence")
    footprints = []
    for shot in selected:
        observation = read_footprint(l1b[beam], l2a[beam], index1[shot][1], index2[shot][1], shot, selection)
        footprints.append(observation)
    footprints.sort(key=lambda row: row["VERIFIED"]["delta_time_s"])
    require(
        [int(row["shot_number"][-8:]) for row in footprints]
        == list(range(selection["first_shot_number_within_orbit"], selection["last_shot_number_within_orbit"] + 1)),
        "Acquisition order is not a consecutive shot sequence",
    )
    distance = 0.0
    previous = None
    for row in footprints:
        center = row["VERIFIED"]["l2a_center_lat_lon_deg"]
        step = None if previous is None else along_track_step(previous, center)
        if step is not None:
            require(40 < step < 75, "Unexpected footprint spacing for the pinned case")
            distance += step
        row["DERIVED"]["distance_from_previous_footprint_m"] = None if step is None else round(step, 4)
        row["DERIVED"]["cumulative_distance_m"] = round(distance, 4)
        previous = center

    selected_by_id = {row["shot_number"]: row["DERIVED"] for row in footprints}
    low = selected_by_id[selection["comparison_low_shot"]]
    high = selected_by_id[selection["comparison_high_shot"]]
    separated = {}
    for key in ("comparison_selected_ground_stress", "comparison_product_ground_algorithms_stress"):
        separated[key] = round(high[key]["min_fraction"] - low[key]["max_fraction"], 10)
    require(all(gap > 0 for gap in separated.values()), "Comparison does not survive the stated stress tests")
    high_profile = high["relative_return_share_by_ascending_height_bin"]
    vertical_bands = {
        "near_reference_0_to_3_m": round(share_in_band(np.asarray(high_profile), WINDOW, (0, 3)), 10),
        "above_reference_4_to_10_m": high["comparison_fraction"],
    }
    require(all(value > 0 for value in vertical_bands.values()), "Selected waveform lacks both vertical signal regions")
    return {
        "case_id": manifest["case_id"],
        "schema_version": 1,
        "selection": selection,
        "VERIFIED": {
            "l1b_shots_in_subset": len(index1),
            "l2a_shots_in_subset": len(index2),
            "matched_shots_by_beam_and_exact_time": len(matches),
            "l1b_only_shots": [str(s) for s in sorted(index1.keys() - index2.keys())],
            "l2a_only_shots": [str(s) for s in sorted(index2.keys() - index1.keys())],
        },
        "DERIVED": {
            "height_bin_edges_m_ascending": list(range(WINDOW[0], WINDOW[1] + 1)),
            "primary_noise_sigma_multiplier": NOISE_SIGMAS,
            "noise_tail_bounds_m": list(NOISE_WINDOWS),
            "stress_ground_shifts_m": list(GROUND_SHIFTS),
            "stress_windows_m": [list(window) for window in CHECK_WINDOWS],
            "stress_noise_sigma_multipliers": list(CHECK_SIGMAS),
            "min_contrast_margin_fraction": separated,
            "high_shot_vertical_band_fractions": vertical_bands,
        },
        "UNVERIFIED": ["frame_to_shot_alignment", "current_V002_waveform_equivalence", "perceptual_discrimination", "independent_field_validation"],
        "footprints": footprints,
    }


def encode(sample):
    return (json.dumps(sample, ensure_ascii=False, sort_keys=True, separators=(",", ":"), allow_nan=False) + "\n").encode("utf-8")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--l1b", type=Path, help="Pinned local L1B HDF5 subset, otherwise download its ZIP")
    parser.add_argument("--l2a", type=Path, help="Pinned local L2A HDF5 subset, otherwise download its ZIP")
    parser.add_argument("--output", type=Path, default=HERE / "sample.json")
    parser.add_argument("--check", action="store_true", help="Re-extract and compare with the existing sample")
    args = parser.parse_args()
    manifest = json.loads((HERE / "provenance.json").read_text(encoding="utf-8"))
    with open_input(manifest["sources"]["L1B"], args.l1b) as l1b, open_input(manifest["sources"]["L2A"], args.l2a) as l2a:
        sample = extract(l1b, l2a, manifest)
    encoded = encode(sample)
    if args.check:
        require(json.loads(args.output.read_bytes()) == sample, "Saved sample does not reproduce from the inputs")
    else:
        args.output.write_bytes(encoded)
    print(f"{'Verified' if args.check else 'Wrote'} {len(sample['footprints'])} footprints ({len(encoded)} bytes)")
    print(f"Matched source shots: {sample['VERIFIED']['matched_shots_by_beam_and_exact_time']}")
    print(f"Minimum contrast margins: {sample['DERIVED']['min_contrast_margin_fraction']}")


if __name__ == "__main__":
    main()
