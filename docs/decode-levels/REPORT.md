# Explore Earth + Decode: implementation report

Branch `feat/explore-decode` (from `feat/final-ui`, committed locally, **not pushed**, no PR).

## Explore Earth (the original globe page, plus the Dust / Rainfall / Wind switch)
- `web/pages/explore.html` · `web/cinematic/site/explore.js`, `explore-copy.js` (restored from `feat/final-ui`, copy unchanged), `explore-data-copy.js` (the new words), `explore.css` (the original plus a few lines).
- **Kept as it was:** the 3D globe and its fly-in to the region, the grid registered on the globe (Quick 3×4 / Advanced 6×8), the floating selected-cell card, the compare drawer, the listen panel with the live waveform, the left-hand dataset panel and the zoom tools.
- **Added only:** (1) a one-row switch Dust · Rainfall · Wind on top of the globe view with the date control next to it (13 real dates; rain shows the dry-date notice and the wetter-date buttons; the dust dates 2025-08-15 and 2025-08-19 stay locked until all five Decode levels are done); (2) in the selected-cell card, the value with its unit, the meaning phrase ("high compared with this dataset") and a two-sentence explanation, plus the wind direction; (3) a "Ready? Test yourself in Decode" button at the end.
- Switching changes the real dataset (the Studio's loaders), the cell colours on the globe (the phenomenon's own scale, soft), the legend, the values, the explanation and the sound (the user's recordings by the real value, pan by longitude). The dust particles of the globe follow the dust values; rain and wind show their colours on the cells.
- Each cell is the area-weighted mean of the real 25×40 cells it covers (the same method as Decode, see `GRIDS.md`).
- Spoiler rules: the page is locked until Decode level 1 is completed once (`earthpulse.decode.completed.v1`, or "Show it anyway" for the current tab); no levels, scores or profiles.

## Decode (five levels)
- `web/pages/decode.html` · `web/cinematic/site/decode-game.js`, `decode-game-copy.js`, `decode-game.css`; logic in `web/experiences/levels/` (`aggregate.js`, `levels.js`, `engine.js`, `profiles.js`, `award.js`).
- Screens: profiles, level select (locked/unlocked/completed, best score, total out of 500, achievements), play, result (breakdown, Next Level, replay, final data review), final award.

### Datasets, dates, build groups, grids (details in `GRIDS.md`)
| Level | Name | Data | Date(s) | Build group | Grid | Objectives |
|---|---|---|---|---|---|---|
| 1 | Dust Discovery | Dust | 2025-03-15 | `GEOSadas-5_29_5-p6-SLES15` (B) | 3×4 = 12 | 3 |
| 2 | Rainfall Explorer | Rain (wet date) | 2025-11-15 | B | 4×4 = 16 | 4 |
| 3 | Wind Investigator | Wind speed + direction | 2025-06-15 | B | 5×6 = 30 | 5 |
| 4 | Earth Pattern Detective | Dust + rain + wind, same date | 2025-05-15 | B | 6×6 = 36 | 6 (3 stages) |
| 5 | Earth Master | Dust + rain + wind, change | 2025-04-15 → 2025-05-15 | B (both) | 6×8 = 48 | 9 (3 stages) |

- **Aggregation:** each level cell is the area-weighted mean (spherical area of the overlap) of the 25×40 package cells it overlaps; any missing overlapped cell makes it missing; wind averages U and V first, then derives speed and direction. A test recomputes every cell with an independent method.
- **How difficulty grows:** cells 12 → 48; objectives 3 → 4 → 5 → 6 → 9; stages 1 → 3; hints per objective 3, 3, 2, 2, 1; from comparing two cells (L1) to wind direction (L3), co-occurrence of dust, rain and wind (L4) and change between two dates plus a three-way combination (L5).
- **Thresholds:** the documented sound levels (dust: high above 0.1247; rain: none below 0.1 mm/h, moderate above 0.1637; wind: mid above 2.477, high above 4.068 m/s). Deviation from the addendum: dust uses the "high" level instead of 0.20, because three recordings cannot resolve 0.20 (explained in `GRIDS.md`).
- **Answer safety:** the engine keeps the values in a closure; the interface gets positions and sound cues only; values appear in the final data review after the level. The truth is exposed only with `?debug=1` (used by the browser checks). A test proves no value leaks before the reveal.
- **Scoring:** 100 per level, 500 total; wrong attempt −15%, hint −10%, floor 40% per objective; after three wrong tries the answer can be shown (pays the floor); the best score per level is kept on replay.
- **Sound:** the recordings by the real value's level; pan from the column (west left), playback rate from the row (south 0.85 → north 1.25); a sound on/off toggle, a volume slider and a "show sound cues as text" option, so every level can be completed with sound off (text cues, keyboard, screen reader).
- **Profiles (local only):** up to 8 profiles (name + one of 8 avatars), no login, "Saved only in this browser", deletion with confirmation, progress per profile.

Profile storage example (`localStorage` key `earthpulse.decode.profiles.v1`, schema version 1):

```json
{
  "version": 1,
  "activeId": "pmhx3k0a1f",
  "profiles": [{
    "id": "pmhx3k0a1f", "name": "Layla", "avatar": "rocket", "createdAt": "2026-11-15T09:12:00.000Z",
    "progress": {
      "completed": [1, 2], "best": { "1": 100, "2": 86 }, "total": 186,
      "achievements": ["level-1", "no-hints", "perfect-level", "level-2"],
      "lastLevel": 3, "finishedAt": null,
      "current": { "levelId": 3, "objectives": { "l3-pick": { "done": true, "earned": 12, "wrong": 0, "hints": 0, "shown": false, "cell": null } } }
    }
  }]
}
```
No data values are stored, only objective states.

### Final award
After level 5 the result screen offers "See my award": a personalised celebration (name, score out of 500, trophy with a pop animation that stops with reduced motion, a bar per level) and a certificate drawn locally on a canvas ("EarthPulse Earth Master — Team Vanguard", "Not an official NASA certificate"), downloadable as a PNG. Buttons: replay (back to the levels), go to Explore Earth.

## Humidity and audio dependencies
- Humidity: **not part of the product** (the brief was changed: no tab, no pending state, no request file, no sound slot, no fixture).
- Audio: no dependency missing; the nine recordings are in place (licences remain "to verify").

## Verified in real Edge (headless) and by tests
- Decode flow on desktop and 390 px, English and Arabic: create profile, play all five levels end to end to 500/500, wrong answer, hint, show-answer, wrong marks feedback, reload and resume, replay keeps the best score, two independent profiles, deletion with confirmation, award page; no console errors.
- Explore (restored globe page): at 1366×768 and 390×844, English and Arabic, all three phenomena: the fly-in plays (hero, flying, done), nothing is cut, switching changes the dataset, scale and card, the recordings start (the sound engine is running with the matching level), the dry-date notice and the wetter-date buttons work, the Decode button is at the end, no console errors.
- Not done: nobody listened to the audio; no screen reader run; no Safari/Firefox.

## Local URLs (after `npm start`, default port)
- Explore Earth: `http://127.0.0.1:4173/pages/explore.html` (and `?lang=ar`)
- Decode: `http://127.0.0.1:4173/pages/decode.html` (and `?lang=ar`)
- Original challenge: `http://127.0.0.1:4173/`
