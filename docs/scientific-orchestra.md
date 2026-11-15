# Scientific Orchestra implementation

Integration update: see [the main integration and audio verification report](scientific-orchestra-integration.md) for the current package, publication conflicts and new render tests. The report below records the original implementation.

Implemented on `feat/scientific-orchestra`, inside the existing Sound Studio. No commit, push or merge was performed. Existing staged and unstaged work, including the desert-wind changes in the shared transport, was retained. The scientific JSON package was not modified.

## Specification coverage

All eight pages of `docs/specifications/EarthPulse_Scientific_Orchestra_Andre.pdf` were extracted and read; all eight were also rendered and visually inspected.

| PDF requirement | Implementation |
| --- | --- |
| Advanced listening inside Studio, not another page | Expandable Orchestra workspace immediately below the existing map |
| Existing selection, primary map and timeline | Reuses the selected geographic cell and date; map colors retain the primary phenomenon |
| Multiple compatible scientific channels | Rainfall, temperature and wind play together in the exact hourly window |
| Honest partial availability | Dust is supported in its own three-hour window and disabled in the hourly mix; hourly layers are disabled in the dust window |
| Play, Pause, Stop, Replay | Shared transport; pause retains time; replay starts the same deterministic excerpt; stop resets time and stops all voices |
| Independent activation, Mute, Solo, gain | Per-phenomenon gain buses; multiple Solo buttons form an inclusive solo set; mute overrides solo; disabled channels do not suppress valid solos |
| Scientific compatibility | Exact physical cell footprint, exact interval and averaging kind, build, provenance, aggregation, units, finite values and derived-value checks |
| Explanations | Channel variable, real value, unit, averaging window, source product, mapping, model build, granule and source warnings |
| Smooth, bounded sound | Existing attack/release envelopes; 20 ms cancellation fades; 12 ms gain smoothing; fixed four-way headroom |
| One managed audio system | Existing Studio audio context, transport, analyser and waveform; no second player or MP3 ambience |
| Context transitions | Old scheduling and speech are cancelled before loading; stale async results and pending playback are guarded |
| Guided / Pure | Existing speech manager, speech ducking and explicit explanations; switching modes preserves selection, date, listening window and channel settings |
| Desktop/mobile, Arabic/English | Shared fonts, colors and controls; responsive bottom workspace, native keyboard controls, visible focus, RTL text, geographic LTR, reduced-motion support |
| Existing tools | Orchestra yields the transport and collapses when another advanced tool is opened; existing tools and APIs remain in place |

## Audited data and compatibility matrix

Source package: `deliverables/EarthPulse-JSON-ONLY/`. Browser package: `web/assets/earthpulse-json/`. The existing `openPackage` loader checks catalog asset sizes and SHA-256 with CRLF normalization. Orchestra requires verified integrity; it does not silently downgrade to unchecked mixing.

These are **NASA GMAO GEOS-FP model outputs**, not synchronized satellite observations. There are 13 selected dates from December 2024 through November 2025, including August 15 and August 19. Sparse dates are not a continuous time series or a seasonal climatology.

| Channel | JSON snapshots | Variable and used unit | Source | Exact UTC averaging interval | Can mix with |
| --- | --- | --- | --- | --- | --- |
| Rainfall | `rainfall/snapshots/geos-fp-rainfall-*-1930.json` | PRECTOT-derived interval accumulation, mm over this hour | DFPT1NXFLX | 19:00–20:00, one-hour mean | Temperature, wind |
| Temperature | `temperature/snapshots/geos-fp-temperature-*-1930.json` | T2M-derived Celsius, °C at 2 m | DFPT1NXSLV | 19:00–20:00, one-hour mean | Rainfall, wind |
| Wind | `wind/snapshots/geos-fp-wind-*-1930.json` | U10M/V10M-derived speed, m/s at 10 m | DFPT1NXSLV | 19:00–20:00, one-hour mean | Rainfall, temperature |
| Dust | `dust/snapshots/geos-fp-dust-*-1930.json` | DUEXTTAU at 550 nm, dimensionless optical depth | DFPT3NXAER | 18:00–21:00, three-hour mean | Dust alone in this release |

All four target grids contain 25 × 40 physical cells over 20°W–50°E, 15°N–45°N. Grid identifiers differ, so compatibility compares actual centers and bounds at the selected index, orientation, dimensions and overall bounds. No interpolation or regridding is invented. Native source resolution is 0.25° latitude × 0.3125° longitude. The existing documented spherical footprint aggregation is required. Datum limitations remain visible in source warnings.

Both literal model labels are supported, with **exact equality required within a mix**:

- `GEOSadas-5_29_5-p6 experiment_id: f5295_fp`
- `GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp`

The labels are not assumed equivalent. Version must be 5.29.5. Product identifiers, native resolution, granule, NASA source URL and source SHA-256 metadata are checked. A matching model label or compatibility group alone cannot establish compatibility.

The initial listening window follows the primary map snapshot. The user may explicitly choose the other *actual* averaging window for the same date in Orchestra. This changes which audio layers are eligible; it does not silently relabel the map or manufacture a new observation. The selected averaging-window kind is preserved when moving between dates. Switching the primary map phenomenon adopts that phenomenon's window. Channel preferences persist across both changes.

Null, undefined and non-finite values are unavailable, never zero. Derived-value checks use a 1e-7 numerical tolerance. Rain accumulation is checked against rate × 3600; Celsius against Kelvin − 273.15; wind speed and direction against the aggregated vector. Negative rainfall, wind or dust values are rejected. Invalid channels remain disabled with a reason. Dust cases locked by the existing learning flow remain locked. Change/comparison maps must return to absolute values before Orchestra can play.

**Blocked scientific requirement:** the current package cannot support a scientifically synchronous four-channel mix. Equal center timestamps at 19:30 do not make the one-hour and three-hour averages interchangeable. No averaging, nearest-date substitution or fabricated values were added to make dust join the hourly trio.

## Data-to-sound mappings

Reuses `web/studio/sonify.js`, `datasets.js` normalizers and `web/audio/voices.js`, with the existing `earthmap-v1` mapping. Each Play represents the selected model mean for a deterministic 12-second listening excerpt. The 12 seconds are an audio duration, not a claim about environmental evolution.

| Layer | Fixed normalization | Sound |
| --- | --- | --- |
| Rain | `sqrt(clamp(accumulation_mm / 4, 0, 1))` | 520 Hz triangle pulses at `1.5 + 12.5n` pulses/s; ≤0.002 mm is silent |
| Temperature | `clamp((C + 15) / 60, 0, 1)` | Continuous sine at `220 × 2^(2n)` Hz: 220–880 Hz |
| Wind | `clamp(speed_mps / 16, 0, 1)` | 180 Hz triangle pulses at `2 + 14n` pulses/s; stereo pan follows `u / hypot(u,v)`, centered for calm/undefined direction |
| Dust | `clamp(log(max(AOD, .001) / .001) / log(2500), 0, 1)` | `3 + 21n` pulses/s, `900 × 2^(1.5n)` Hz, triangle/square/sawtooth across thirds |

Wind direction is the direction of **flow** for stereo, not the meteorological direction-from label. Dust optical depth is not surface PM concentration. Rainfall is the actual one-hour water-equivalent accumulation, not IMERG and not a daily rain rate.

Fractional pulse rates preserve phase across the whole excerpt (`k / rate`); they do not restart at second boundaries. All events share one transport origin. Gain, mute and solo alter bus levels without rescheduling voices or changing evidence, pitch, rhythm or normalization. Stereo geography is never mirrored for Arabic.

Each bus has a fixed `1/4` output allowance, independent of the number of active channels. Existing tone peak gain is 0.16. With at most two overlapping 70 ms wind pulses and one voice per other layer, the conservative four-layer digital peak bound is 0.20 before the shared master (which is clamped to 0–1). This provides digital headroom without changing scientific scales or boosting remaining channels when others are muted. Physical listening level still depends on the user's device.

On cancellation, scheduled oscillator envelopes fade to zero over 20 ms and nodes disconnect on completion. Channel gain changes use the transport's 12 ms target smoothing. The existing Studio speech manager ducks the shared output during narration and restores it gradually. Page exit releases buses and closes the context.

## Files and reuse

New implementation:

- `web/studio/orchestra-data.js`: compatibility gate and deterministic multi-channel plans.
- `web/studio/orchestra.js`: bottom workspace, channel preferences, loading/playback lifecycle and Studio integration.
- `web/studio/orchestra-copy.js`: English/Arabic interface, mappings and rejection explanations.
- `web/studio/orchestra.css`: shared Studio styling, responsive layout and motion preferences.
- `tests/orchestra.test.mjs`: real-package data, audio graph and lifecycle tests.
- `tests/orchestra-browser.mjs`: actual Chromium/Web Audio integration, controls, transitions and screenshots.
- `docs/scientific-orchestra.md`: this audit, mapping and delivery record.

Focused changes to existing files:

- `web/audio/transport.js`: optional independent channel buses, mid-tone resume for Orchestra, fade cleanup and disposal; retains the existing desert-wind implementation.
- `web/studio/audio.js`: idempotent sound enabling and optional confirmation tone.
- `web/studio/datasets.js`: retains source metadata and verified-integrity status for compatibility checking.
- `web/studio/studio.js`: workspace mounting, map-stage wrapper and audio/tool ownership.
- `web/pages/studio.html`: includes the Orchestra stylesheet.
- `.gitignore`: ignores temporary test screenshots and PDF renders under `/tmp/`.

No dependency was added to `package.json`. Playwright was installed in a temporary tooling directory for verification. Existing data loading, map renderer, selected-cell hooks, data-change hooks, timeline, transport, voices, analyser, shared DOM builder, settings, learning locks and speech manager are reused.

## Run and use

From the repository root:

```powershell
npm.cmd start
```

Open `http://127.0.0.1:4173/pages/studio.html`, enter Studio and choose Guided Voice or Pure Sonification. Select a cell and date, then open **Orchestra** beside the timeline/map legend. Select **19:00–20:00 UTC** for rainfall + temperature + wind, or **18:00–21:00 UTC** for dust. Play, enable/disable channels, use Mute/Solo and adjust listening volume. Dry rainfall is intentionally silent. Expand a channel's explanation for mapping and provenance; the explanation button requests speech in either mode. Collapse or press Escape inside the workspace to stop and return focus to its opener. Other Studio tools retain their existing entry points.

## Verification and known limits

Executed verification:

- `node --test tests/orchestra.test.mjs`: **7/7 pass**. Includes all 13 real dates × 1,000 cells, honest dust exclusion, mutated test-only invalid inputs, exact fractional-rate timing, independent bus controls, node cleanup and cancellation during pending audio startup.
- `node tests/orchestra-browser.mjs`: **pass** in actual Chromium at 1440×900 and 390×844 in both English and Arabic. Checks native mixed audio output, simultaneous starts, activation/mute/solo/gain, pause/replay/stop, silence after stop, selection/date transitions, mode preservation, speech requests, keyboard reachability, overflow and workspace geometry. Also checks a failed wind dataset leaves two valid channels, missing integrity disables mixing, audio refusal shows feedback, and Home/Explore/Science/About still load.
- `node tests/atlas-browser.mjs` with the archive URL: **pass**, including data retry and visual audio fallback.
- `node tests/browser-smoke.mjs`: **pass**, including Forest keyboard/audio journeys, bilingual mobile layout, retry and unavailable-audio fallback.
- `node tests/decode-eyes-browser.mjs`: **pass**, English and Arabic accessibility fixture.
- `node tests/decode-integration-browser.mjs`: bilingual fixture/provenance/bootstrap portions pass; final live-dust oscillator expectation times out. The same timeout at line 293 was reproduced against the separate pre-Orchestra copy.
- `python -B science/gedi/validate_sample.py`: **6/6 pass**.
- `npm.cmd test`: **245 pass, 4 fail, 1 skipped** across 250 tests. The 4 failures below reproduce before Orchestra; all 7 new tests pass. The skipped optional layout test requires browser environment configuration in this invocation; separate browser suites were run explicitly.
- `npm.cmd run build`: **pass**, production `dist/` generated successfully.
- `git diff --check`: **pass**.

Four actual browser screenshots were opened and visually inspected at `tmp/orchestra-screenshots/orchestra-{en,ar}-{1440,390}.png`. No horizontal overflow or map/workspace overlap was found. Mobile channel content is intentionally scrollable and keyboard reachable; opening the workspace retains a map region at least 400 pixels tall. Desktop retains at least 384 pixels. Scrollable explanations expose complete provenance without expanding over the map.

Automated browser audio uses real native oscillators, gains, panning and analyser output. Speech calls are instrumented in the browser tests; actual human voice quality and installed Arabic voice availability are not certified. The existing speech manager falls back to accessible text when no matching voice is available. No human NVDA or listening study was performed.

The initial full suite had four failures unrelated to Orchestra. They were reproduced in a separate temporary copy with these implementation changes removed and the pre-existing working changes retained:

1. `cinematic.test.mjs`: packaged three.js SHA-256 differs from its documentation.
2. `decode-integration.test.mjs`: real-dust renderer playback expectation differs.
3. `spatial-sound.test.mjs`: sample voice duration expectation differs (1 s versus 1.8 s).
4. `spatial-sound.test.mjs`: audio-refusal completion expectation differs for the longer dust plan.

These files and assertions were not changed to conceal the failures. The existing Decode integration browser script also expects dust oscillators in its final live-audio segment, while the pre-existing desert-wind implementation uses a sample; this segment times out. Earlier bilingual fixture/bootstrap portions pass. The separate Decode accessibility browser suite passes.

Human judgment is still needed for device-specific loudness and musical clarity. The current supported scientific package is deliberately narrow: new variables, units, model builds, grids or averaging conventions require another audit before being enabled.
