import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { exploreCopy } from "../web/cinematic/site/explore-copy.js";
import { PHENOMENA_ORDER, compareValues } from "../web/cinematic/site/explore.js";
import { FINISHED_KEY, isDecodeFinished, markDecodeFinished } from "../web/cinematic/site/progress.js";
import { DOCUMENTED_BREAKPOINTS } from "../web/studio/ambience-core.js";
import { DECODE_LOCKED_DATES, PHENOMENON_IDS, isLocked } from "../web/studio/datasets.js";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" ? k + "{" + keys(o[k]) + "}" : k)).join();
const tokens = (t) => (String(t).match(/\{\w+\}/g) ?? []).sort().join(",");
function sameTokens(a, b, path = "") { if (typeof a === "string") assert.equal(tokens(a), tokens(b), path); else if (a && typeof a === "object") for (const k of Object.keys(a)) sameTokens(a[k], b[k], path + "." + k); }

test("Explore Earth: exactly Dust, Rainfall and Wind, the same datasets as Decode and the Studio", async () => {
  assert.deepEqual([...PHENOMENA_ORDER], ["dust", "rainfall", "wind"]);
  assert.deepEqual([...PHENOMENA_ORDER].sort(), [...PHENOMENON_IDS].sort());
  for (const language of ["en", "ar"]) {
    const c = exploreCopy[language];
    assert.deepEqual(Object.keys(c.tabs).filter((k) => k !== "label"), ["dust", "rainfall", "wind"]);
    assert.deepEqual(Object.keys(c.phen), ["dust", "rainfall", "wind"]);
    for (const id of PHENOMENA_ORDER) for (const field of ["name", "measure", "unit", "variable", "what", "highLow", "why", "sound"]) assert.ok(c.phen[id][field], `${language} ${id} ${field}`);
  }
  const src = await read("web/cinematic/site/explore.js");
  assert.ok(src.includes("openPackage") && src.includes("createRecordings") && src.includes("meaningPhrase") && src.includes("dryNotice"), "reuses the Studio loaders, the recordings, the meaning phrases and the dry-date suggestions");
  assert.ok(src.includes("levelFor") && src.includes("DOCUMENTED_BREAKPOINTS"), "the sound level comes from the real value and the documented breakpoints");
});

test("Explore Earth: copy parity in English and Arabic, nothing about humidity, temperature, levels, scores or profiles", () => {
  assert.equal(keys(exploreCopy.en), keys(exploreCopy.ar));
  sameTokens(exploreCopy.en, exploreCopy.ar);
  const text = JSON.stringify(exploreCopy);
  assert.ok(!/humidity|temperature|رطوبة|حرارة/i.test(text));
  assert.ok(!/\blevel \d|\bscore\b|profile|مستوى \d|الملف الشخصي|نقاط/i.test(text.replace(/"(cta|lock)":\{[^}]*\}/g, "")), "no game system in Explore");
  assert.ok(exploreCopy.en.lock.text.includes("Decode level 1"));
});

test("Explore Earth: the explanations state the documented sound thresholds and the rain rule", () => {
  const d = DOCUMENTED_BREAKPOINTS;
  const en = exploreCopy.en.phen;
  assert.ok(en.dust.sound.includes(String(Number(d.dust.low.toFixed(3)))) && en.dust.sound.includes(String(Number(d.dust.high.toFixed(3)))));
  assert.ok(en.rainfall.sound.includes("0.164") && en.rainfall.sound.includes("0.312") && en.rainfall.sound.includes("0.1 mm/h"));
  assert.ok(en.wind.sound.includes("2.5 m/s") && en.wind.sound.includes("4.1 m/s"));
  assert.ok(en.rainfall.what.includes("Below 0.1 mm per hour counts as no measurable rain"));
  assert.ok(exploreCopy.ar.phen.rainfall.what.includes("0.1"));
  for (const id of PHENOMENA_ORDER) assert.ok(en[id].highLow.includes("compared with the other values of this dataset"), "relative wording, not a weather claim");
});

test("Explore Earth: comparison is numerical, pure and handles missing values", () => {
  assert.deepEqual(compareValues(0.3, 0.1), { difference: 0.19999999999999998, higher: "a" });
  assert.equal(compareValues(0.1, 0.1).higher, null);
  assert.equal(compareValues(null, 0.1), null);
  assert.equal(compareValues(0.1, Number.NaN), null);
});

test("Explore Earth: the spoiler rules (page lock until Decode level 1, dust dates until all five levels)", async () => {
  const src = await read("web/cinematic/site/explore.js");
  assert.match(src, /spoilersUnlocked\(\)/);
  assert.match(src, /isLocked\(/);
  assert.match(src, /isDecodeFinished\(\)/);
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

test("Explore Earth: ends with a clear call to Decode and has no game system", async () => {
  const src = await read("web/cinematic/site/explore.js");
  assert.ok(src.includes('"./decode.html"') && src.includes("c.cta.button"));
  assert.ok(!/createRun|createProfileStore|completeLevel|LEVELS/.test(src));
  assert.ok(exploreCopy.en.cta.title === "Ready? Test yourself in Decode");
  const page = await read("web/pages/explore.html");
  assert.ok(page.includes("startExplore") && page.includes("explore-root"));
});
