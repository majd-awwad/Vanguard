# Scientific Orchestra: main data integration and audio verification

Integration performed on 2026-11-15. This report supersedes the data-availability notes in the original `scientific-orchestra.md` implementation report.

## Git integration and preservation

- Original and current branch: `feat/scientific-orchestra`.
- Original and current HEAD: `768699e4786bfb09a45a393f7e1dd9d2f5733b6d`.
- Fetched main: `3bb5f7b0b69d09fa7597f866940ebaf96e2616a5` (`Merge pull request #9 from majd-awwad/JSON_Files`).
- Orchestra was uncommitted; the specification PDF was already staged. Teammate desert-wind work was also uncommitted.
- Before changing files, saved binary working/index patches, a status snapshot, copies and SHA-256 fingerprints of 26 staged/modified/untracked files to `C:/Users/andre/AppData/Local/Temp/earthpulse-main-integration-backup-h574o8d2/`.
- Used a **focused file integration** on the current branch. No pull, merge, cherry-pick, reset, stash, branch switch, commit or push. HEAD and the staged PDF remain unchanged.
- Checked the source package had no staged/unstaged changes before importing it. Materialized its 64 files as exact `origin/main` Git-blob bytes and regenerated the existing browser copy. Only 10 source files have content changes against HEAD; the other source files retain the same Git content. Canonical LF bytes are necessary for the new exact-byte contract on Windows.
- Verified all 64 source files are byte-identical to fetched main, and all 52 parsed scientific snapshots are identical to previous HEAD. No measurement, grid, scientific unit, timestamp or averaging interval was changed.
- The existing shared audio transport, voices, single-layer plans, MP3 and desert-wind tests were preserved byte-for-byte relative to the backup. Four existing Orchestra/data files were enhanced; the rest of the original implementation was retained.
- No Git conflict occurred. The two publication-metadata conflicts below are upstream data declarations, not merge conflicts.

## What main actually contains

There are **no new files, recordings, intensity variants or measurements** in the fetched change. The exact changed paths under `deliverables/EarthPulse-JSON-ONLY/` are:

| Path | Format and purpose | Integration |
| --- | --- | --- |
| `catalog.json` | JSON master asset hashes/sizes and stricter integrity policy | Imported exactly; browser and build honor exact bytes |
| `dust/catalog.json` | JSON collection publication fingerprints | Imported exactly; contradictions identified per observation |
| `dust/snapshots/geos-fp-dust-20250115-1930.json` | JSON formatting only; same numerical/scientific content | Imported exactly |
| `dust/snapshots/geos-fp-dust-20250615-1930.json` | JSON formatting only | Imported exactly |
| `dust/snapshots/geos-fp-dust-20250715-1930.json` | JSON formatting only | Imported exactly |
| `dust/snapshots/geos-fp-dust-20250815-1930.json` | JSON formatting only | Imported exactly |
| `dust/snapshots/geos-fp-dust-20251015-1930.json` | JSON formatting only | Imported exactly |
| `rainfall/catalog.json` | JSON adds literal build/group declarations and comparison policy | Imported and validated against snapshots |
| `temperature/catalog.json` | Same metadata enhancement | Imported; temperature sound mapping unchanged |
| `wind/catalog.json` | Same metadata enhancement | Imported and validated against snapshots |

The same 10 paths changed in `web/assets/earthpulse-json/`. Builds now run the existing verified package copier before generating `dist/`, preventing stale browser catalogs.

### Scientific context and compatibility

All four phenomena remain NASA GMAO GEOS-FP **model output**, using spherical area-weighted native-footprint aggregation onto 25 Ã— 40 cells over 20Â°Wâ€“50Â°E, 15Â°Nâ€“45Â°N. Thirteen sampled dates cover December 2024â€“November 2025, including two August cases. These are selected means, not continuous measurements or seasonal climatology.

| Layer | Variable / scientific unit | Product | Averaging support | Compatible audio layers |
| --- | --- | --- | --- | --- |
| Rainfall | PRECTOT, kg mâˆ’2 sâˆ’1; derived exact-hour accumulation in mm | DFPT1NXFLX | 19:00â€“20:00 UTC, one-hour mean | Temperature and wind |
| Temperature | T2M in K; derived Â°C at 2 m | DFPT1NXSLV | 19:00â€“20:00 UTC, one-hour mean | Rainfall and wind |
| Wind | U10M/V10M, m/s at 10 m; derived vector speed/direction | DFPT1NXSLV | 19:00â€“20:00 UTC, one-hour mean | Rainfall and temperature |
| Dust | DUEXTTAU, extinction AOD at 550 nm, dimensionless | DFPT3NXAER | 18:00â€“21:00 UTC, three-hour mean | Dust alone, subject to publication checks |

The new compatibility groups are checked against actual source metadata. They do not override the existing checks for physical cell centers/bounds, grid orientation, exact start/end/center/averaging kind, literal model build/version, product, provenance, variable definitions, units, derived values, missing values or supported aggregation. No nearest timestamp substitution or temporal re-aggregation is performed.

### Upstream publication conflicts

The master asset catalog verifies **63/63 files**, but the stricter new policy also requires collection publication declarations to agree. Two dust entries do not:

| Observation | Master / actual bytes and SHA-256 | Collection declaration |
| --- | --- | --- |
| 2024-12-15 | 22426 bytes; `abb3f0111187dd8a47d9ca122afd413824afb5c017c0a4d4fb794cfde4f6bbb8` | 25037 bytes; `2960c31f5bec79f266f53a77b99995ef3382fcea856b1b0580d79c48b57a8420` |
| 2025-01-15 | 25083 bytes; `3dd6c72a102ed390efd495afc978abe7929ca738614ccff5668e05b4bd9492b4` | 25082 bytes; `ca7efc487670a6632cb36c456216fca85be348fe31b1dd4eaa95786d401e43f4` |

The January declaration describes bytes without the delivered leading blank line (verified by hashing the exact file with only its first LF removed). The new policy explicitly disallows that formatting exemption. The December declaration does not describe the delivered file; its cause remains unresolved. These files were **not repaired locally**. Orchestra disables those dust observations with English/Arabic explanations until the publisher reconciles the declarations. The other 11 dust observations remain eligible subject to the existing learning locks. The hourly trio still works on December/January dates when the hourly listening window is selected.

The regenerated provenance documents include these conflicts in their quality flags. Raw snapshot inspection remains available; conflicting metadata is not hidden by converting the whole phenomenon to a loading error.

### Environmental recordings

Fetched main adds **no MP3, WAV, OGG or environmental intensity metadata**. Therefore no invented light/moderate/heavy categories, texture crossfades or texture toggle were added.

The pre-existing user asset `web/assets/audio/desert-wind.mp3` remains unchanged: 42236 bytes, SHA-256 `340ac1cc104ddd964c9b7fdf5421a7b46789be1bb2b9447c298dd70b94e1ab84`. Chromium successfully decoded it to 3.14 seconds of stereo audio in the test's 48 kHz context. That decoded rate does not establish the original encoded sample rate. Its existing documentation identifies an environmental effect with provenance/licensing requiring review; there is no verified scientific location, observation interval or intensity calibration. It was not relabeled as NASA data or newly added to Orchestra. Its existing legacy playback integration was preserved.

## Implementation and reused architecture

No second audio engine, mixer, interface, AudioContext, page, dependency or asset copy was introduced. The existing `createTransport`, Studio analyser, channel buses, `orchestraPlan`, `valueTones`, `soundParams`, fixed normalizers, speech manager and bottom workspace remain in use.

The numerical mappings are unchanged:

- Rainfall: `n = sqrt(clamp(mm/4))`; `1.5 + 12.5n` triangle pulses/s at 520 Hz. â‰¤0.002 mm is silent.
- Temperature: `n = clamp((C+15)/60)`; sine frequency `220 Ã— 2^(2n)` Hz.
- Wind: `n = clamp(speed/16)`; `2 + 14n` triangle pulses/s at 180 Hz. Pan follows `u/hypot(u,v)` with calm centered, independent of Arabic layout direction.
- Dust: `n = clamp(log(max(AOD,.001)/.001)/log(2500))`; `3 + 21n` pulses/s, `900 Ã— 2^(1.5n)` Hz, with the existing triangle/square/sawtooth timbre thirds.

Each variable retains its own scale; listening gain never changes scientific values or normalization. All active channels share the existing transport clock and fixed four-way headroom. No MP3 replaces Orchestra's numerical sonification.

Two lifecycle corrections were necessary:

1. Stop/Pause during a pending observation refresh now revokes its old automatic-resume intent.
2. Opening Orchestra ends an existing Area/Path scan controller, preventing an orphaned scan/busy state from breaking ordinary exploration after collapse.

Activation, Mute, inclusive Solo, volume, Play/Pause/Stop/Replay, Guided/Pure modes, explanations and current workspace placement remain unchanged.

### Files changed by this integration

- The 10 upstream JSON files listed above and their 10 existing browser mirrors.
- `.gitattributes`: source package checkouts use LF on Windows.
- `scripts/earth-map/copy-package.mjs`: honors the new exact-byte verification/copy contract, retaining legacy-policy behavior for older packages.
- `scripts/build.mjs`: synchronizes the verified package before building.
- `scripts/earth-map/provenance.mjs`: uses the same catalog validator and records publication conflicts.
- `docs/earth-map/provenance.json` and `docs/earth-map/DATA_PROVENANCE.md`: regenerated hashes and quality notes.
- `web/studio/datasets.js`: strict-byte fetching and per-snapshot catalog/group/source/time/publication validation.
- `web/studio/orchestra-data.js`: excludes contradictory publication metadata without weakening physical compatibility checks.
- `web/studio/orchestra-copy.js`: English/Arabic publication-conflict explanation.
- `web/studio/orchestra.js`: displays the reason and fixes the two lifecycle issues above.
- `tests/orchestra-integration.test.mjs`: new package/publication integration tests.
- `tests/orchestra-audio-browser.mjs`: new native rendering, real-data audio and interaction/regression checks.
- `docs/scientific-orchestra-integration.md`: this report; the original implementation report links here.

The shared `web/audio/transport.js`, `voices.js`, `spatial-plan.js`, `wind-sample.js`, the MP3, the previous Orchestra tests, its CSS and page layout were not changed by this integration.

## Executed testing

| Command | Result |
| --- | --- |
| `node scripts/earth-map/copy-package.mjs` | 63/63 master asset sizes/hashes pass |
| `node scripts/earth-map/provenance.mjs` | 4 manifests regenerated, including both publication conflicts |
| `node --test tests/orchestra-integration.test.mjs tests/orchestra.test.mjs` | 12/12 pass |
| Focused Orchestra, data, analysis, UI, Studio and navigation test files | 71/71 pass |
| `npm.cmd test` | 250 pass, 4 pre-existing failures, 1 optional browser check skipped; 255 total |
| `npm.cmd run build` | Production `dist/` generated successfully |
| `node tests/orchestra-audio-browser.mjs` | Native render and full Studio integration checks pass |
| `node tests/orchestra-browser.mjs` | English/Arabic, 1440Ã—900 and 390Ã—844, real audio controls and failure handling pass |
| `node tests/atlas-browser.mjs` with `EARTHPULSE_URL=http://127.0.0.1:4173/atlas.html` | Archive data/audio/RTL/retry/fallback checks pass |
| `node tests/browser-smoke.mjs` | Forest keyboard/audio, bilingual layout, retry and unavailable-audio checks pass |
| `node tests/decode-eyes-browser.mjs` | English/Arabic accessibility fixture passes |
| `python -B science/gedi/validate_sample.py` | 6/6 pass |
| `git diff --check` | Pass |

Browser commands used the existing Chrome executable and a temporary Playwright tooling installation, with `EARTHPULSE_PLAYWRIGHT` and `EARTHPULSE_BROWSER` set. No package dependency was added to EarthPulse.

The four unchanged full-suite failures concern the documented three.js checksum, an existing dust renderer expectation, and two existing dust sample-duration/completion expectations. They predate this integration and are documented in the original report. No assertions were weakened to conceal them.

### Actual audio rendering and interaction evidence

The new audio suite schedules the **existing transport and actual scientific plans** into native Chromium OfflineAudioContext nodes. It exports 12 stereo PCM WAVs at 48 kHz, each 2.1 seconds long, to `tmp/orchestra-audio/`, plus `metrics.json`. These files are diagnostic sonification, not NASA recordings or a production music-export feature.

- Low/high real rainfall, wind, dust and temperature cells all produced finite, nonzero native audio.
- Rendered rainfall/dust pulse bursts match the mapped schedules, allowing the existing scheduler to omit terminal pulses that cannot fit a complete safe envelope before the excerpt ends.
- Temperature zero-crossing estimates agree with mapped pitch within 3 Hz.
- Wind stereo energy follows actual vector-flow pan, including centered calm wind.
- Highest measured peak in the rendered examples was **0.08933 full scale** (about âˆ’21 dBFS), with the shared master and enabled channels set to maximum listening gain. These samples do not clip.
- Dry rainfall and a fully muted mix render exact silence. The stop-fade render has exact silence after 0.65 seconds when cancellation was requested at 0.5 seconds.
- Actual live Studio checks passed for five Pause/Play cycles, 20 rapid Mute/Solo/activation toggles without rescheduling voices, 25 rapid cell changes, 12 date changes, 25 Play/Stop cycles, stopping during a delayed adapter refresh, no remaining live/future oscillator nodes after Stop, one live Studio AudioContext, and context closure on page exit.
- After Orchestra, actual ordinary exploration, Area scan, Path scan, Compare values, Hunter highest-value rankings and Echo matches were exercised successfully with the integrated package. Home/Explore/Science/About navigation also passed.
- No JavaScript errors or failed resource requests occurred in the native audio integration suite. Deliberate failed-resource tests in the existing suite continued to degrade to supported channels or clear unavailable states.

The four desktop/mobile English/Arabic screenshots and the publication-conflict screenshot were opened and visually inspected. The workspace remains below the map; no new panels or layout redesign were introduced.

**Human listening was not performed.** Signal rendering and measured output establish scheduling, mapping, silence and numerical headroom, not subjective musical quality, perceptual comfort or absence of audible artifacts on every device. Physical volume depends on hardware. A headphone listening pass and human screen-reader session remain outstanding.

## Manual testing handoff

From the repository root, run:

```powershell
npm.cmd start
```

Open `http://127.0.0.1:4173/pages/studio.html`. Choose Guided Voice or Pure Sonification, select **2025-04-15**, select a map cell, and open **Orchestra** beside the existing timeline/legend. Select **19:00â€“20:00 UTC** for the rainfall/temperature/wind mix. Select **18:00â€“21:00 UTC** for valid dust playback. No environmental texture switch appears because fetched main supplies no such assets.

Use the map or its existing arrow keys; Enter selects the focused cell. These are verified actual model samples on 2025-04-15:

| Layer | Low example | High example | Expected audible difference |
| --- | --- | --- | --- |
| Rainfall | L19, 31.2Â°N 12.375Â°E: 0.050538 mm/hour interval | G15, 37.2Â°N 5.375Â°E: 3.870275 mm/hour interval | 2.905 â†’ 13.796 pulses/s at fixed 520 Hz |
| Wind | L15, 31.2Â°N 5.375Â°E: 0.108382 m/s | H10, 36Â°N 3.375Â°W: 14.324071 m/s | 2.095 â†’ 14.534 pulses/s; calm centered â†’ eastward flow near right |
| Dust | P1, 26.4Â°N 19.125Â°W: AOD 0.010733 | U39, 20.4Â°N 47.375Â°E: AOD 2.172709 | 9.370 â†’ 23.623 pulses/s; higher pitch and changed timbre |
| Temperature | E35, 39.6Â°N 40.375Â°E: âˆ’3.455695 Â°C | Y5, 15.6Â°N 12.125Â°W: 38.025495 Â°C | 287.25 â†’ 749.03 Hz |

For a real simultaneous mix, select **A13 (44.4Â°N, 1.875Â°E)** in the hourly window: rainfall 2.380491 mm for the hour, temperature 7.555117 Â°C, wind 1.635535 m/s. These three values share the same physical cell and interval. Use Solo to hear each mapping, clear Solo to restore the mix, Mute one channel, and vary its volume. Change location/date while playing, then Stop and Replay. The current observation's values and sound must update together. Expand explanations for mapping and provenance. F31 on April 15 has exactly zero rain and must be silent when rainfall is isolated.

To check rejection, choose dust on **2025-01-15** in the three-hour window: its publication-conflict message must appear and Play must be disabled. Select that day's hourly window to recover the valid three-channel mix. Switching to Guided/Pure retains settings. Collapse Orchestra to return to ordinary exploration; scans, Compare, Hunter and Echo retain their existing entry points.

Useful diagnostic outputs: `tmp/orchestra-audio/hourly-mix.wav`, `rainfall-low.wav`, `rainfall-high.wav`, `dust-low.wav`, `dust-high.wav`, `hourly-stop-fade.wav`, `metrics.json`, `git-integration-audit.json` and `catalog-conflict.png`. Temporary outputs are ignored by Git.


## Personal branch publication: 2026-11-15

The sections above record the historical implementation and integration sessions.
The upload snapshot is scoped to Andreh's Scientific Orchestra work on
`mohammad/scientific-orchestra`, starting from `768699e4786bfb09a45a393f7e1dd9d2f5733b6d`.
No history was rewritten and no main/team branch was merged or pushed.

The new listening-window state selects the largest validated group initially,
preserves the selected window when the map phenomenon changes, and offers an
explicit alternative when that window becomes unavailable. English/Arabic counts
separate compatible, enabled and sounding layers; dry rainfall remains silent.
Mobile channel shortcuts retain the existing bottom workspace.

The fetch identified newer main HEAD `0af3805` (including removal of Temperature).
Those product changes are not integrated into this preservation branch. All 64
scientific delivery files were verified byte-identical to fetched main; their
focused file integration is included without importing unrelated main UI changes.

Teammate desert-wind changes remain local and are excluded: `spatial-plan.js`,
`voices.js`, `wind-sample.js`, the MP3, its README and tests, and the sample-specific
transport changes. The shared transport was staged partially, keeping only
Orchestra channel buses, gain controls, scheduling, stop and cleanup. The Orchestra
native-render suite no longer requires or audits that unrelated recording.
IDE files, generated recordings, screenshots and build output are excluded.

The exact staged tree was exported outside the repository and tested independently:

- `npm.cmd test`: 237 passed, 1 failed, 1 skipped (239 total). The remaining failure
  is the pre-existing cinematic three.js documentation checksum assertion.
- The original mixed working tree: 256 passed, the same 4 baseline failures,
  1 skipped (261 total). The three additional failures concern teammate dust
  sample renderer/duration/completion expectations; that work is not uploaded.
- Focused Orchestra/data/Studio/navigation suites: 77/77 passed.
- `npm.cmd run build`: passed.
- `node scripts/earth-map/copy-package.mjs --check`: 63/63 assets verified.
- `node tests/orchestra-audio-browser.mjs`: all 16 real-data native renders passed,
  including F23 (February 15), I7 (November 15), F15 (April 15) and H21 (November 15).
  Three simultaneous scientific layers render for the first three; H21 rainfall
  is intentionally silent. Scans, Compare, Hunter, Echo and cleanup also passed.
- Browser playback/layout/EN/AR/mobile tests were run against that exported tree.
  Human listening was not performed.

### Exact files included in this upload

- `.gitattributes`
- `.gitignore`
- `deliverables/EarthPulse-JSON-ONLY/catalog.json`
- `deliverables/EarthPulse-JSON-ONLY/dust/catalog.json`
- `deliverables/EarthPulse-JSON-ONLY/dust/snapshots/geos-fp-dust-20250115-1930.json`
- `deliverables/EarthPulse-JSON-ONLY/dust/snapshots/geos-fp-dust-20250615-1930.json`
- `deliverables/EarthPulse-JSON-ONLY/dust/snapshots/geos-fp-dust-20250715-1930.json`
- `deliverables/EarthPulse-JSON-ONLY/dust/snapshots/geos-fp-dust-20250815-1930.json`
- `deliverables/EarthPulse-JSON-ONLY/dust/snapshots/geos-fp-dust-20251015-1930.json`
- `deliverables/EarthPulse-JSON-ONLY/rainfall/catalog.json`
- `deliverables/EarthPulse-JSON-ONLY/temperature/catalog.json`
- `deliverables/EarthPulse-JSON-ONLY/wind/catalog.json`
- `docs/earth-map/DATA_PROVENANCE.md`
- `docs/earth-map/provenance.json`
- `docs/scientific-orchestra-integration.md`
- `docs/scientific-orchestra.md`
- `docs/specifications/EarthPulse_Scientific_Orchestra_Andre.pdf`
- `scripts/build.mjs`
- `scripts/earth-map/copy-package.mjs`
- `scripts/earth-map/provenance.mjs`
- `tests/orchestra-audio-browser.mjs`
- `tests/orchestra-browser.mjs`
- `tests/orchestra-integration.test.mjs`
- `tests/orchestra-state.test.mjs`
- `tests/orchestra.test.mjs`
- `web/assets/earthpulse-json/catalog.json`
- `web/assets/earthpulse-json/dust/catalog.json`
- `web/assets/earthpulse-json/dust/snapshots/geos-fp-dust-20250115-1930.json`
- `web/assets/earthpulse-json/dust/snapshots/geos-fp-dust-20250615-1930.json`
- `web/assets/earthpulse-json/dust/snapshots/geos-fp-dust-20250715-1930.json`
- `web/assets/earthpulse-json/dust/snapshots/geos-fp-dust-20250815-1930.json`
- `web/assets/earthpulse-json/dust/snapshots/geos-fp-dust-20251015-1930.json`
- `web/assets/earthpulse-json/rainfall/catalog.json`
- `web/assets/earthpulse-json/temperature/catalog.json`
- `web/assets/earthpulse-json/wind/catalog.json`
- `web/audio/transport.js`
- `web/pages/studio.html`
- `web/studio/audio.js`
- `web/studio/datasets.js`
- `web/studio/orchestra-copy.js`
- `web/studio/orchestra-data.js`
- `web/studio/orchestra-state.js`
- `web/studio/orchestra.css`
- `web/studio/orchestra.js`
- `web/studio/studio.js`
