import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { cellBounds, cellId, cellSize, fill, formatLat, formatLon, parseCellId, textureCrop, transmission, trimNumber, windowStats } from "../web/cinematic/site/cells.js";
import { applySettings, defaults, loadSettings, resolveLanguage, sanitize, saveSettings } from "../web/cinematic/site/settings.js";
import { NAV_ITEMS, hrefFor, navText } from "../web/cinematic/site/nav.js";
import { NATIVE, RAW_SHA256, REFERENCES, scienceCopy } from "../web/cinematic/site/science-copy.js";
import { scienceModel } from "../web/cinematic/site/science.js";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const data = JSON.parse(read("web/assets/decode/data/dust-geos-fp-20250819-1930-north-africa-med.json"));
const fakeStorage = () => { const map = new Map(); return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v) }; };

test("cell names count rows from the north and columns from the west", () => {
  assert.equal(cellId(0, 0), "A1");
  assert.equal(cellId(5, 7), "F8");
  assert.deepEqual(parseCellId("B3"), { row: 1, col: 2 });
  const b = cellBounds(data.bounds, data.levels.advanced, 0, 0);
  assert.equal(b.north, data.bounds.north);
  assert.equal(b.west, data.bounds.west);
  const last = cellBounds(data.bounds, data.levels.advanced, 5, 7);
  assert.equal(last.south, data.bounds.south);
  assert.equal(last.east, data.bounds.east);
  assert.deepEqual(cellSize(data.bounds, data.levels.advanced), { lat: 5, lon: 8.75 });
});

test("formatting helpers", () => {
  assert.equal(formatLat(-15), "15°S");
  assert.equal(formatLon(-20), "20°W");
  assert.equal(trimNumber(8.75), "8.75");
  assert.equal(fill("{a}-{b}", { a: 1 }), "1-{b}");
  assert.equal(windowStats(data.source.time).hours, 3);
  assert.ok(Math.abs(transmission(0.2) - 0.8187) < 1e-4);
});

test("texture crop maps bounds exactly onto the equirectangular texture", () => {
  const crop = textureCrop(data.bounds);
  assert.ok(Math.abs(crop.aspect - 70 / 30) < 1e-9);
  assert.ok(Math.abs(crop.sizeX - 360 / 70 * 100) < 1e-9);
  assert.ok(Math.abs(crop.posY - 30) < 1e-9);
});

test("settings validate, persist and never throw", () => {
  assert.deepEqual(sanitize({ volume: 9, speed: 3, textSize: "huge", language: "fr", contrast: "yes" }), { ...defaults, volume: 1 });
  const storage = fakeStorage();
  saveSettings({ language: "ar", contrast: true }, storage);
  assert.equal(loadSettings(storage).language, "ar");
  assert.equal(loadSettings(storage).contrast, true);
  const broken = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("blocked"); } };
  assert.deepEqual(loadSettings(broken), sanitize(null));
  assert.doesNotThrow(() => saveSettings({ volume: 0.2 }, broken));
  assert.equal(resolveLanguage("http://x/a?lang=ar", defaults), "ar");
  assert.equal(resolveLanguage("http://x/a", { ...defaults, language: "ar" }), "ar");
  const root = { dataset: {}, lang: "", dir: "" };
  applySettings({ documentElement: root }, sanitize({ language: "ar", contrast: true }));
  assert.equal(root.dir, "rtl");
  assert.equal(root.dataset.contrast, "high");
});

test("navigation targets are consistent and every page text exists in both languages", () => {
  assert.equal(hrefFor("pages/science.html", "pages"), "./science.html");
  assert.equal(hrefFor("decode-3d.html", "pages"), "../decode-3d.html");
  assert.equal(hrefFor("index.html", "pages"), "../");
  assert.equal(hrefFor("pages/science.html", "root"), "./pages/science.html");
  for (const language of ["en", "ar"]) for (const item of NAV_ITEMS) assert.ok(navText[language][item.id]);
  const keys = (object) => Object.keys(object).sort().map((k) => (object[k] && typeof object[k] === "object" ? k + "{" + keys(object[k]) + "}" : k)).join();
  assert.equal(keys(scienceCopy.en), keys(scienceCopy.ar));
});

test("science copy constants agree with the repository's own documentation", () => {
  const docs = read("docs/decode-data.md");
  assert.ok(docs.includes(RAW_SHA256));
  assert.ok(read("science/decode/dust-extraction.json").includes(RAW_SHA256));
  assert.ok(docs.includes("0.25° latitude × 0.3125° longitude") && NATIVE.lat === 0.25 && NATIVE.lon === 0.3125);
  for (const ref of REFERENCES) {
    const known = ref.key === "svs" ? data.visualLink.svs : ref.href;
    assert.ok(docs.includes(known.replace(/\/$/, "")) || read("docs/source-status.md").includes(known) || read("README.md").includes(known) || read("science/decode/source-audit.md").includes(known), known);
  }
});

test("science model comes from the case and states no invented bands", () => {
  const m = scienceModel(data, "en");
  assert.equal(m.threshold, "0.2");
  assert.equal(m.variable, "DUEXTTAU");
  assert.equal(m.wavelength, "550");
  assert.equal(m.hours, "3");
  assert.equal(m.centre, "19:30 UTC");
  assert.equal(m.attenuation, "18.1");
  assert.deepEqual([m.advanced.lat, m.advanced.lon, m.quick.lat, m.quick.lon], ["5", "8.75", "10", "17.5"]);
  assert.equal(data.levels.advanced.truth.threshold, data.levels.quick.truth.threshold);
  const copy = JSON.stringify(scienceCopy);
  assert.ok(!/0\.10|moderate dust|low dust/i.test(copy.replace("“moderate” bands", "")));
  assert.ok(!/NASA logo|insignia/i.test(copy));
  assert.ok(!/\b(18|5)\s*(of|\/)\s*(48|12)\b/.test(copy), "must not reveal how many cells are positive");
});

test("pages never use the NASA logo and keep SVS 5669 out of the globe", () => {
  const css = read("web/cinematic/site/site.css") + read("web/cinematic/site/science.css");
  const js = read("web/cinematic/site/science.js");
  assert.ok(!/nasa-logo|insignia|meatball/i.test(css + js));
  assert.ok(!/svs-5669/.test(read("web/cinematic/scene.js")));
});
