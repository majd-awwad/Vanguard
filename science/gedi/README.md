# The Invisible Forest — GEDI science checkpoint

**CONDITIONAL GO.** Use this case to prototype and test the vertical and horizontal interactions. It contains six real, adjacent GEDI observations from historical release V001. The contrast described below survives the stated numerical stress tests. Equivalence to V002, EIC frame membership, and perceptual discrimination have not been demonstrated.

## Reproduce

Run from the workspace root with Python 3.11–3.13. The source ZIP downloads are about 2.21 MB combined. The extractor verifies sizes and SHA-256 before opening either subset. The generated JSON is about 106 KB and is sufficient for validation and event generation without Python data dependencies.

```sh
python -m pip install -r science/gedi/requirements.txt
python science/gedi/extract_sample.py --check
python science/gedi/validate_sample.py
python science/gedi/sonification.py vertical --shot 19640520300108404
python science/gedi/sonification.py horizontal --band 4 10
```

Run extraction without `--check` to regenerate `sample.json`. For offline extraction, pass `--l1b PATH --l2a PATH` with the exact unzipped HDF5 members listed in `provenance.json`. The extractor is scoped to this case and rejects inputs that differ from the pinned byte checksums. Event generation emits a JSON schedule and a reference tone definition. A renderer can use these to make audio, synchronizing the visual and textual readouts to the same events.

Checkpoint validation used Python 3.13.3 on Windows. Fresh HTTPS re-extraction was byte-identical to the packaged sample (106,141 bytes, SHA-256 `153b9fce2eb38fa62f2db2638f73ab66414871996e7ff101aee2136e03542c56`). The six offline checks passed, covering source join and order, waveform and flag integrity, contrast under the stated perturbations, timing and shared gain in both axes, and unavailable versus below-threshold data.

## VERIFIED · source identity and selection

- GEDI L1B **`GEDI01_B_2019108080338_O01964_T05337_02_003_01.h5`** (DOI `10.5067/GEDI/GEDI01_B.001`) and L2A **`GEDI02_A_2019108080338_O01964_T05337_02_001_01.h5`** (DOI `10.5067/GEDI/GEDI02_A.001`). The rGEDI project distributes subsets with these original identities in the internal NASA metadata. The manifest pins both archives, uncompressed HDF5 hashes, metadata UUIDs, and differing product PGE versions (`003` and `001`). Both have HDF5 `VersionID=01`. [L1B archive](https://raw.githubusercontent.com/carlos-alberto-silva/rGEDI/d91c170a9088f21dc4e62ba5436b6959860bd43b/inst/extdata/GEDI01_B_2019108080338_O01964_T05337_02_003_01_sub.zip) · [L2A archive](https://raw.githubusercontent.com/carlos-alberto-silva/rGEDI/d91c170a9088f21dc4e62ba5436b6959860bd43b/inst/extdata/GEDI02_A_2019108080338_O01964_T05337_02_001_01_sub.zip) · [rGEDI documentation](https://cloud.r-project.org/web/packages/rGEDI/refman/rGEDI.html)
- Joined 300 L1B shots to 300 of 301 L2A shots by integer shot number. Beam and `delta_time` matched exactly for all 300. The one L2A-only shot is recorded and excluded. Shot numbers are decimal strings in JSON to avoid loss of integer precision. Extraction checks the padded shot-number components, beam and channel for each selected shot, and the track and source versions through the granule identities. [L1B V001 guide](https://lpdaac.usgs.gov/documents/590/GEDIL01_User_Guide_V1.pdf)
- The six selected shots are from orbit **O01964**, track **T05337**, full-power **BEAM0101**, channel **2**, near 13.74°S, 44.13°W, Brazil, on **2019-04-18 at 08:21:59 UTC**. The UTC timestamps are derived from the L1B GPS epoch and transmit times using the 18-second GPS–UTC offset for that date. For each shot, `quality_flag`, `surface_flag`, and receiver assessment quality are 1. The L1B and L2A degradation, stale return, elevation bias, receiver assessment error, clipping count, and selected algorithm missing-top flags are 0. Sensitivity is 0.971–0.978. These are satellite product quality indicators. [L2A dictionary](https://edcftp.cr.usgs.gov/project/lpdaac/GEDI_L2/gedi_l2a_product_data_dictionary.html) · [USNO time offset](https://maia.usno.navy.mil/information/eo-values)
- `rxwaveform` is the corrected receiver signal in ADC counts. Each waveform is extracted with its documented one-based start and count. The six complete waveforms contain 789–837 samples each. `rh[100]` is the L2A RH100 in metres for these inputs. Its unit is explicitly corrected in the V001 guide, and the extractor checks agreement with highest return minus lowest mode within 0.03 m. [L1B dictionary](https://edcftp.cr.usgs.gov/project/lpdaac/GEDI_L1A-L1B/gedi_l1b_product_data_dictionary.html) · [L2A V001 §7 erratum](https://lpdaac.usgs.gov/documents/650/GEDI02_UserGuide_V1.pdf)

## DERIVED · comparable return profiles

1. Interpolate the **coordinates of the existing native samples** between the L1B first and last bounce elevations using their WGS84 ellipsoid heights. Subtract the L2A `elev_lowestmode` as the per-shot algorithmic ground reference. The observed vertical sample spacing is about **0.14983 m**, near **1 ns** sample intervals. Sample spacing does not describe effective resolving power. The pulse, receiver processing, terrain slope and mixed scatterers within the roughly 25 m footprint affect the waveform. [GEDI waveform ATBD](https://lpdaac.usgs.gov/documents/581/GEDI_WF_ATBD_v1.0.pdf)
2. For each ADC sample `a`, calculate `max(a - noise_mean_corrected - 3 × noise_stddev_corrected, 0)`. Assign samples by their heights to half-open 1 m bands within **[-10, 22) m** and divide each band sum by the sum across the full window for that shot. Keep the window, threshold rule and scale fixed during either interaction. This is an EARTHPULSE measure of the *share of positive thresholded return*, with a dimensionless denominator for each shot. It supports comparing the shape of these returns, without equating large shares to large absolute returns, calibrating in joules, or attributing the return to leaf density, tree count or biomass. Reflectance, geometry, canopy interception and noise all affect this measure. Values below 0 m are kept on the relative height axis because a detected mode center has returned signal on both sides.
3. An observed band without positive residual has fraction 0 and status `below_processing_threshold`. It expresses the outcome of this processing rule. A missing band has null and status `unavailable`, and incomplete or excluded source shots cannot enter the published sequence. Never fill the spatial gaps or code a QA exclusion as zero.

| Shot number | Step from previous (m) | L2A RH100 (m) | 4–10 m return share | Share under selected-ground stress |
|---|---:|---:|---:|---:|
| 19640519300108399 | — | 7.82 | 6.43% | 2.29–13.16% |
| 19640519500108400 | 57.34 | 5.69 | 0.15% | 0.00–1.93% |
| 19640519700108401 | 57.33 | 8.39 | 7.25% | 3.45–13.31% |
| 19640519900108402 | 57.34 | 10.78 | 7.35% | 4.37–11.25% |
| 19640520100108403 | 57.30 | 10.60 | 15.62% | 10.68–21.83% |
| 19640520300108404 | 57.39 | 10.75 | 17.32% | 10.34–27.39% |

The stress check varies the ground reference by −1, −0.5, 0, +0.5 and +1 m, uses two backgrounds (product noise statistics and median with 1.4826 × MAD outside [−20, 35) m), three threshold multipliers (2, 3 and 4), and three normalization windows ([−8, 20), [−10, 22), [−12, 25) m). It runs 90 selected-ground scenarios per shot and a separate sweep for the available L2A ground algorithms. The low and high endpoint pair for the guided comparison (`…08400` and `…08404`) retains a minimum gap of **8.41 percentage points** across the selected-ground ranges and **16.19 pp** across the algorithm-ground ranges, comparing independent extrema. These scenarios are methodological stress tests, not confidence intervals. Several other ranges overlap, so the data do not support a strict rank across all six footprints. In particular, the two shots with RH100 near 10.7 m and differing base shares (`…08402` and `…08404`) are an exploratory comparison, not the advertised robust contrast.

The vertical interaction has concrete signal to expose: `…08404` has **34.27%** of its positive residual in **[0, 3) m** and **17.32%** in **[4, 10) m** under the primary processing rule. This shows returns across different heights relative to the estimated ground. The horizontal interaction is supported by six spatially distinct samples over **286.71 m**. The reported step is a spherical great-circle center-to-center distance (mean Earth radius 6,371,008.8 m) and advances the playback clock only at those sampled positions.

## DERIVED · sonification mapping

The reference mapping `gedi-relative-return-v1` emits a sine tone at 440 Hz, zero onset phase, duration 95 ms, 9 ms linear attack and 26 ms linear release, with peak linear gain `0.32 × sqrt(f)` where `f` is the return share. The amplitude rule is common to both modes. It preserves within-case ordering and makes the tone's squared peak amplitude proportional to `f`. It does not guarantee equal perceived increments in loudness. Use a common user volume and no per-shot automatic gain.

- **Vertical** schedules the 32 bands from low to high. Time is `0.13 × (lower_band_edge_m + 10)` seconds. Time represents relative height, not the native laser travel time.
- **Horizontal** locks a band and plays the observed footprints in acquisition order. Time is `cumulative_distance_m / 65` seconds. The gain uses the sum of the existing normalized shares in the locked band. There are no tones for intervening locations.
- A below-threshold or unavailable event carries its own status with no data tone. Keep the mark or announcement for its status, so a silent plot point is not confused with missing data. Same-height positions in both modes use the same share and gain. This mapping has been tested as an event sequence. Human ability to interpret the contrast is unverified.

## EIC relationship and remaining gates

NASA SVS 4950 depicts GEDI RH100 sourced from **L2B**, with a filtered set of observations and a vertically exaggerated rendering. The selected global still `GEDI_global_w_colorbar_0900_print.jpg` was verified by HTTP response and its SHA-256 is in the manifest. It can anchor an explanation of track coverage and the RH100 legend. The sample's six L1B waveforms and corresponding L2A metrics are separate observations from the same mission. Public SVS documentation has no frame-to-shot inventory to validate an overlay. [SVS 4950](https://svs.gsfc.nasa.gov/4950/) · [SVS method](https://svs.gsfc.nasa.gov/images/events/2022/Viz4Climate/1004/vis22w-sub1004-cam-i7.pdf)

**UNVERIFIED.** A current V002 match is open. The official same-orbit/track CMR candidates are `G2164347602-LPCLOUD` and `G2164259609-LPCLOUD`. Redwood candidates are `G2699305859-LPCLOUD` and `G2700982893-LPCLOUD`. The four files returned Earthdata Login HTTP 401 in bounded range probes. With authorized Earthdata access, request a spatial subset preserving shot identifiers, waveform indices, geolocation, ground and QA fields, then recheck the match and contrast. The V001 reference is suitable for controlled scientific prototyping. Promote a final case after validating V002, reviewing the proposed EIC pairing and testing whether users can identify the height band and compare the return without relying on animation or narration alone. [NASA guidance on subsetting](https://github.com/nasa/GEDI-Data-Resources/blob/main/guides/gedi-earthdata-search.md) · [NASA V001 status](https://data.nasa.gov/dataset/gedi-l2a-elevation-and-height-metrics-data-global-footprint-level-v001-57bd2)
