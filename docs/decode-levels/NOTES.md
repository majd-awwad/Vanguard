# NOTES for the team (Explore Earth + Decode, branch `feat/explore-decode`)

Nothing here edits a teammate's file. Where a change would be needed in one, it is listed so the owner can decide.

## Mohammad (data package)
- `deliverables/EarthPulse-JSON-ONLY/**` is untouched. The app uses **Dust, Rainfall and Wind** only. The package's temperature folder is not used (the app copy skips it, see `docs/final-ui/CHANGES.md`).
- **Humidity is not part of the product** (decision: no humidity data will be delivered), so nothing is requested.
- Optional, no action needed: the Decode levels rely on `compatibilityGroups` (dust) and on the same build label of rainfall and wind (derived from each snapshot's `source.modelSource`). Publishing `compatibilityGroups` in the rainfall and wind catalogs too would make the rule explicit; the app works without it.

## Majd (`web/decode.html`, the cinematic page, the contracts)
- `web/decode.html`, `web/decode.js`, `web/index.html`, `web/cinematic/main.js` and the v2 contract (`web/experiences/decode/**`, `web/contracts/**`) are untouched. The original single-case challenge (dust, North Africa, 2025-08-19) still works at `/` and is linked from the new Decode page ("Play the original dust challenge").
- The new five-level game is a separate page, `web/pages/decode.html`, built in our own files (`web/experiences/levels/**`, `web/cinematic/site/decode-game*.js`). It does **not** use `createDecodeSession` or `scoreGuesses`: the v2 contract limits a session to one case with quick/advanced levels, and the levels need growing grids, several objectives and two-date comparisons. The mission engine follows the same redaction idea (no value readable before the reveal) and its own F1 scoring.
- Shared flag: `earthpulse.decode.completed.v1` is now also set when **Level 1** is completed (it opens Explore Earth). A new flag `earthpulse.decode.finished.v1` is set when all five levels are completed (it opens the two dust dates of the original challenge in Explore Earth).
- The nav's Decode link (`web/cinematic/site/nav.js`) now points to `pages/decode.html`. The home page stays the cinematic page. If you prefer the home page to link into the game, that is a one-line change in your files.
- The old Explore page (3D globe + the case session) was replaced by a data-colour map of the three phenomena; the globe scene is not used there any more.

## Andreh (`web/audio/**`)
- `web/audio/**` is untouched. Decode and Explore play the user's nine recordings through `web/studio/recordings.js` (our file). To give Decode its spatial cues, `recordings.slice()` gained an optional `rate` (playback rate 0.85 in the south to 1.25 in the north) next to the existing `pan` (west to east). Nothing else changed in the sound engine.
- The shared transport (`web/audio/transport.js`) is not used by the new Decode.

## Known limits (honest list)
- The new Decode and Explore use the flat Blue Marble map with a grid/colour overlay, not the 3D globe scene.
- The recordings have three levels, so every question is decided at the level of low / mid / high. The dust threshold is therefore the "high" level (above 0.1247), not 0.20 (see `GRIDS.md`).
- Sound was exercised in a real browser (no errors, the recordings are requested and decoded) but not listened to by a person.
- Humidity: not part of the product. No sound slot, no tab, no request.
