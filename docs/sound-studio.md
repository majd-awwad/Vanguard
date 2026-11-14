# Earth Sound Studio (`/pages/studio.html`)

An interactive map of real NASA GMAO GEOS-FP dust (`DFPT3NXAER`, `DUEXTTAU`, dust extinction AOT at 550 nm,
dimensionless unit `1`) over North Africa and the Mediterranean (west -20, east 50, south 15, north 45). The data
are Mohammad's dust-v2 layer: 13 sampled three-hour means (the 15th of each month from December 2024 to November 2025,
plus 2025-08-19), each aggregated to 25 x 40 = 1,000 cells of 1.2 degrees x 1.75 degrees (see `docs/dust-v2-data.md`).
The brief's night-lights example is only an example; the Studio uses this dataset and the same scientific rules.

Code: `web/studio/` (page logic, maths, mapping, renderers), `web/pages/studio.html`, `tests/studio.test.mjs`. It imports
`web/sources/decode/dust-visual.js`, `web/audio/transport.js` and `web/audio/voices.js`, and the site shell
(`web/cinematic/site/*`). Nothing there was copied or edited.

## Rules the Studio never breaks

- Real values only. Every displayed number is read from a cell of the loaded snapshot (or from a published or computed
  difference of two snapshots). Colour never supplies numbers.
- Each snapshot is **one three-hour mean**, not a daily, monthly or seasonal average. The date picker lists only the
  13 real snapshots, grouped by the catalog's meteorological seasons, which only enumerate sampled dates.
- Missing values stay missing: hatched on the map, a soft click in sound, counted (never averaged) in summaries,
  and "unavailable" in changes. They are never zero and never "no change".
- Changes are only offered where they are scientifically allowed (see Compare).
- Unlocked only after Decode has been finished once (`earthpulse.decode.completed.v1`); "Show anyway (spoils the
  challenge)" unlocks the current tab only.

## Map and layer

The map is plate carree (x linear in longitude, y linear in latitude), the projection documented for the grid. A
WebGL fragment shader (`renderer-gl.js`, three.js vendored in `web/vendor/three/`) turns each pixel into longitude and
latitude, samples the NASA Blue Marble texture (`web/assets/earth/`) at that longitude and latitude, and blends the dust
field sampled at the same longitude and latitude. Both layers share one coordinate, so the dust stays registered to the
Earth at every zoom and pan. No grid lines or tiles are drawn.

Display smoothing: values are blended between cell centres with a cubic B-spline for a continuous colour field. It is
labelled in the UI. Readouts, sound, summaries and statistics always use the cell values, never the smoothed field.

Fixed scales (the same for every date, so dates are comparable): value `0.001 to 2.5` on a log scale (all 13 real
snapshots lie inside it; a test checks this); change `+/-1.5`, with a "near zero" display band of `|change| < 0.02`
drawn neutral. These are display bands, not scientific thresholds.

The 2D canvas renderer (`renderer-2d.js`) draws the same layer (same spline, same colour tables) when WebGL is not
available (`?renderer=2d` forces it).

Interaction: mouse wheel, pinch, drag, toolbar buttons; keyboard `+`/`-`, `Home`, Shift+arrows (pan). The view is
clamped to the dataset region (zoom 1 to 18).

## Sound mapping `studio-v1`

| Quantity | Sound | Notes |
|---|---|---|
| dust value | pitch `220 * 2^(3 * t)` Hz, `t` = position of the value on the fixed log scale | 220 Hz at 0.001, 1760 Hz at 2.5; one scale for the whole catalog |
| longitude | stereo pan -1 (west) to +1 (east) | never mirrored in Arabic |
| loudness | constant (gain 0.16, below the shared ceiling 0.22) | loudness carries nothing, so volume changes never change the meaning |
| missing | one soft click (`crackleVoice`, 700 Hz, 28 ms) and a "missing" readout | distinct from any tone |
| change (second minus first) | two-note step around 440 Hz: rising for an increase, falling for a decrease, wider for a bigger change (1 to 12 semitones); one steady 440 Hz note inside the near-zero band | |

Deterministic: the sound is a pure function of (value, longitude) for hovering, and of the ordered cell list for scans,
so the same place with the same settings sounds identical. Hovering is throttled to one new tone per 90 ms (the last
position always plays) and a tone only repeats when the cell changes.

**Why the Studio maps value to pitch while Decode maps north to pitch.** Decode is a listening game: pitch carries
latitude and pan carries longitude, so the player has to find the value from loudness without being told it. The Studio
is a reading tool: the value is the point, so pitch carries the value and position is carried by pan and the on-screen
cursor. The UI states this next to the mapping.

Sound starts only after the user presses "Enable sound" (a user gesture). It uses `createTransport` with the same
analyser tap the rest of the site uses, so the waveform shown is the real output.

Touch: with sound on, one finger pressed and dragged listens; two fingers pan and zoom. Keyboard: the map is focusable;
arrows move a cursor cell by cell (left is always west), `R` reads the value as text, `Space` plays the cell.
