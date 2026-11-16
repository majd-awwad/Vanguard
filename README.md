# EARTHPULSE — Hear the Unseen

Team Vanguard's bilingual (English / Arabic) sonification platform for NASA Earth data, built at the NASA Space Apps Challenge 2026 (Nablus, An-Najah National University).

EARTHPULSE turns real NASA GMAO GEOS-FP model data into sound: **dust, rainfall and wind** over North Africa and the Mediterranean (20°W–50°E, 15°N–45°N), on a 25 × 40 grid of 1,000 cells and 13 real dates (the 15th of each month from December 2024 to November 2025, plus 2025-08-19). Every number and sound on the site comes from that data or from documented rules that turn it into sound. The browser uses only packaged assets and needs no account or network connection for playback.

## What you can do

| Page | What it is |
|---|---|
| **Home** (`/`) | The cinematic globe and the original dust challenge (find the cells with dust optical depth ≥ 0.20 on 2025-08-19). |
| **Decode** (`/pages/decode.html`) | A five-level listening game: Dust Discovery, Rainfall Explorer, Wind Investigator, Earth Pattern Detective and Earth Master. Grids grow from 12 to 48 cells, with hints, a score out of 500, a reveal of the real values after every objective, and local profiles (no login). |
| **Explore Earth** (`/pages/explore.html`) | A 3D globe with a Dust · Rainfall · Wind switch and the 13 dates. Each cell shows its real value, unit and meaning, and plays its sound. Unlocks after Decode level 1 (or "Show anyway"). |
| **Sound Studio** (`/pages/studio.html`) | A full-screen map of the three phenomena: explore by pointer or keyboard, scan an area, draw a path, compare two dates or two places, **Find signals** (highest values, thresholds, largest change) and **Find similar** (Echo, monthly pattern matching). Guided Voice or Pure Sonification mode. |
| **Scientific Orchestra** (inside the Studio) | Several scientifically compatible channels for the selected cell, played together on one clock, each with its own Active, Mute, Solo and volume. |
| **Science** (`/pages/science.html`) | The dataset, processing, sound mapping and limits. |
| **About** (`/pages/about.html`) | The project and the team. |

## Sound

The sound is the project's nine recordings: low, mid and high for dust, rain and wind. The level is chosen by the **real value** of the cell, with the documented breakpoints (33rd / 66th percentiles of the package):

| Phenomenon | Low | Mid | High | Silent |
|---|---|---|---|---|
| Dust (optical depth, unitless) | ≤ 0.0382 | ≤ 0.1247 | above | — |
| Rainfall (mm per hour) | ≤ 0.1637 | ≤ 0.3115 | above | below 0.1 (no measurable rain) |
| Wind (m/s) | ≤ 2.477 | ≤ 4.068 | above | — |

Stereo position follows longitude (west left, east right). In Decode, playback rate follows latitude. Details: [docs/earth-map/SONIFICATION_MAPPING.md](docs/earth-map/SONIFICATION_MAPPING.md).

## Accessibility and languages

- English and Arabic (right to left) on every page, switchable at any time.
- Keyboard play everywhere (arrow keys over the grid, Enter, R to read a value), visible focus, touch targets of at least 44 px.
- Settings drawer: high contrast, text size, reduced motion, speech volume, spoken instructions.
- Decode can be completed with sound off: sound cues are also offered as text.
- A listening study with blind and low-vision participants is planned; until then we make no claim about how much EARTHPULSE helps.

## Scientific honesty

- Each snapshot is one model mean (three hours for dust, one hour for rain and wind), not a daily or seasonal average.
- Missing values stay missing: never zero, never "no change".
- Changes are only offered between snapshots of the same model build; comparisons across builds are blocked with the reason.
- Every package file is verified against the master catalog SHA-256 and byte count, in the build and in the browser.
- EARTHPULSE is a student project and is not endorsed by NASA.

## Run locally

Use Node.js 22 or later. From this directory:

```sh
npm start
```

Open <http://127.0.0.1:4173/>. `npm run build` writes the portable static site to `dist/`; serve that directory over HTTP (a path prefix works too).

On a managed Windows workspace, if Node reports an `EPERM` while resolving the user profile, run this in PowerShell first:

```powershell
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
npm.cmd start
```

## Verify

```sh
npm test
```

The Node test suite covers the data package integrity, aggregation, sound mapping, Decode levels and scoring (including that no value leaks before the reveal), the Studio state machine, the Orchestra compatibility rules and the Arabic/English copy. Some tests call the Python reference in `science/`; set `EARTHPULSE_PYTHON` if your executable is not named `python`.

## Project layout

| Path | Contents |
|---|---|
| `deliverables/EarthPulse-JSON-ONLY/` | The verified NASA data package (source, never edited). |
| `web/assets/earthpulse-json/` | The browser copy of the package (`node scripts/earth-map/copy-package.mjs`). |
| `web/pages/` | Site pages. |
| `web/studio/` | Sound Studio, Orchestra, datasets, recordings and analysis. |
| `web/experiences/levels/` | Decode levels: aggregation, missions, scoring, profiles. |
| `web/cinematic/` | Globe scene, shared site shell, navigation and settings. |
| `web/audio/` | Shared playback transport. |
| `scripts/` | Build, local server, package copy and provenance. |
| `science/` | Source manifests and reference processing. |
| `tests/` | Automated tests. |

## Documentation

- Data: [dust-v2-data](docs/dust-v2-data.md), [DATA_INVENTORY](docs/earth-map/DATA_INVENTORY.md), [DATA_PROVENANCE](docs/earth-map/DATA_PROVENANCE.md), [source-status](docs/source-status.md)
- Sound: [SONIFICATION_MAPPING](docs/earth-map/SONIFICATION_MAPPING.md), [sound-studio](docs/sound-studio.md), [scientific-orchestra](docs/scientific-orchestra.md)
- Decode and Explore: [decode-levels/REPORT](docs/decode-levels/REPORT.md), [GRIDS](docs/decode-levels/GRIDS.md)
- Interface: [final-ui/CHANGES](docs/final-ui/CHANGES.md), [site-pages](docs/site-pages.md), [FEATURE_STATUS](docs/earth-map/FEATURE_STATUS.md)
- Team plan and architecture: [implementation-backlog](docs/implementation-backlog.md), [architecture](docs/architecture.md)

## Team Vanguard

An-Najah National University, Palestine.

| Member | Area |
|---|---|
| Mohammad Awwad | Data package and provenance |
| Andreh Khouri | Sound engine and Scientific Orchestra |
| Yaman Abu Asal | Exploration session and Sound Studio |
| Roaa Buzzor | Interface and visuals |
| Israa Hashash | Accessibility and the two languages |
| Majd Awwad | Integration, contracts and architecture |

## Credits

Data: NASA GMAO GEOS-FP. Earth imagery: NASA Earth Observatory, Blue Marble. Fonts: Instrument Serif, Instrument Sans, IBM Plex Mono and IBM Plex Sans Arabic (OFL notices in `web/assets/fonts/`).

## Archive: Sound Atlas v1

The first version of the project (GEDI forest structure and the Sonic Lens) is still reachable at `/atlas.html` and `/forest.html`, with its checkpoint in [science/gedi/README.md](science/gedi/README.md). Its opening uses `web/assets/gedi/cerrado-dusk.jpg`, an AI-generated landscape illustration that carries no data.
