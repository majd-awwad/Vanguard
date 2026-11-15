import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PHENOMENON_IDS, openPackage } from "../web/studio/datasets.js";
import { AMBIENCE_PHENOMENA, breakpoints, fileFor, levelFor, percentile } from "../web/studio/ambience-core.js";
import { CROSSFADE_S, LEVEL_FADE_S, UNDER_DATA_GAIN, createAmbience } from "../web/studio/ambience.js";
import { defaults, sanitize } from "../web/cinematic/site/settings.js";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
const doc = await readFile(new URL("../docs/earth-map/SONIFICATION_MAPPING.md", import.meta.url), "utf8");

test("the ambient pack: every file matches the SHA-256 and byte size in manifest.json", async () => {
  const dir = new URL("../web/assets/ambient/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", dir), "utf8"));
  assert.equal(manifest.items.length, 9);
  for (const item of manifest.items) {
    const bytes = await readFile(new URL(item.file, dir));
    assert.equal(createHash("sha256").update(bytes).digest("hex"), item.sha256, item.file);
    assert.equal(bytes.length, item.bytes, item.file);
    assert.equal(item.license, "TO VERIFY", item.file + " licence stays marked to verify");
    assert.equal(item.file, fileFor(item.phenomenon === "rain" ? "rainfall" : item.phenomenon, item.level));
  }
});

test("breakpoints are the 33rd and 66th percentiles of all valid values across the 13 dates, and match the documentation", async () => {
  assert.equal(percentile([1, 2, 3, 4, 5], 0.5), 3);
  assert.equal(percentile([0, 10], 0.25), 2.5);
  for (const id of AMBIENCE_PHENOMENA) {
    const phen = await pkg.openPhenomenon(id);
    assert.equal(phen.list.length, 13);
    const bp = breakpoints(phen.list.map((s) => s.values));
    assert.equal(bp.count, 13 * 1000);
    assert.ok(bp.low <= bp.high);
    const all = phen.list.flatMap((s) => [...s.values]).sort((a, b) => a - b);
    assert.equal(bp.low, percentile(all, 0.33));
    assert.equal(bp.high, percentile(all, 0.66));
    assert.ok(doc.includes(bp.low.toPrecision(4)) && doc.includes(bp.high.toPrecision(4)), id + " breakpoints are documented");
  }
});

test("the level follows the real value; none for temperature, missing values or zero rain", async () => {
  const bp = { low: 1, high: 2 };
  assert.equal(levelFor({ phenomenon: "wind", value: 0.5, breakpoints: bp }), "low");
  assert.equal(levelFor({ phenomenon: "wind", value: 1, breakpoints: bp }), "low");
  assert.equal(levelFor({ phenomenon: "wind", value: 1.5, breakpoints: bp }), "mid");
  assert.equal(levelFor({ phenomenon: "wind", value: 2, breakpoints: bp }), "mid");
  assert.equal(levelFor({ phenomenon: "dust", value: 2.1, breakpoints: bp }), "high");
  assert.equal(levelFor({ phenomenon: "temperature", value: 20, breakpoints: bp }), null);
  assert.equal(levelFor({ phenomenon: "wind", value: null, breakpoints: bp }), null);
  assert.equal(levelFor({ phenomenon: "wind", value: Number.NaN, breakpoints: bp }), null);
  assert.equal(levelFor({ phenomenon: "rainfall", value: 0, breakpoints: bp }), null);
  assert.equal(levelFor({ phenomenon: "rainfall", value: 0.0001, breakpoints: bp }), "low");
  // a real, higher value never plays a lower level
  const wind = await pkg.openPhenomenon("wind");
  const real = breakpoints(wind.list.map((s) => s.values));
  const rank = { low: 0, mid: 1, high: 2 };
  const sample = [...wind.byDate("2025-04-15").values].sort((a, b) => a - b);
  let last = -1;
  for (const v of sample) { const r = rank[levelFor({ phenomenon: "wind", value: v, breakpoints: real })]; assert.ok(r >= last); last = r; }
  assert.ok(!AMBIENCE_PHENOMENA.includes("temperature") && PHENOMENON_IDS.includes("temperature"));
});

test("ambience is OFF by default and starts nothing before sound is enabled", () => {
  assert.equal(defaults.ambience, false);
  assert.equal(sanitize({}).ambience, false);
  assert.equal(sanitize({ ambience: "yes" }).ambience, false);
  assert.equal(sanitize({ ambience: true }).ambience, true);
  let created = 0;
  const engine = createAmbience({ baseUrl: "http://localhost/", createContext: () => { created += 1; throw new Error("must not start"); } });
  engine.stop();
  engine.setLevel(null, null);
  assert.equal(created, 0, "no audio context is created until a level is requested after the user enabled sound");
  assert.equal(engine.active, null);
});

test("the mix: about 12 dB under the data, 0.5 s loop crossfade, 400 ms level crossfade, own volume, ducked by speech", () => {
  assert.ok(Math.abs(20 * Math.log10(UNDER_DATA_GAIN) + 12) < 0.01);
  assert.equal(CROSSFADE_S, 0.5);
  assert.equal(LEVEL_FADE_S, 0.4);
  const engine = createAmbience({ baseUrl: "http://localhost/", createContext: () => ({}) });
  engine.setDataVolume(1);
  engine.setVolume(1);
  const open = engine.gain;
  engine.setVolume(0.5);
  assert.ok(Math.abs(engine.gain - open / 2) < 1e-9);
  engine.setVolume(1);
  engine.setDuck(true);
  assert.ok(engine.gain < open * 0.2);
  engine.setDuck(false);
  assert.equal(engine.gain, open);
});

test("the Studio labels the layer and keeps it off for temperature", async () => {
  const copy = await readFile(new URL("../web/studio/studio-ui-copy.js", import.meta.url), "utf8");
  assert.ok(copy.includes("Illustrative recording, not data. The level (low/mid/high) follows the real value."));
  assert.ok(copy.includes("تسجيل توضيحي وليس بيانات. المستوى يتبع القيمة الحقيقية."));
  assert.ok(copy.includes("Temperature has no ambience recording."));
});
