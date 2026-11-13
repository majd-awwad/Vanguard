# EARTHPULSE 2.0 — The Invisible Forest

A static, bilingual exhibit for six verified GEDI V001 lidar footprints in Brazil. Fix a height band to move along the sampled track, or hold one footprint and inspect its return by height. Earth Detective compares the real observations ending in `08400` and `08404` within the 4–10 m band.

## Run locally

Use Node.js 22 or later. From this directory, run:

```sh
npm start
```

Open <http://127.0.0.1:4173/>. Run `npm run build` to generate the portable static site in `dist/`. Serve that directory over HTTP, including when hosting it under a path prefix. The build checks the GEDI sample and NASA SVS image hashes and copies the canonical sample and manifest from the science checkpoint.

On the managed Windows workspace, if Node reports an `EPERM` while resolving the user profile, run this in PowerShell before running npm:

```powershell
$env:NODE_OPTIONS = '--preserve-symlinks --preserve-symlinks-main'
npm.cmd start
```

## Verify

```sh
npm test
python -B science/gedi/validate_sample.py
```

The Node tests also call the existing Python reference, which uses the standard library for event generation. Set `EARTHPULSE_PYTHON` if your executable is named something other than `python`. The optional Playwright smoke test runs with the local server already up. Use `node tests/browser-smoke.mjs` with Playwright available, or set `EARTHPULSE_PLAYWRIGHT` to the absolute path of its `index.mjs` and `EARTHPULSE_BROWSER` to the Chrome executable. Set `EARTHPULSE_URL` to test a different deployment base URL.

## Measurements and sound

The current mapping uses the GEDI checkpoint’s background-corrected, thresholded return fraction in a fixed −10 to 22 m window above estimated ground. The vertical scan plays one-metre bands at 0.13 seconds per metre at 1×. The track scan plays one event per footprint at its measured along-track distance divided by 65 metres per playback second at 1×. Both modes use a 440 Hz sine tone, 95 ms duration, 9 ms attack and 26 ms release at 1×. Peak gain is `0.32 × sqrt(fraction)`. The volume control scales all events together. A bin below the threshold is available for inspection as a silent event. The gaps between footprints have no events.

[The GEDI checkpoint](science/gedi/README.md) records the extraction, stress tests, units and scientific limits. [The provenance manifest](science/gedi/provenance.json) includes the granule identifiers, download links, and SHA-256 checksums. NASA's [GEDI Forest Height visualization](https://svs.gsfc.nasa.gov/4950/) supplies mission context through its L2B RH100 map. The frame-to-shot relationship remains unverified.

The opening photograph is [an illustrative aerial forest photograph by Igor Justo](https://www.pexels.com/photo/drone-shot-of-green-forest-10391248/), under the [Pexels license](https://www.pexels.com/license/). The exhibit identifies it as a contextual image. Fonts are Instrument Serif, Instrument Sans and IBM Plex Mono, with their OFL notices in `web/assets/fonts/`. The exhibit code was written with Codex. The earlier Earth Pulse HTML prototype was not incorporated.
