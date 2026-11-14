# Site pages (feat/site-pages)

Five pages share one header, one design system and one settings store. Built in this order: Science & Dataset, About,
Sound Lab, Accessibility & Settings, Explore Earth. Status is tracked at the bottom.

## Layout

- `web/pages/*.html`: one HTML file per page (served as `/pages/<name>.html`).
- `web/cinematic/site/`: shared `site.css`, `nav.js`, `settings.js`, `cells.js`, `dom.js` and per-page modules.
- Cells are always named letter = row from the north (A is northernmost), number = column from the west; bounds and sizes are computed from the case.

## Honesty rules in the code

- Every number comes from the case JSON or from `docs/decode-data.md`. The two literals taken from the docs (native resolution, raw file SHA-256) are checked by `tests/site-pages.test.mjs`.
- Three kinds of content carry a badge: real data, related NASA visualization (SVS 5669, never projected), decorative.
- No NASA logo, no endorsement claim, no invented threshold bands, no count of positive cells (that would hint at the Decode answer).

## Notes for Majd

- `web/index.html` should link to the pages (Explore Earth, Sound Lab, Science & Dataset, About, Settings). Not changed here.
- The Science page shows no cell values and no count of cells at/above the threshold, on purpose.

## Status

- [x] Science & Dataset: `/pages/science.html`
- [x] About: `/pages/about.html` (six first names only, no roles, bios or photos; listening study stated as planned)
- [x] Sound Lab: `/pages/sound-lab.html`
- [x] Accessibility & Settings: `/pages/settings.html`
