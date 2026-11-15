# Final UI overhaul: what changed

Branch `feat/final-ui` (from `feat/earth-map`). No science, data, audio-engine, contract or teammate-module code was changed.

## Information architecture
- Navigation: logo · Decode · Explore Earth · Sound Studio · Science · About · accessibility icon · EN | العربية. Five links, active page underlined with `aria-current`. On phones: logo + menu + language, full-screen sheet.
- **Home is now Decode** (`web/index.html`). The old Sound Atlas moved to `web/atlas.html` and stays reachable from the footer ("Archive: Sound Atlas v1"). This is the one commit that touches shared files: `home: Decode becomes the landing page (needs Majd's approval)`.
- `web/decode-3d.html` and `web/pages/sound-lab.html` redirect (to `/` and `science.html#sound`).
- Settings are a drawer opened from the accessibility icon on every page; the full page `pages/settings.html` remains.
- Shared footer on every page (data credit, "not endorsed by NASA", archive link).

## Design system
`tokens.css` (colour, type scale, spacing, radius, motion, touch target 44 px) → `shell.css` (nav, drawer, sheet, buttons, segmented control, switch, chip, tooltip, toast, footer) → `site.css` (page base). Arabic uses bundled IBM Plex Sans Arabic. High contrast, text size and reduced motion are token overrides.

## Sound Studio (full redesign)
- The map is the page: edge to edge under the nav, coverage fills the screen (cropped on the long axis; the compass button restores it).
- Top left: phenomenon segmented control (Forests disabled with its reason) and date. Top right: sound pill (on/off, Guided/Pure, data volume, waveform).
- Left icon rail: Explore · Area · Path · Compare · Find signals · Find similar, with tooltips. One flyout at a time; Esc closes it and returns focus to the rail button.
- Right inspector card opens on selection: big value, unit, location, date and time window, "model (GEOS-FP)" badge, one-line sound meaning, "How was this computed?" sheet, copy link.
- Bottom: compact legend, 13 dates grouped by season, play/pause through the dates.
- Default first state: the data cell nearest the coverage centre is selected and shown with a real value; sound off.
- Results of Find signals / Find similar are a numbered list and numbered pins; hovering links them; opening one flies the map.
- `?` opens a help sheet (what the sound means, keyboard, data notes).
- Phones: full-screen map, tool rail becomes a bottom icon bar, flyout and inspector share one bottom sheet with three snap points.

## Other pages
- Science: new **How it sounds** section (`#sound`) with Hear low / Hear high buttons that run the real Studio engine on real GEOS-FP cells.
- Explore Earth: calmer layout, bigger map, lock screen over the Earth.
- Decode, About, Settings: use the shared shell, tokens and footer.

## Tests
`tests/final-ui.test.mjs` added (nav, redirect, home, Studio default state, single flyout, settings). Two old Studio UI tests updated to the new structure.

## Studio interaction model (second pass)
- One layer, always stated: a layer chip in the toolbar ("Dust · 2025-04-15" or "Dust change · 04-15 → 07-15" with an × back to the snapshot); the date control matches the layer shown.
- One active tool. Switching tools clears the previous tool's drawings (area box, path, pins, change layer) and coming back restores that tool's own state. Explore has no panel.
- Selected place = a card anchored on the map next to the cell (value, unit, coordinates, one-line sound meaning, Replay, How computed). Hover shows a value-only tooltip. The side panel is only for the active tool, with icon, name and close.
- Find signals: one sentence ("Show the 10 highest Dust values on 2025-04-15"), kinds highest / above threshold / biggest rises / biggest drops (anomaly only explained in the info icon), human rows (rank, value with a bar, coordinates, code small), one header line with an info icon, clustered pins, designed empty / loading / unavailable / error states. Find similar, Area, Path and Compare follow the same pattern.
- Spoiler lock: dust 2025-08-15 and 2025-08-19 are disabled (lock + tooltip) in the date select, the timeline, Compare and Find signals until Decode is finished or "Show anyway".
- Fixed a latent bug: a published date comparison (for example dust 15 Apr to 15 Jul) failed to load because its file path was dropped.
