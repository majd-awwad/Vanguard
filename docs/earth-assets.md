# Earth assets for the cinematic Decode page

`web/decode-3d.html` renders a 3D Earth that unrolls onto the challenge region. Everything it needs ships in this
repository, so the page works offline: there is no CDN and no network request at runtime.

## Texture

| File | Size | Pixels | SHA-256 |
|---|---|---|---|
| `web/assets/earth/blue-marble-4096.jpg` (desktop) | 750,440 bytes | 4096 × 2048 | `e3343e007f5dfbe4b1941d56c0f871e97b1153fbe1688a54d32d1fe52fcc2bdf` |
| `web/assets/earth/blue-marble-2048.jpg` (mobile) | 223,799 bytes | 2048 × 1024 | `5a2bea0a8438374482dad92b20f0b4f281a72ea8d01b379fabf84380417b5af8` |

Together they are about 0.93 MB, far under the 8 MB budget. The page loads the 2048 file on narrow screens
(`max-width: 700px`), when the browser reports data saving, or on low-memory devices, and the 4096 file otherwise.

### Source

NASA Earth Observatory, **Blue Marble: Next Generation**, August 2004 monthly composite, land surface, ocean colour
and sea ice, 5400 × 2700 (about 8 km per pixel). Produced by Reto Stöckli (NASA Earth Observatory) from Terra/MODIS.

- Collection page: <https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/>
- File downloaded: <https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-base/august/world.200408.3x5400x2700.jpg>
- Downloaded file: `world.200408.3x5400x2700.jpg`, 1,616,254 bytes, SHA-256
  `2048023ccc62250c677c0f4b03d4362f997b130eb0154a6cad00aa1b27c390b9`
- Credit: NASA's Earth Observatory (Reto Stöckli, Blue Marble: Next Generation).

NASA states that its imagery is generally not subject to copyright and may be reused with credit; see NASA's media usage
guidelines at <https://www.nasa.gov/nasa-brand-center/images-and-media/>. The composite has no cloud layer.

### How the two shipped files were made

Both were resized from the downloaded 5400 × 2700 file with .NET `System.Drawing` (high-quality bicubic, JPEG quality 86).
No colour grading and no content was added. To reproduce, resize the source to 4096 × 2048 and 2048 × 1024 and compare
SHA-256 values (JPEG encoders differ slightly between machines, so a byte-identical result is not guaranteed; the source
hash above is the fixed reference).

### Why this texture is safe for a hidden-answer game

The texture is one static image, identical for every Decode case and every phase. It is a land and ocean base map, not a
dust product, so it shows no aerosol signal. The desert land colour in the Sahara is surface colour, not modelled dust.
Before Reveal the globe draws no localized haze, dust or tint over the challenge region; any later decorative atmosphere
must be uniform over the whole globe, identical for every case, and labelled as artistic.

### Black Marble

NASA's Black Marble night-lights imagery is not packaged yet. Stage 1 uses the Blue Marble base only. If a later stage
adds a night side, it will be added here with its source URL and SHA-256 under the same rules.

## three.js

| File | Version | SHA-256 |
|---|---|---|
| `web/vendor/three/three.module.min.js` | three 0.169.0 (npm `three@0.169.0`, `build/three.module.min.js`) | `f7cee3c7533449a1505cc12cb5128b89e3d4fd3d7ea62b05f9f5464a217472ee` |
| `web/vendor/three/LICENSE` | MIT License, copyright three.js authors | `4c40a1ef62450b857c3b2aaf294936304cd552d965fbcd9d32d4c5bcf4ba4454` |

The file was copied unmodified from the npm package; npm verified the package against its registry integrity value
(`sha512-Ed906MA3dR4TS5riErd4QBsRGPcx+HBDX2O5yYE5GqJeFQTPU+M56Va/f/Oph9X7uZo3W3o4l2ZhBZ6f6qUv0w==`).
`tests/cinematic.test.mjs` checks every hash in this document against the files.
