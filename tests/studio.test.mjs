import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import test from "node:test";
import {
  DIFF_MAX, NEAR_ZERO, VALUE_MAX, VALUE_MIN, cellAt, cellCenter, cellRect, diffColor, diffInverse, diffS, distanceKm, layerT, rampTable, rectCells,
  samplePath, smoothT, splineWeights, summarize, tToValue, valueColor, valueT,
} from "../web/studio/field.js";
import { MAX_ZOOM, clampView, createView, fitRect, geoToScreen, panBy, pixelsPerDegree, screenToGeo, visibleBounds, zoomAt } from "../web/studio/view.js";
import { studioCopy } from "../web/studio/studio-copy.js";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8");
const dust = "web/assets/decode/dust-v2/";
const grid = JSON.parse(read(dust + "grid.json"));
const catalog = JSON.parse(read(dust + "catalog.json"));
const snapshots = catalog.snapshots.map((s) => JSON.parse(read(dust + s.path)));
const bounds = grid.bounds;

test("grid geometry comes from the dust-v2 grid: 25x40, row 0 north, column 0 west", () => {
  assert.equal(grid.rows * grid.cols, 1000);
  assert.deepEqual(cellAt(grid, -20, 45), { row: 0, col: 0, index: 0 });
  assert.deepEqual(cellAt(grid, 50, 15), { row: 24, col: 39, index: 999 });
  assert.equal(cellAt(grid, 51, 20), null);
  const r = cellRect(grid, 3, 5);
  assert.ok(Math.abs(r.north - (45 - 3 * 1.2)) < 1e-9 && Math.abs(r.west - (-20 + 5 * 1.75)) < 1e-9);
  // Our arithmetic equals the published per-cell rectangles.
  for (const cell of [grid.cells[0], grid.cells[417], grid.cells[999]]) {
    const mine = cellRect(grid, cell.row, cell.col);
    for (const k of ["north", "south", "east", "west"]) assert.ok(Math.abs(mine[k] - cell.bounds[k]) < 1e-9, k);
    const c = cellCenter(grid, cell.row, cell.col);
    assert.ok(Math.abs(c.lat - cell.lat) < 1e-9 && Math.abs(c.lon - cell.lon) < 1e-9);
  }
});

test("fixed scales cover every real value of every catalog date, and never depend on the selected date", () => {
  let min = Infinity;
  let max = 0;
  for (const s of snapshots) for (const v of s.values) if (v !== null) { min = Math.min(min, v); max = Math.max(max, v); }
  assert.ok(min >= VALUE_MIN && max <= VALUE_MAX, `${min}..${max}`);
  assert.equal(valueT(VALUE_MIN), 0);
  assert.equal(valueT(VALUE_MAX), 1);
  assert.ok(Math.abs(tToValue(valueT(0.2)) - 0.2) < 1e-9);
  assert.ok(valueT(0.1) < valueT(0.2) && valueT(0.2) < valueT(1));
  // Same value, same colour, whatever date it came from.
  assert.deepEqual(valueColor(0.3), valueColor(0.3));
});

test("change colours: increase purple, decrease orange, near-zero neutral, band stated", () => {
  const [rp, , bp] = diffColor(0.5);
  const [ro, , bo] = diffColor(-0.5);
  assert.ok(bp > rp * 0.9 && rp > bo, "increase is purple-ish");
  assert.ok(ro > bo, "decrease is orange-ish");
  assert.deepEqual(diffColor(0), diffColor(NEAR_ZERO * 0.9));
  assert.deepEqual(diffColor(-NEAR_ZERO * 0.9), diffColor(0));
  assert.notDeepEqual(diffColor(NEAR_ZERO * 1.1), diffColor(0));
  assert.equal(diffS(NEAR_ZERO * 0.5), 0);
  assert.equal(diffS(DIFF_MAX * 10), 1);
  assert.equal(diffS(-DIFF_MAX * 10), -1);
  assert.ok(Math.abs(diffInverse(diffS(0.4)) - 0.4) < 1e-9);
  assert.equal(rampTable("value").length, 1024);
  assert.equal(rampTable("diff").length, 1024);
});

test("published change data fits the fixed change scale; unavailable pairs carry the catalog reason", () => {
  for (const file of readdirSync(new URL("../" + dust + "comparisons", import.meta.url))) {
    const data = JSON.parse(read(dust + "comparisons/" + file));
    const values = data.values.filter((v) => v !== null);
    assert.ok(Math.max(...values.map(Math.abs)) <= DIFF_MAX * 1.3, file);
  }
  assert.equal(catalog.comparisons.length, 2);
  assert.match(catalog.unavailableComparisons[0].reason, /build/i);
});

test("missing values stay missing: masked, counted, never averaged as zero", () => {
  const values = [0.2, null, 0.4, 0];
  const g = { rows: 2, cols: 2, bounds: { west: 0, east: 2, south: 0, north: 2 } };
  const { t, mask } = layerT(values, g, "value");
  assert.deepEqual([...mask], [0, 255, 0, 0]);
  assert.ok(t[1] > 0, "a missing cell borrows a neighbour for smoothing only");
  const s = summarize(values, [{ index: 0 }, { index: 1 }, { index: 2 }, { index: 3 }]);
  assert.deepEqual({ valid: s.valid, missing: s.missing, min: s.min, max: s.max }, { valid: 3, missing: 1, min: 0, max: 0.4 });
  assert.ok(Math.abs(s.mean - 0.2) < 1e-12);
  const none = summarize([null, null], [{ index: 0 }, { index: 1 }]);
  assert.equal(none.mean, null);
  assert.equal(none.min, null);
});

test("smooth display field: spline weights sum to one, constant stays constant, edges are clamped", () => {
  for (const x of [0, 0.3, 0.99]) assert.ok(Math.abs(splineWeights(x).reduce((a, b) => a + b) - 1) < 1e-12);
  const flat = new Float32Array(1000).fill(0.4);
  assert.ok(Math.abs(smoothT(flat, grid, 10.3, 31.1) - 0.4) < 1e-6);
  assert.ok(Math.abs(smoothT(flat, grid, -20, 45) - 0.4) < 1e-6);
  const { t } = layerT(snapshots[0].values, grid, "value");
  const centre = cellCenter(grid, 10, 10);
  const smooth = smoothT(t, grid, centre.lon, centre.lat);
  assert.ok(Math.abs(smooth - t[10 * 40 + 10]) < 0.12, "smoothing stays near the cell value");
});

test("view: pan/zoom keep the geographic point under the cursor and stay registered", () => {
  const W = 1000;
  const H = 560;
  let view = createView(bounds);
  assert.ok(Math.abs(pixelsPerDegree(view, bounds, W, H) - 1000 / 70) < 1e-9);
  const before = screenToGeo(view, bounds, W, H, 300, 200);
  view = zoomAt(view, bounds, W, H, 4, 300, 200);
  const after = screenToGeo(view, bounds, W, H, 300, 200);
  assert.ok(Math.abs(before.lon - after.lon) < 1e-9 && Math.abs(before.lat - after.lat) < 1e-9, "anchor stays fixed");
  const s = geoToScreen(view, bounds, W, H, after.lon, after.lat);
  assert.ok(Math.abs(s.x - 300) < 1e-6 && Math.abs(s.y - 200) < 1e-6, "round trip");
  assert.ok(view.zoom > 1);
  view = panBy(view, bounds, W, H, 5000, 5000);
  const w = visibleBounds(view, bounds, W, H);
  assert.ok(w.west >= bounds.west - 1e-9 && w.north <= bounds.north + 1e-9, "pan is clamped to the region");
  assert.equal(zoomAt(createView(bounds), bounds, W, H, 1e6).zoom, MAX_ZOOM);
  assert.equal(zoomAt(createView(bounds), bounds, W, H, 1e-6).zoom, 1);
  const fit = fitRect({ west: 10, east: 20, south: 25, north: 30 }, bounds, W, H);
  const fw = visibleBounds(fit, bounds, W, H);
  assert.ok(fw.west <= 10 && fw.east >= 20 && fw.south <= 25 && fw.north >= 30);
  assert.deepEqual(clampView({ lon: 0, lat: 0, zoom: 1 }, bounds, W, H), { lon: 15, lat: 30, zoom: 1 });
});

test("rectangles and paths: cells inside, equal-distance samples, honest distance", () => {
  const rect = { west: 10, east: 14, south: 25, north: 28 };
  const cells = rectCells(grid, rect);
  assert.ok(cells.length > 0);
  for (const c of cells) { const ctr = cellCenter(grid, c.row, c.col); assert.ok(ctr.lon >= 10 && ctr.lon <= 14 && ctr.lat >= 25 && ctr.lat <= 28); }
  assert.ok(Math.abs(distanceKm({ lat: 0, lon: 0 }, { lat: 0, lon: 1 }) - 111.19) < 0.2);
  const path = samplePath([{ lon: -10, lat: 30 }, { lon: 40, lat: 30 }], { stepKm: 500, maxSamples: 160 });
  assert.ok(path.length >= 10);
  const gaps = path.slice(1).map((p, i) => p.distanceKm - path[i].distanceKm);
  assert.ok(Math.max(...gaps) - Math.min(...gaps) < 1e-6, "equal spacing");
  assert.equal(samplePath([{ lon: 0, lat: 20 }]).length, 1);
  assert.deepEqual(samplePath([]), []);
  assert.ok(samplePath([{ lon: -20, lat: 15 }, { lon: 50, lat: 45 }], { maxSamples: 20 }).length <= 20);
});

test("studio copy: both languages, same keys", () => {
  const keys = (o) => Object.keys(o).sort().map((k) => (o[k] && typeof o[k] === "object" && !Array.isArray(o[k]) ? k + "{" + keys(o[k]) + "}" : k)).join();
  assert.equal(keys(studioCopy.en), keys(studioCopy.ar));
  assert.equal(studioCopy.en.help.items.length, studioCopy.ar.help.items.length);
});

import { CHANGE_BASE_HZ, HIGH_HZ, MAX_SCAN_CELLS, PITCH_LOW_HZ, changeSemitones, changeTones, hoverPlan, lonPan, missingTone, scanSteps, sequencePlan, strideFor, valueHz, valueTone } from "../web/studio/mapping.js";
import { HOVER_INTERVAL_MS, confirmationPlan, createStudioAudio } from "../web/studio/audio.js";

test("studio-v1: pitch is the dust value on one fixed log scale, pan is longitude", () => {
  assert.equal(PITCH_LOW_HZ, 220);
  assert.ok(Math.abs(HIGH_HZ - 1760) < 1e-9);
  assert.ok(Math.abs(valueHz(VALUE_MIN) - 220) < 1e-9 && Math.abs(valueHz(VALUE_MAX) - 1760) < 1e-9);
  const hz = [0.005, 0.02, 0.1, 0.4, 1.2, 2].map(valueHz);
  assert.deepEqual([...hz].sort((a, b) => a - b), hz, "higher dust is always higher pitch");
  assert.equal(lonPan(grid, -20), -1);
  assert.equal(lonPan(grid, 50), 1);
  assert.ok(Math.abs(lonPan(grid, 15)) < 1e-12);
  assert.ok(lonPan(grid, 0) < lonPan(grid, 30), "west is left of east");
});

test("studio-v1 is deterministic and uses the shared voice shapes", () => {
  const cell = { row: 12, col: 20, index: 12 * 40 + 20 };
  const a = hoverPlan("dust", cell, snapshots[0].values[cell.index], grid);
  const b = hoverPlan("dust", cell, snapshots[0].values[cell.index], grid);
  assert.deepEqual(a, b);
  assert.equal(a.events.length, 1);
  assert.equal(a.mappingVersion, "studio-v1");
  const tone = a.events[0].tone;
  assert.equal(tone.voice, "tone");
  assert.ok(tone.gain <= 0.22 && tone.durationS >= tone.attackS + tone.releaseS, "valid for transport.js");
  assert.equal(valueTone(0.3, 0).gain, valueTone(2, 0).gain, "gain is constant: pitch carries the value");
});

test("missing values are a distinct soft click, never silence or zero", () => {
  const click = missingTone(0);
  assert.equal(click.voice, "crackle");
  assert.ok(click.gain > 0 && click.durationS < 0.05);
  const plan = hoverPlan("dust", { row: 0, col: 0, index: 0 }, null, grid);
  assert.equal(plan.events[0].tone.voice, "crackle");
  assert.equal(changeTones(null, 0)[0].tone.voice, "crackle");
});

test("change sound: increase rises, decrease falls, near zero is one steady note, wider step = bigger change", () => {
  const up = changeTones(0.6, 0);
  const down = changeTones(-0.6, 0);
  const flat = changeTones(NEAR_ZERO / 2, 0);
  assert.equal(up.length, 2);
  assert.ok(up[1].tone.frequencyHz > up[0].tone.frequencyHz, "rising");
  assert.equal(down.length, 2);
  assert.ok(down[1].tone.frequencyHz < down[0].tone.frequencyHz, "falling");
  assert.equal(flat.length, 1);
  assert.equal(flat[0].tone.frequencyHz, CHANGE_BASE_HZ);
  assert.ok(changeSemitones(1) > changeSemitones(0.05));
  assert.ok(changeSemitones(0.03) >= 1 && changeSemitones(10) <= 12);
  assert.notDeepEqual(up.map((n) => n.tone.frequencyHz), down.map((n) => n.tone.frequencyHz));
});

test("area scan: west to east, rows north to south, bounded cell count, summary of real cells", () => {
  const cells = rectCells(grid, { west: -20, east: 50, south: 15, north: 45 });
  assert.equal(cells.length, 1000);
  assert.equal(strideFor(1000), 2);
  assert.equal(strideFor(MAX_SCAN_CELLS), 1);
  const steps = scanSteps(cells, snapshots[0].values, strideFor(cells.length));
  assert.ok(steps.length <= MAX_SCAN_CELLS && steps.length > 100);
  assert.ok(steps[1].col > steps[0].col && steps[0].row === steps[1].row, "west to east along a row");
  const rowChange = steps.findIndex((s, i) => i > 0 && s.row !== steps[i - 1].row);
  assert.ok(rowChange > 0 && steps[rowChange].row > steps[rowChange - 1].row && steps[rowChange].col < steps[rowChange - 1].col, "next row starts back in the west");
  const plan = sequencePlan("dust", steps, grid, { slotS: 0.07 });
  assert.equal(plan.events.length, steps.length);
  assert.ok(plan.events.every((e, i) => i === 0 || e.onsetS > plan.events[i - 1].onsetS));
  assert.ok(plan.events.every((e) => e.tone.durationS >= e.tone.attackS + e.tone.releaseS));
  const s = summarize(snapshots[0].values, steps);
  assert.equal(s.valid, steps.length);
  assert.ok(s.min <= s.mean && s.mean <= s.max);
});

test("hover audio: not before the explicit enable, deduplicated, throttled, last position wins", async () => {
  let clock = 1000;
  const timers = [];
  const audio = createStudioAudio({ now: () => clock, setTimer: (f, ms) => { timers.push({ f, ms }); return timers.length; }, clearTimer: () => {} });
  const loaded = [];
  audio.transport.load = (plan) => loaded.push(plan.events[0].id + ":" + plan.mode);
  audio.transport.play = async () => {};
  const plan = (n) => () => ({ mode: "hover", events: [{ id: "ev-" + n }] });
  audio.hover("a", plan(1));
  assert.equal(loaded.length, 0, "silent until enabled");
  await audio.enable();
  assert.equal(loaded.at(-1), "ev-0:confirm");
  assert.equal(confirmationPlan().events.length, 1);
  clock += 500;
  audio.hover("a", plan(1));
  assert.equal(loaded.length, 2, "first hover plays at once");
  audio.hover("a", plan(1));
  assert.equal(loaded.length, 2, "same key does not replay");
  clock += 10;
  audio.hover("b", plan(2));
  audio.hover("c", plan(3));
  assert.equal(loaded.length, 2, "throttled");
  assert.equal(timers.length, 1);
  assert.ok(timers[0].ms <= HOVER_INTERVAL_MS && timers[0].ms > 0);
  clock += 100;
  timers[0].f();
  assert.equal(loaded.length, 3);
  assert.equal(loaded.at(-1), "ev-3:hover", "the latest position plays");
  audio.disable();
  audio.hover("z", plan(9));
  assert.equal(loaded.length, 3, "muted after disable");
});
