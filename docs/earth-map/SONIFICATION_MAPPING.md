# Sonification mapping `earthmap-v1`

Code: `web/studio/sonify.js` (pure: value to voice parameters), `web/studio/datasets.js` (fixed scales),
`web/audio/transport.js` and `voices.js` (shared audio engine, unchanged). Everything is NASA GMAO GEOS-FP **model**
data; the sound is a representation of the numbers, not a recording of dust, rain, heat or wind.

## Pipeline

`value` -> `normalized = clamp((value - validMin) / (validMax - validMin), 0, 1)` (after the documented transform) ->
voice parameters -> shared `createTransport` (one AudioContext, one scheduler) -> speakers. The same normalisation
drives the colour of the map layer, so what you see and what you hear are the same fixed scale.

## Fixed limits (the same for all 13 dates, so dates are comparable)

Limits are rounded outward from the real data range over all 13 sampled dates (computed from the package; a test
checks every value lies inside them).

| Phenomenon | Measure and unit | Data range (13 dates) | validMin, validMax | Transform | Why |
|---|---|---|---|---|---|
| Dust | `DUEXTTAU`, unitless | 0.0016 to 2.173 | 0.001, 2.5 | log | very skewed (median about 0.07) |
| Rainfall | one-hour accumulation, mm | 0 to 3.870 | 0, 4 | square root | very skewed; most cells are near 0 |
| Temperature | `T2M`, degC | -11.56 to 41.49 | -15, 45 | linear | roughly symmetric |
| Wind | speed, m s-1 | 0.027 to 15.59 | 0, 16 | linear | |

Colour ramps use the same normalised value (`PHENOMENA[...].stops`). Changes between two dates use a signed scale per
phenomenon (display bands, not scientific thresholds): near-zero band / saturation: dust 0.02 / 1.5, rainfall 0.05 / 3 mm,
temperature 0.5 / 20 degC, wind 0.3 / 12 m s-1.

## Mapping per phenomenon

| Phenomenon | Sound | Parameters (n = normalized, 0 to 1) | What changes with the value |
|---|---|---|---|
| Rainfall | short triangle pulses at a fixed 520 Hz | pulse rate = 1.5 + 12.5 n pulses/s, pulse 35 ms; no rain (<= 0.002 mm) is **silent** | more rain = **faster pulses** |
| Temperature | one steady sine tone | frequency = 220 x 2^(2 n) Hz (220 to 880 Hz) | warmer = **higher pitch** |
| Dust | dense pulse train, 22 ms pulses | density = 3 + 21 n pulses/s; brightness: centre frequency 900 x 2^(1.5 n) Hz and waveform triangle (n < 1/3), square (n < 2/3), sawtooth | more dust = **denser and brighter** |
| Wind | 70 ms triangle pulses at 180 Hz (tremolo) | rate = 2 + 14 n pulses/s; **pan** = east component of the flow = u / hypot(u, v) | stronger wind = **faster pulses**; the sound moves left or right with the east-west part of the wind |

Other rules:

- **Loudness never carries the value.** Gain is constant (0.14, below the shared 0.22 ceiling). The meaning is in pulse
  rate, pitch or brightness, and each has a one-sentence text explanation in the info panel.
- **Position:** for dust, rainfall and temperature the stereo pan is the cell's longitude (west left, east right,
  never mirrored in Arabic). Wind replaces it with the wind's east-west component.
- **Wind direction** is shown as text (`From SE (138 degrees)`) and sonified through pan only. It is **never averaged**.
  Calm (speed below 0.3 m s-1) or a `null` direction is centred; a direction is never guessed. Speed is what Hunter and Echo use.
- **Missing** is a soft click (700 Hz, 28 ms), never silence and never zero. (None occur in this release; the code handles null.)
- **Change layers** (second date minus first): a rising two-note step (440 Hz up) for an increase, a falling step for a
  decrease, one steady 440 Hz note inside the near-zero band; the step is 1 to 12 semitones wide, scaled by the
  phenomenon's own change scale.
- **Safety:** every voice is passed through `continuousVoice` (gain clamped to 0.22) with attack and release ramps (no sharp
  peaks); at most 24 pulses per event; one `AudioContext` (the transport's); a new hover tone replaces the previous plan
  (no overlapping sounds); sound starts only after the user presses "Enable sound"; hover tones are throttled to one per
  90 ms and only when the cell changes; `Mute` pauses the transport.
- **Determinism:** the sound is a pure function of (phenomenon, cell values, longitude, event length). The same cell with the
  same settings produces identical plans (tested).

## What changed from the Studio's `studio-v1` (dust)

`studio-v1` mapped the dust value to **pitch** (220 to 1760 Hz, log scale) with constant loudness. `earthmap-v1` maps the
dust value to **pulse density and brightness**, because:

1. all four phenomena now share one logic: each has its own natural channel (rate for rain and wind, pitch for
   temperature, density/brightness for a particulate), so dust, which has no natural pitch, no longer sounds like temperature;
2. a clear distinction between layers when switching phenomenon: pitch means temperature, pulses mean rain, wind or dust;
3. the spec asks for a density/brightness mapping for dust.

Limitation: the shared transport only schedules oscillators, so dust "filtered noise" is approximated by a dense,
deterministic pulse train whose rate and centre frequency (brightness) follow the value. A real noise source would need
a new audio voice in `web/audio` (a note for Andreh). `studio-v1` is still documented in `docs/sound-studio.md` and its
tests still pass; the optional realistic wind-sound layer is **not implemented** (it is optional and off by default).

## Speech and ducking

Guided Voice announces after the cursor has settled (550 ms, inside the 400 to 700 ms window), cancels stale speech
whenever the context changes, and ducks the data sound to 35% while speaking, then restores it over 300 ms. Voice volume
and data volume are separate sliders. Pure Sonification never speaks automatically.
