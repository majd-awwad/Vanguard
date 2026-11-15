import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { openPackage } from "../web/studio/datasets.js";
import { CALM_MPS, LEVEL_GRIDS, SOURCE_GRID, aggregateValues, aggregateWind, directionFrom, overlaps } from "../web/experiences/levels/aggregate.js";
import { LEVELS, LEVEL_COUNT, PACKAGE_ID, buildLevelData, levelOf, objectivePoints, rankOf } from "../web/experiences/levels/levels.js";
import { FLOOR, HINT_COST, PASS_F1, SHOW_AFTER, WRONG_COST, compassOf, createRun, earnedPoints, scoreMarks } from "../web/experiences/levels/engine.js";
import { ACHIEVEMENTS, AVATARS, PROFILES_KEY, createProfileStore } from "../web/experiences/levels/profiles.js";
import { DOCUMENTED_BREAKPOINTS } from "../web/studio/ambience-core.js";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async (u) => { const b = await readFile(new URL(u)); return { ok: true, status: 200, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest: async (b) => createHash("sha256").update(b).digest("hex") });
const phens = { dust: await pkg.openPhenomenon("dust"), rainfall: await pkg.openPhenomenon("rainfall"), wind: await pkg.openPhenomenon("wind") };
const rad = (d) => (d * Math.PI) / 180;

// ---------------------------------------------------------------- grids
test("exactly five levels, grids 3x4 4x4 5x6 6x6 6x8: the number of cells grows every level", () => {
  assert.equal(LEVEL_COUNT, 5);
  assert.equal(LEVELS.length, 5);
  assert.deepEqual(LEVELS.map((l) => l.grid.rows + "x" + l.grid.cols), ["3x4", "4x4", "5x6", "6x6", "6x8"]);
  const cells = LEVELS.map((l) => l.grid.rows * l.grid.cols);
  assert.deepEqual(cells, [12, 16, 30, 36, 48]);
  assert.ok(cells.every((c, i) => i === 0 || c > cells[i - 1]));
  assert.deepEqual(LEVELS.map((l) => l.id), [1, 2, 3, 4, 5]);
});

test("aggregation: the overlap weights of a level cell add up to its spherical area, for every cell of every level", () => {
  for (const g of LEVEL_GRIDS) {
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
      const north = SOURCE_GRID.north - (r * 30) / g.rows;
      const south = SOURCE_GRID.north - ((r + 1) * 30) / g.rows;
      const expected = (Math.sin(rad(north)) - Math.sin(rad(south))) * rad(70 / g.cols);
      const total = overlaps(g, r, c).reduce((s, o) => s + o.weight, 0);
      assert.ok(Math.abs(total - expected) < 1e-12, `${g.rows}x${g.cols} ${r},${c}`);
    }
  }
});

test("aggregation recomputed independently (fine lattice of sample points inside each level cell) matches the area-weighted mean on real dust, rain and wind", () => {
  const checks = [["dust", phens.dust.byDate("2025-04-15").values], ["rain", phens.rainfall.byDate("2025-11-15").values]];
  const sample = (values, g, r, c) => {
    const K = 160;
    let sum = 0, weight = 0;
    for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) {
      const lat = SOURCE_GRID.north - ((r + (i + 0.5) / K) * 30) / g.rows;
      const lon = SOURCE_GRID.west + ((c + (j + 0.5) / K) * 70) / g.cols;
      const sr = Math.min(24, Math.floor((SOURCE_GRID.north - lat) / 1.2));
      const sc = Math.min(39, Math.floor((lon - SOURCE_GRID.west) / 1.75));
      const w = Math.cos(rad(lat));
      sum += values[sr * 40 + sc] * w; weight += w;
    }
    return sum / weight;
  };
  for (const [name, values] of checks) {
    const range = Math.max(...values) - Math.min(...values);
    for (const g of LEVEL_GRIDS) {
      const got = aggregateValues(values, g);
      for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        const expected = sample(values, g, r, c);
        assert.ok(Math.abs(got[r * g.cols + c] - expected) <= 0.004 * range, `${name} ${g.rows}x${g.cols} ${r},${c}: ${got[r * g.cols + c]} vs ${expected}`);
      }
    }
  }
  // wind: U and V are averaged first, then speed and direction are derived (never the average of speeds)
  const s = phens.wind.byDate("2025-06-15");
  const g = LEVEL_GRIDS[2];
  const u = aggregateValues(s.measures.uMps, g), v = aggregateValues(s.measures.vMps, g);
  const w = aggregateWind(s.measures.uMps, s.measures.vMps, g);
  w.forEach((x, i) => { assert.ok(Math.abs(x.speed - Math.hypot(u[i], v[i])) < 1e-12); });
  const meanOfSpeeds = aggregateValues(s.values, g);
  assert.ok(w.some((x, i) => x.speed < meanOfSpeeds[i] - 1e-6), "the speed of the mean wind is below the mean of the speeds where directions differ");
});

test("aggregation: exact on aligned cells, constant fields stay constant, any overlapped missing cell makes the level cell missing", () => {
  const level = { rows: 5, cols: 5 }; // 25 rows / 5 = 5 source rows per level row: aligned rows
  const field = Array.from({ length: 1000 }, (_, i) => Math.floor(i / 40)); // value = source row
  const got = aggregateValues(field, level);
  for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) {
    const exact = (() => { let s = 0, w = 0; for (let k = 0; k < 5; k++) { const lat1 = 45 - (r * 5 + k) * 1.2, lat2 = lat1 - 1.2; const a = Math.sin(rad(lat1)) - Math.sin(rad(lat2)); s += (r * 5 + k) * a; w += a; } return s / w; })();
    assert.ok(Math.abs(got[r * 5 + c] - exact) < 1e-9);
  }
  for (const g of LEVEL_GRIDS) assert.ok(aggregateValues(new Array(1000).fill(2.5), g).every((v) => Math.abs(v - 2.5) < 1e-12));
  const holes = new Array(1000).fill(1);
  holes[0] = null; // north-west corner source cell
  const g = LEVEL_GRIDS[0];
  const out = aggregateValues(holes, g);
  assert.equal(out[0], null);
  assert.ok(out.slice(1).every((v) => v === 1), "only the level cell that overlaps the missing cell is missing");
  holes[0] = Number.NaN;
  assert.equal(aggregateValues(holes, g)[0], null);
  assert.equal(aggregateWind(new Array(1000).fill(1), holes.map((v) => (v === 1 ? 1 : null)), g)[0].speed, null);
  assert.throws(() => aggregateValues([1, 2, 3], g));
});

test("wind direction: meteorological FROM direction, calm has none", () => {
  assert.equal(Math.round(directionFrom(0, -5)), 0, "wind blowing south comes from the north");
  assert.equal(Math.round(directionFrom(-5, 0)), 90, "wind blowing west comes from the east");
  assert.equal(Math.round(directionFrom(5, 0)), 270);
  assert.equal(directionFrom(0.1, 0.1), null);
  assert.equal(CALM_MPS, 0.3);
  assert.equal(compassOf(270), "W");
  assert.equal(compassOf(359), "N");
});

// ---------------------------------------------------------------- data per level
test("every level loads from the real package: right datasets, dates, one build group, no missing cells", () => {
  for (const level of LEVELS) {
    const data = buildLevelData(level, phens);
    const n = level.grid.rows * level.grid.cols;
    for (const layers of [data.main, data.from].filter(Boolean)) {
      for (const [name, arr] of Object.entries(layers)) {
        assert.equal(arr.length, n, `L${level.id} ${name}`);
      }
      assert.deepEqual(Object.keys(layers).filter((k) => k !== "windDirection").sort(), level.phenomena.slice().sort());
    }
    assert.equal(Boolean(data.from), level.id === 5);
    for (const p of level.phenomena) {
      const phen = phens[PACKAGE_ID[p]];
      for (const date of Object.values(level.dates)) assert.ok(phen.byDate(date), `${p} ${date}`);
    }
  }
  assert.deepEqual(LEVELS.map((l) => l.phenomena.join("+")), ["dust", "rain", "wind", "dust+rain+wind", "dust+rain+wind"]);
  // the original Decode challenge date and the dust-locked dates are never a level's dust date
  for (const level of LEVELS) if (level.phenomena.includes("dust")) for (const d of Object.values(level.dates)) assert.ok(!["2025-08-15", "2025-08-19"].includes(d));
  assert.ok(Object.values(LEVELS[4].dates).length === 2 && LEVELS[4].dates.from < LEVELS[4].dates.main);
  assert.ok(Object.values(LEVELS[1].dates).every((d) => ["2025-08-15", "2025-07-15", "2025-11-15"].includes(d)), "the rain level uses a wet date");
});

test("thresholds are the documented sound levels (rain below 0.1 mm/h is no measurable rain)", () => {
  assert.equal(rankOf("rain", 0.0999), 0);
  assert.equal(rankOf("rain", 0.1), 1);
  assert.equal(rankOf("rain", DOCUMENTED_BREAKPOINTS.rainfall.low + 1e-9), 2);
  assert.equal(rankOf("dust", DOCUMENTED_BREAKPOINTS.dust.high + 1e-9), 3);
  assert.equal(rankOf("wind", DOCUMENTED_BREAKPOINTS.wind.low), 1);
  assert.equal(rankOf("wind", null), -1);
  assert.equal(levelOf("rain", 0.05), null);
  assert.equal(levelOf("wind", 5), "high");
});

test("difficulty grows: more objectives, more stages, fewer hints, bigger grids", () => {
  const counts = LEVELS.map((l) => l.objectives.length);
  assert.deepEqual(counts, [3, 4, 5, 6, 9]);
  assert.ok(counts.every((c, i) => i === 0 || c > counts[i - 1]));
  assert.ok(counts[4] >= 7);
  const hints = LEVELS.map((l) => l.hints);
  assert.ok(hints.every((h, i) => i === 0 || h <= hints[i - 1]) && hints[0] > hints[4]);
  const stages = LEVELS.map((l) => new Set(l.objectives.map((o) => o.stage)).size);
  assert.ok(stages[3] >= 3 && stages[4] >= 3 && stages[0] === 1);
  for (const l of LEVELS) { const p = objectivePoints(l); assert.equal(p.reduce((s, x) => s + x, 0), 100, `L${l.id} points sum to 100`); assert.ok(p.every((x) => x > 0)); }
  assert.equal(new Set(LEVELS.flatMap((l) => l.objectives.map((o) => o.id))).size, counts.reduce((s, c) => s + c, 0), "objective ids are unique");
});

// ---------------------------------------------------------------- the engine
const playPerfect = (run, level) => {
  for (const obj of level.objectives) {
    const truth = run._truth(obj.id);
    let r;
    if (obj.type === "mark-set") r = run.submit({ cells: truth });
    else if (obj.type === "find-max") r = run.submit({ cell: truth[0] });
    else if (obj.type === "pick-higher") { const p = run._pair(obj.id); r = run.submit({ pick: p.A === p.higher ? "A" : "B" }); }
    else r = run.submit({ option: truth[0].from });
    assert.ok(r.ok, `${obj.id} perfect answer accepted`);
  }
};

test("every objective of every level has a real, non-trivial answer, and a perfect run scores exactly 100", () => {
  for (const level of LEVELS) {
    const data = buildLevelData(level, phens);
    const run = createRun({ level, data, exposeTruth: true });
    const n = level.grid.rows * level.grid.cols;
    for (const obj of level.objectives) {
      if (obj.type === "mark-set") { const t = run._truth(obj.id); assert.ok(t.length >= 2 && t.length < n / 2 + 1, `L${level.id} ${obj.id}: ${t.length} of ${n}`); }
      if (obj.type === "find-max") assert.ok(run._truth(obj.id).length >= 1 && run._truth(obj.id).length < n);
      if (obj.type === "pick-higher") { const p = run._pair(obj.id); assert.notEqual(p.A, p.B); assert.ok(rankOf(obj.phen, (obj.phen === "wind" ? data.main.wind : data.main[obj.phen])[p.higher]) > rankOf(obj.phen, (obj.phen === "wind" ? data.main.wind : data.main[obj.phen])[p.A === p.higher ? p.B : p.A]), "the pair differs by sound level, so it can be decided by ear"); }
    }
    playPerfect(run, level);
    const view = run.view();
    assert.equal(view.finished, true);
    assert.equal(view.score, 100);
    assert.equal(run.result().perfect, true);
  }
});

test("answer safety: nothing readable before the reveal contains a value of the data; completed objectives reveal only their layers", () => {
  const level = LEVELS[3];
  const data = buildLevelData(level, phens);
  const run = createRun({ level, data, exposeTruth: true });
  const before = JSON.stringify(run.view());
  assert.ok(!/"values?"|"truth"|"answer"/.test(before));
  assert.deepEqual(run.view().revealed, {});
  const plain = createRun({ level, data });
  assert.deepEqual(Object.keys(plain).sort(), ["cue", "grid", "hint", "level", "result", "showAnswer", "snapshot", "submit", "view"], "only the intended API");
  assert.ok(!("_truth" in plain) && !("_pair" in plain), "the app never exposes the truth");
  for (const phen of ["dust", "rain", "wind"]) for (const sample of [0, 7, 20]) {
    const v = (phen === "wind" ? data.main.wind : data.main[phen])[sample];
    assert.ok(!before.includes(String(v)), `${phen} value not leaked`);
  }
  // a cue is a level, not a number
  const cue = plain.cue("dust", 3);
  assert.ok(["low", "mid", "high"].includes(cue.level) || cue.level === null);
  assert.ok(cue.pan >= -1 && cue.pan <= 1 && cue.rate >= 0.85 && cue.rate <= 1.25);
  // completing the rain objective reveals rain only
  const t = run._truth("l4-dust") ?? [];
  const p = run._pair("l4-dust");
  run.submit({ pick: p.A === p.higher ? "A" : "B" });
  assert.deepEqual(Object.keys(run.view().revealed), ["dust"]);
  run.submit({ cells: run._truth("l4-rain") });
  assert.deepEqual(Object.keys(run.view().revealed).sort(), ["dust", "rain"]);
  void t;
});

test("cues: pan follows the column (west -1, east +1), playback rate follows the row (south 0.85, north 1.25)", () => {
  const level = LEVELS[4];
  const run = createRun({ level, data: buildLevelData(level, phens) });
  const { rows, cols } = level.grid;
  assert.ok(run.cue("dust", 0).pan < run.cue("dust", cols - 1).pan);
  assert.ok(run.cue("dust", 0).pan < 0 && run.cue("dust", cols - 1).pan > 0);
  assert.ok(Math.abs(run.cue("dust", 0).rate - 1.25) < 1e-9, "north row is fastest");
  assert.ok(Math.abs(run.cue("dust", (rows - 1) * cols).rate - 0.85) < 1e-9, "south row is slowest");
  assert.equal(run.cue("dust", 5).phenomenon, "dust");
  assert.equal(run.cue("rain", 5).phenomenon, "rainfall");
});

test("scoring: 100 per level, wrong attempts and hints cost points, the floor keeps it fair, marks are scored by F1", () => {
  assert.equal(earnedPoints(20, {}), 20);
  assert.equal(earnedPoints(20, { wrong: 1 }), 17);
  assert.equal(earnedPoints(20, { hints: 1 }), 18);
  assert.equal(earnedPoints(20, { wrong: 10, hints: 3 }), Math.round(20 * FLOOR));
  assert.equal(earnedPoints(20, { shown: true }), 8);
  assert.equal(WRONG_COST, 0.15);
  assert.equal(HINT_COST, 0.1);
  assert.ok(scoreMarks([1, 2, 3, 4], [1, 2, 3, 4]).pass);
  assert.ok(scoreMarks([1, 2, 3, 4], [1, 2, 3]).pass, "3 of 4 with nothing extra passes (F1 0.857)");
  assert.ok(!scoreMarks([1, 2, 3, 4], [1, 2]).pass);
  assert.ok(!scoreMarks([1, 2], [1, 9, 8]).pass);
  assert.equal(scoreMarks([1, 2], [3]).hits, 0);
  assert.ok(PASS_F1 < 0.8 && PASS_F1 > 0.79);
  const level = LEVELS[0];
  const run = createRun({ level, data: buildLevelData(level, phens), exposeTruth: true });
  // wrong then right on the first objective
  const p = run._pair("l1-pick");
  const wrong = p.A === p.higher ? "B" : "A";
  const r1 = run.submit({ pick: wrong });
  assert.equal(r1.ok, false);
  assert.equal(run.view().current.wrong, 1);
  const hint = run.hint();
  assert.equal(hint.level, 1);
  run.submit({ pick: wrong === "A" ? "B" : "A" });
  const pts = run.view().objectives[0].points;
  assert.equal(run.view().objectives[0].earned, earnedPoints(pts, { wrong: 1, hints: 1 }));
  // hints are limited per level and shrink with the level
  const run5 = createRun({ level: LEVELS[4], data: buildLevelData(LEVELS[4], phens), exposeTruth: true });
  assert.ok(run5.hint());
  assert.equal(run5.hint(), null, "level 5 allows one hint per objective");
  // after SHOW_AFTER wrong attempts the answer may be shown and the objective pays the floor
  const run2 = createRun({ level: LEVELS[0], data: buildLevelData(LEVELS[0], phens), exposeTruth: true });
  assert.equal(run2.showAnswer(), null, "not available yet");
  for (let i = 0; i < SHOW_AFTER; i++) run2.submit({ pick: run2._pair("l1-pick").A === run2._pair("l1-pick").higher ? "B" : "A" });
  assert.equal(run2.view().current.canShowAnswer, true);
  const shown = run2.showAnswer();
  assert.ok(shown.earned > 0 && shown.earned === earnedPoints(run2.view().objectives[0].points, { shown: true }));
});

test("progress can be saved and restored (no data values in the snapshot)", () => {
  const level = LEVELS[2];
  const data = buildLevelData(level, phens);
  const a = createRun({ level, data, exposeTruth: true });
  const p = a._pair("l3-pick");
  a.submit({ pick: p.A === p.higher ? "A" : "B" });
  a.submit({ cell: a._truth("l3-max")[1] });
  const snap = a.snapshot();
  assert.ok(!JSON.stringify(snap).includes(String(data.main.wind[a._truth("l3-max")[0]])));
  const b = createRun({ level, data, restore: JSON.parse(JSON.stringify(snap)), exposeTruth: true });
  assert.equal(b.view().index, 2);
  assert.equal(b.view().score, a.view().score);
  assert.equal(b.view().current.id, "l3-high");
  // the direction question refers to the cell the player chose
  const choice = b._direction("l3-dir");
  assert.equal(choice.cell, a._truth("l3-max")[1]);
  const other = createRun({ level: LEVELS[0], data: buildLevelData(LEVELS[0], phens), restore: snap });
  assert.equal(other.view().index, 0, "a snapshot of another level is ignored");
});

// ---------------------------------------------------------------- profiles
const memoryStorage = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k), raw: m }; };

test("profiles: create, select, delete, validation, and eight avatars", () => {
  assert.equal(AVATARS.length, 8);
  const storage = memoryStorage();
  const store = createProfileStore({ storage });
  assert.deepEqual(store.list(), []);
  assert.equal(store.create({ name: "  ", avatar: "globe" }).ok, false);
  const a = store.create({ name: "Yaman", avatar: "dune" });
  assert.ok(a.ok);
  assert.equal(store.create({ name: "yaman", avatar: "sun" }).error, "duplicate");
  const b = store.create({ name: "Layla <b>", avatar: "not-an-avatar" });
  assert.equal(b.profile.name, "Layla b");
  assert.equal(b.profile.avatar, AVATARS[0]);
  assert.equal(store.activeId, b.profile.id);
  assert.ok(store.select(a.profile.id));
  assert.equal(store.active().name, "Yaman");
  assert.equal(store.remove(b.profile.id), true);
  assert.equal(store.list().length, 1);
  const saved = JSON.parse(storage.raw.get(PROFILES_KEY));
  assert.equal(saved.version, 1);
  assert.deepEqual(Object.keys(saved.profiles[0].progress).sort(), ["achievements", "best", "completed", "current", "finishedAt", "lastLevel", "total"]);
});

test("profiles: independent progress, best score kept on replay, unlocks, total, achievements and persistence after reload", () => {
  const storage = memoryStorage();
  const s1 = createProfileStore({ storage });
  const a = s1.create({ name: "A", avatar: "globe" }).profile;
  const b = s1.create({ name: "B", avatar: "sun" }).profile;
  assert.deepEqual(s1.unlockedLevels(a.id), [1]);
  const done = s1.completeLevel(a.id, { levelId: 1, score: 80, hints: 1 });
  assert.equal(done.first, true);
  assert.deepEqual(s1.unlockedLevels(a.id), [1, 2], "completing level 1 unlocks level 2");
  assert.deepEqual(s1.unlockedLevels(b.id), [1], "another profile is independent");
  s1.completeLevel(a.id, { levelId: 1, score: 60, hints: 0 });
  assert.equal(s1.get(a.id).progress.best[1], 80, "a worse replay never lowers the best");
  const better = s1.completeLevel(a.id, { levelId: 1, score: 100, hints: 0 });
  assert.equal(better.improved, true);
  assert.equal(s1.get(a.id).progress.total, 100);
  assert.ok(s1.get(a.id).progress.achievements.includes("perfect-level") && s1.get(a.id).progress.achievements.includes("no-hints") && s1.get(a.id).progress.achievements.includes("level-1"));
  s1.saveCurrent(a.id, { levelId: 2, objectives: { x: { done: true } } });
  assert.equal(s1.get(a.id).progress.lastLevel, 2);
  assert.deepEqual(s1.get(b.id).progress.completed, []);
  // reload from storage
  const s2 = createProfileStore({ storage });
  assert.equal(s2.list().length, 2);
  assert.equal(s2.get(a.id).progress.best[1], 100);
  assert.deepEqual(s2.get(a.id).progress.current, { levelId: 2, objectives: { x: { done: true } } });
  assert.equal(s2.activeId, b.id);
  // all five levels: the Earth Master achievement and the total out of 500
  for (let l = 1; l <= 5; l++) s2.completeLevel(b.id, { levelId: l, score: 90, hints: 2 });
  const end = s2.get(b.id).progress;
  assert.equal(end.total, 450);
  assert.ok(end.achievements.includes("earth-master") && end.finishedAt);
  assert.ok(ACHIEVEMENTS.includes("earth-master"));
  assert.deepEqual(s2.unlockedLevels(b.id), [1, 2, 3, 4, 5]);
});

test("profiles: broken or blocked storage never throws; corrupt data is dropped", () => {
  const throwing = { getItem() { throw new Error("blocked"); }, setItem() { throw new Error("full"); } };
  const s = createProfileStore({ storage: throwing });
  const made = s.create({ name: "Solo", avatar: "wave" });
  assert.ok(made.ok);
  assert.equal(s.persisted, false, "the UI can say it is not saved");
  assert.equal(s.list().length, 1, "the profile still works in memory");
  const junk = memoryStorage();
  junk.setItem(PROFILES_KEY, "{not json");
  assert.deepEqual(createProfileStore({ storage: junk }).list(), []);
  junk.setItem(PROFILES_KEY, JSON.stringify({ version: 99, profiles: [{ id: "x", name: "Old" }] }));
  assert.deepEqual(createProfileStore({ storage: junk }).list(), [], "an unknown schema version is ignored, not trusted");
  junk.setItem(PROFILES_KEY, JSON.stringify({ version: 1, activeId: "zzz", profiles: [{ id: "a", name: "Ok", avatar: "x", progress: { completed: [1, 9, "a"], best: { 1: 150, 7: 10 }, achievements: ["bogus", "level-1"] } }, { name: "no id" }] }));
  const ok = createProfileStore({ storage: junk });
  assert.equal(ok.list().length, 1);
  assert.deepEqual(ok.list()[0].progress.completed, [1]);
  assert.deepEqual(ok.list()[0].progress.best, { 1: 100 });
  assert.deepEqual(ok.list()[0].progress.achievements, ["level-1"]);
  assert.equal(ok.activeId, null);
});
