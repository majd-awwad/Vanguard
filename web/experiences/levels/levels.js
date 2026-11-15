// The five Decode levels: data, grid, objectives and thresholds. Everything is derived from the real package; a level cell is
// an area-weighted aggregation of real cells (see aggregate.js and docs/decode-levels/GRIDS.md).
//
// Thresholds are LEVELS of the sound, not free numbers: the recordings have three levels (low / mid / high, chosen from the
// documented breakpoints in studio/ambience-core.js), so every answer can be decided by ear. Rain below 0.1 mm/h is "none"
// (silence). Ranks: none 0, low 1, mid 2, high 3 (a missing cell is -1 and never matches anything).
import { DOCUMENTED_BREAKPOINTS, levelFor } from "../../studio/ambience-core.js";
import { LEVEL_GRIDS, aggregateValues, aggregateWind } from "./aggregate.js";

export const LEVEL_COUNT = 5;
export const PHENOMENA = Object.freeze(["dust", "rain", "wind"]);
/** Layer name used by the levels -> package phenomenon id. */
export const PACKAGE_ID = Object.freeze({ dust: "dust", rain: "rainfall", wind: "wind" });
export const RANK = Object.freeze({ none: 0, low: 1, mid: 2, high: 3 });
export const RANK_NAMES = Object.freeze(["none", "low", "mid", "high"]);

/** Rank of a real value: -1 missing, 0 none (rain < 0.1 mm/h), 1 low, 2 mid, 3 high. */
export function rankOf(phen, value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return -1;
  const id = PACKAGE_ID[phen];
  const level = levelFor({ phenomenon: id, value, breakpoints: DOCUMENTED_BREAKPOINTS[id] });
  return level === null ? 0 : RANK[level];
}
/** The documented level of a value for the recording ("low" | "mid" | "high"), or null for silence or a missing cell. */
export const levelOf = (phen, value) => { const r = rankOf(phen, value); return r > 0 ? RANK_NAMES[r] : null; };

const o = (id, type, stage, weight, extra = {}) => ({ id, type, stage, weight, ...extra });

export const LEVELS = Object.freeze([
  {
    id: 1, key: "dust-discovery", grid: LEVEL_GRIDS[0], difficulty: "beginner", hints: 3, dates: { main: "2025-03-15" }, phenomena: ["dust"],
    objectives: [
      o("l1-pick", "pick-higher", 1, 25, { phen: "dust" }),
      o("l1-max", "find-max", 1, 30, { phen: "dust" }),
      o("l1-mark", "mark-set", 1, 45, { phen: "dust", where: [{ phen: "dust", atLeast: 3 }] }),
    ],
  },
  {
    id: 2, key: "rainfall-explorer", grid: LEVEL_GRIDS[1], difficulty: "easy", hints: 3, dates: { main: "2025-11-15" }, phenomena: ["rain"],
    objectives: [
      o("l2-pick", "pick-higher", 1, 15, { phen: "rain" }),
      o("l2-any", "mark-set", 1, 30, { phen: "rain", where: [{ phen: "rain", atLeast: 1 }] }),
      o("l2-max", "find-max", 1, 20, { phen: "rain" }),
      o("l2-mid", "mark-set", 2, 35, { phen: "rain", where: [{ phen: "rain", atLeast: 2 }] }),
    ],
  },
  {
    id: 3, key: "wind-investigator", grid: LEVEL_GRIDS[2], difficulty: "medium", hints: 2, dates: { main: "2025-06-15" }, phenomena: ["wind"],
    objectives: [
      o("l3-pick", "pick-higher", 1, 12, { phen: "wind" }),
      o("l3-max", "find-max", 1, 18, { phen: "wind" }),
      o("l3-high", "mark-set", 2, 25, { phen: "wind", where: [{ phen: "wind", atLeast: 3 }] }),
      o("l3-dir", "direction", 2, 20, { phen: "wind", cellFrom: "l3-max" }),
      o("l3-west", "mark-set", 3, 25, { phen: "wind", where: [{ phen: "wind", atLeast: 2 }, { phen: "wind", sector: [225, 315] }] }),
    ],
  },
  {
    id: 4, key: "earth-pattern-detective", grid: LEVEL_GRIDS[3], difficulty: "hard", hints: 2, dates: { main: "2025-05-15" }, phenomena: ["dust", "rain", "wind"],
    objectives: [
      o("l4-dust", "pick-higher", 1, 10, { phen: "dust" }),
      o("l4-rain", "mark-set", 2, 18, { phen: "rain", where: [{ phen: "rain", atLeast: 1 }] }),
      o("l4-wind", "mark-set", 2, 17, { phen: "wind", where: [{ phen: "wind", atLeast: 3 }] }),
      o("l4-both", "mark-set", 3, 20, { phen: "rain", where: [{ phen: "dust", atLeast: 3 }, { phen: "rain", atLeast: 1 }], together: ["dust", "rain"] }),
      o("l4-rainy-wind", "find-max", 3, 15, { phen: "wind", restrictTo: "l4-rain" }),
      o("l4-dusty-wind", "mark-set", 3, 20, { phen: "wind", where: [{ phen: "dust", atLeast: 3 }, { phen: "wind", atLeast: 3 }], together: ["dust", "wind"] }),
    ],
  },
  {
    id: 5, key: "earth-master", grid: LEVEL_GRIDS[4], difficulty: "expert", hints: 1, dates: { from: "2025-04-15", main: "2025-05-15" }, phenomena: ["dust", "rain", "wind"],
    objectives: [
      o("l5-dust-up", "mark-set", 1, 12, { phen: "dust", change: true, where: [{ phen: "dust", rose: true }] }),
      o("l5-dust-down", "mark-set", 1, 10, { phen: "dust", change: true, where: [{ phen: "dust", fell: true }] }),
      o("l5-rain-up", "mark-set", 1, 12, { phen: "rain", change: true, where: [{ phen: "rain", rose: true }] }),
      o("l5-wind-up", "mark-set", 2, 12, { phen: "wind", change: true, where: [{ phen: "wind", rose: true }] }),
      o("l5-max", "find-max", 2, 10, { phen: "wind" }),
      o("l5-dir", "direction", 2, 10, { phen: "wind", cellFrom: "l5-max" }),
      o("l5-both", "mark-set", 3, 16, { phen: "rain", where: [{ phen: "dust", atLeast: 3 }, { phen: "rain", atLeast: 1 }], together: ["dust", "rain"] }),
      o("l5-pick", "pick-higher", 3, 6, { phen: "dust" }),
      o("l5-three", "mark-set", 3, 18, { phen: "wind", where: [{ phen: "dust", atLeast: 2 }, { phen: "rain", atLeast: 1 }, { phen: "wind", atLeast: 2 }], together: ["dust", "rain", "wind"] }),
    ],
  },
]);

/** Points per objective: weights normalised to exactly 100 per level (largest remainder). */
export function objectivePoints(level) {
  const total = level.objectives.reduce((s, x) => s + x.weight, 0);
  const raw = level.objectives.map((x) => (x.weight * 100) / total);
  const points = raw.map(Math.floor);
  let left = 100 - points.reduce((s, x) => s + x, 0);
  raw.map((r, i) => [r - Math.floor(r), i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).forEach(([, i]) => { if (left > 0) { points[i] += 1; left -= 1; } });
  return points;
}

/** The layers of one date on a level grid: { dust, rain, wind (speed), u, v, direction } as plain arrays; ranks are derived in the engine. */
export function layersFor(level, phens, date) {
  const grid = level.grid;
  const out = {};
  if (level.phenomena.includes("dust")) out.dust = aggregateValues(phens.dust.byDate(date).values, grid);
  if (level.phenomena.includes("rain")) out.rain = aggregateValues(phens.rainfall.byDate(date).values, grid);
  if (level.phenomena.includes("wind")) {
    const s = phens.wind.byDate(date);
    const w = aggregateWind(s.measures.uMps, s.measures.vMps, grid);
    out.wind = w.map((x) => x.speed);
    out.windDirection = w.map((x) => x.direction);
  }
  return out;
}

/** Everything a level needs, from the opened package phenomena { dust, rainfall, wind }. Throws if a date is missing or the dates are not comparable. */
export function buildLevelData(level, phens) {
  const dates = Object.values(level.dates);
  const used = level.phenomena.map((p) => phens[PACKAGE_ID[p]]);
  for (const phen of used) for (const date of dates) if (!phen.byDate(date)) throw new Error(`No ${phen.id} snapshot for ${date}.`);
  // One build group for everything the level combines (spec: same date and build group; compare change inside one group).
  const groups = new Set(used.flatMap((phen) => dates.map((date) => phen.groupOf(phen.byDate(date).id))));
  if (groups.size !== 1) throw new Error("The level mixes model build groups.");
  return { levelId: level.id, grid: level.grid, dates: { ...level.dates }, buildGroup: [...groups][0], main: layersFor(level, phens, level.dates.main), from: level.dates.from ? layersFor(level, phens, level.dates.from) : null };
}
