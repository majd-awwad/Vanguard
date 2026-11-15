import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { exploreCopy } from "../web/cinematic/site/explore-copy.js";
import { COMPASS_NAMES, exploreData } from "../web/cinematic/site/explore-data-copy.js";
import { GRIDS, PHENOMENA_ORDER, compareValues, levelMax } from "../web/cinematic/site/explore.js";
import { FINISHED_KEY, isDecodeFinished, markDecodeFinished } from "../web/cinematic/site/progress.js";
import { aggregateValues } from "../web/experiences/levels/aggregate.js";
import { DOCUMENTED_BREAKPOINTS } from "../web/studio/ambience-core.js";
import { DECODE_LOCKED_DATES, PHENOMENON_IDS, isLocked, openPackage } from "../web/studio/datasets.js";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" ? k + "{" + keys(o[k]) + "}" : k)).join();
const tokens = (t) => (String(t).match(/\{\w+\}/g) ?? []).sort().join(",");
function sameTokens(a, b, path = "") { if (typeof a === "string") assert.equal(tokens(a), tokens(b), path); else if (a && typeof a === "object") for (const k of Object.keys(a)) sameTokens(a[k], b[k], path + "." + k); }

test("Explore Earth keeps its original page: the 3D globe, the fly-in, the registered grid, the selected-cell card and the compare drawer", async () => {
  const src = await read("web/cinematic/site/explore.js");
  for (const part of ["createScene({ document })", "scene.setStage(el.stage)", "scene.setGeography(", "scene?.setSnapshot(",'body.dataset.flight', "mountCellGrid(", "xp-drawer", "xp-compare-drawer", "xp-card", "xp-compass", "level-picker", "drawWaveform("]) assert.ok(src.includes(part), part);
  const css = await read("web/cinematic/site/explore.css");
  assert.ok(css.includes("body.explore-3d .cine-canvas") && css.includes(".xp-layout") && css.includes(".xp-drawer"), "the original stylesheet is the base");
  assert.ok(!/xp-map-canvas|xp-live-stage/.test(src + css), "the flat heat-map layout is gone");
  const page = await read("web/pages/explore.html");
  assert.ok(page.includes("startExplore") && page.includes("explore-root") && !page.includes("decode-game"));
});

test("Explore Earth: exactly Dust, Rainfall and Wind, the same datasets as Decode and the Studio, one compact switch", async () => {
  assert.deepEqual([...PHENOMENA_ORDER], ["dust", "rainfall", "wind"]);
  assert.deepEqual([...PHENOMENA_ORDER].sort(), [...PHENOMENON_IDS].sort());
  for (const language of ["en", "ar"]) {
    const d = exploreData[language];
    assert.deepEqual(Object.keys(d.tabs).filter((k) => k !== "label"), ["dust", "rainfall", "wind"]);
    assert.deepEqual(Object.keys(d.phen), ["dust", "rainfall", "wind"]);
    for (const id of PHENOMENA_ORDER) for (const field of ["name", "measure", "unit", "variable", "what", "highLow", "why", "short", "sound"]) assert.ok(d.phen[id][field], `${language} ${id} ${field}`);
  }
  const src = await read("web/cinematic/site/explore.js");
  assert.ok(src.includes("openPackage") && src.includes("createRecordings") && src.includes("meaningPhrase") && src.includes("dryNotice") && src.includes("aggregateValues") && src.includes("aggregateWind"), "the Studio loaders, the recordings, the meaning phrases, the dry-date suggestions and the area-weighted cells");
  assert.ok(src.includes("levelFor") && src.includes("DOCUMENTED_BREAKPOINTS"), "the sound level comes from the real value");
  assert.ok(src.includes("panOfCell"), "pan follows the longitude of the cell");
  assert.ok(src.includes('class: "seg xp-tabs"') && src.includes("xp-switch"), "one row: the switch and the date");
  assert.deepEqual(GRIDS, { quick: { rows: 3, cols: 4 }, advanced: { rows: 6, cols: 8 } });
});

test("Explore Earth: the original copy is untouched, the new copy has parity in English and Arabic, and nothing about humidity, temperature, scores or profiles", () => {
  assert.equal(keys(exploreCopy.en), keys(exploreCopy.ar));
  assert.equal(keys(exploreData.en), keys(exploreData.ar));
  sameTokens(exploreData.en, exploreData.ar);
  assert.deepEqual(Object.keys(COMPASS_NAMES.en), Object.keys(COMPASS_NAMES.ar));
  const text = JSON.stringify(exploreData) + JSON.stringify(exploreCopy);
  assert.ok(!/humidity|temperature|رطوبة|حرارة/i.test(text));
  assert.ok(!/\bscore\b|profile|نقاط|الملف الشخصي/i.test(text));
  assert.ok(exploreData.en.cta.button === "Ready? Test yourself in Decode");
  assert.ok(exploreData.en.lock.text.includes("Decode level 1"));
});

test("Explore Earth: the explanations state the documented sound thresholds and the rain rule, and the card explains in two sentences", () => {
  const en = exploreData.en.phen;
  assert.ok(en.rainfall.what.includes("Below 0.1 mm/h counts as no measurable rain"));
  assert.ok(exploreData.ar.phen.rainfall.what.includes("0.1"));
  for (const id of PHENOMENA_ORDER) {
    assert.ok(en[id].highLow.includes("compared with the other values of this dataset") || en[id].short.includes("compared with this dataset"), "relative wording, not a weather claim: " + id);
    assert.ok(en[id].short.split(/(?<=[.:])\s/).length <= 3, "a short explanation: " + id);
  }
  assert.ok(DOCUMENTED_BREAKPOINTS.rainfall.low > 0.1);
});

test("Explore Earth: the cells are the area-weighted means of the real data cells, on the Quick and Advanced grids", async () => {
  const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
  const fetchImpl = async (u) => { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
  const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
  for (const id of ["dust", "rainfall", "wind"]) {
    const phen = await pkg.openPhenomenon(id);
    const snap = phen.byDate("2025-04-15");
    for (const g of Object.values(GRIDS)) {
      const cells = aggregateValues(snap.values, g);
      assert.equal(cells.length, g.rows * g.cols);
      assert.ok(cells.every(Number.isFinite), id + " has no missing cell in this release");
      const record = { grid: { cells: cells.map((value, i) => ({ row: Math.floor(i / g.cols), col: i % g.cols, value })) } };
      assert.equal(levelMax(record), Math.max(...cells));
    }
  }
});

test("Explore Earth: comparison is numerical, pure and handles missing values", () => {
  assert.deepEqual(compareValues(0.3, 0.1), { difference: 0.19999999999999998, higher: "a" });
  assert.equal(compareValues(0.1, 0.1).higher, null);
  assert.equal(compareValues(null, 0.1), null);
  assert.equal(compareValues(0.1, Number.NaN), null);
});

test("Explore Earth: the spoiler rules (page lock until Decode level 1, dust dates until all five levels) and the date control", async () => {
  const src = await read("web/cinematic/site/explore.js");
  assert.match(src, /spoilersUnlocked\(\)/);
  assert.match(src, /isLocked\(/);
  assert.match(src, /isDecodeFinished\(\)/);
  assert.match(src, /DECODE_LOCKED_DATES/);
  assert.equal(FINISHED_KEY, "earthpulse.decode.finished.v1");
  assert.deepEqual([...DECODE_LOCKED_DATES], ["2025-08-15", "2025-08-19"]);
  assert.equal(isLocked("dust", "2025-08-19", false), true);
  assert.equal(isLocked("dust", "2025-08-19", true), false);
  assert.equal(isLocked("rainfall", "2025-08-15", false), false, "the lock is about dust only");
  const store = new Map();
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(isDecodeFinished(storage), false);
  assert.equal(markDecodeFinished(storage), true);
  assert.equal(isDecodeFinished(storage), true);
  assert.equal(isDecodeFinished({ getItem() { throw new Error("blocked"); } }), false);
  const game = await read("web/cinematic/site/decode-game.js");
  assert.ok(game.includes("markDecodeFinished()") && game.includes("outcome?.allDone"), "finishing all five levels opens the dust dates");
});

test("Explore Earth: wind shows its direction, the card shows the meaning phrase, and the page ends with a button to Decode", async () => {
  const src = await read("web/cinematic/site/explore.js");
  assert.ok(src.includes("COMPASS_NAMES") && src.includes("d.selected.dir") && src.includes("d.selected.calm"));
  assert.ok(src.includes("meaningPhrase(") && src.includes('"xp-badge"') && src.includes("d.phen[state.id].short"));
  assert.ok(src.includes('href: "./decode.html"') && src.includes("d.cta.button"));
  assert.ok(!/createRun|createProfileStore|completeLevel|LEVELS/.test(src), "no game system in Explore");
});
