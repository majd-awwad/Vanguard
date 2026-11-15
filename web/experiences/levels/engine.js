// The mission engine for one Decode level: objectives with real checks, scoring, hints and ANSWER SAFETY.
// The level's real values live only inside the closure. What leaves it: cell positions, sound cues (the level a recording would
// play), and, after an objective is completed, the values of the layers that objective used (the reveal). Nothing the player
// can read before the reveal contains a number from the data. Same redaction idea as experiences/decode/session.js, in our own file.
import { LEVELS, PACKAGE_ID, RANK_NAMES, levelOf, objectivePoints, rankOf } from "./levels.js";

export const PASS_F1 = 0.8 - 1e-9;
/** Fair deductions: a wrong attempt costs 15% of the objective's points, a hint 10%, and an objective never pays less than 40%. */
export const WRONG_COST = 0.15;
export const HINT_COST = 0.1;
export const FLOOR = 0.4;
/** After this many wrong attempts the answer may be shown (the objective then pays the floor). */
export const SHOW_AFTER = 3;
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
export const compassOf = (degrees) => COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];

const sameSet = (a, b) => a.size === b.size && [...a].every((x) => b.has(x));

export function scoreMarks(truth, marked) {
  const t = new Set(truth);
  const m = new Set(marked);
  const hits = [...m].filter((x) => t.has(x)).length;
  const extra = m.size - hits;
  const missing = t.size - hits;
  const precision = m.size === 0 ? (t.size === 0 ? 1 : 0) : hits / m.size;
  const recall = t.size === 0 ? 1 : hits / t.size;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { hits, extra, missing, f1, pass: f1 >= PASS_F1 };
}

/** Points of one objective: pass fraction (F1 for marks) minus deductions, never below the floor, whole points. */
export function earnedPoints(points, { fraction = 1, wrong = 0, hints = 0, shown = false }) {
  if (shown) return Math.round(points * FLOOR);
  const raw = points * fraction - points * WRONG_COST * wrong - points * HINT_COST * hints;
  return Math.max(Math.round(points * FLOOR), Math.round(Math.min(points, raw)));
}

/** `exposeTruth` is for tests only: it adds `_truth(objectiveId)` so a test can play the level; the app never sets it. */
export function createRun({ level: levelOrId, data, restore = null, exposeTruth = false }) {
  const level = typeof levelOrId === "number" ? LEVELS[levelOrId - 1] : levelOrId;
  const { rows, cols } = level.grid;
  const n = rows * cols;
  const cell = (i) => ({ row: Math.floor(i / cols), col: i % cols, index: i });
  const points = objectivePoints(level);
  const at = (which) => (which === "from" ? data.from : data.main);
  const values = (phen, which = "main") => (phen === "wind" ? at(which).wind : at(which)[phen]);
  const rank = (phen, i, which = "main") => rankOf(phen, values(phen, which)[i]);

  // ---- truth (private)
  const holds = (term, i) => {
    if (term.sector) { const d = data.main.windDirection[i]; return d !== null && d !== undefined && d >= term.sector[0] && d <= term.sector[1]; }
    const now = rank(term.phen, i);
    if (term.rose || term.fell) { const before = rank(term.phen, i, "from"); return now >= 0 && before >= 0 && (term.rose ? now > before : now < before); }
    return now >= term.atLeast;
  };
  const markTruth = (obj) => { const out = []; for (let i = 0; i < n; i++) if (obj.where.every((t) => holds(t, i))) out.push(i); return out; };
  const state = new Map(level.objectives.map((obj, k) => [obj.id, { done: false, earned: 0, wrong: 0, hints: 0, shown: false, cell: null, hintLevel: 0, points: points[k] }]));
  const defs = new Map(level.objectives.map((obj) => [obj.id, obj]));
  const truthCache = new Map();
  const truthOf = (id) => {
    if (truthCache.has(id)) return truthCache.get(id);
    const obj = defs.get(id);
    let truth;
    if (obj.type === "mark-set") truth = markTruth(obj);
    else if (obj.type === "find-max") truth = topCells(obj);
    else if (obj.type === "pick-higher") truth = [pairOf(obj).higher];
    else truth = [directionAnswer(obj)];
    truthCache.set(id, truth);
    return truth;
  };
  const candidatesOf = (obj) => {
    if (!obj.restrictTo) return null;
    const base = truthOf(obj.restrictTo);
    return base.length ? base : null;
  };
  function topCells(obj) {
    const pool = candidatesOf(obj) ?? Array.from({ length: n }, (_, i) => i);
    const best = Math.max(...pool.map((i) => rank(obj.phen, i)));
    return pool.filter((i) => rank(obj.phen, i) === best);
  }
  function pairOf(obj) {
    const key = "pair:" + obj.id;
    if (truthCache.has(key)) return truthCache.get(key);
    const valid = Array.from({ length: n }, (_, i) => i).filter((i) => rank(obj.phen, i) >= 0).sort((a, b) => values(obj.phen)[a] - values(obj.phen)[b] || a - b);
    const hi = valid[Math.floor(0.9 * (valid.length - 1))];
    const lower = valid.filter((i) => rank(obj.phen, i) < rank(obj.phen, hi));
    const lo = lower.length ? lower[Math.floor(0.3 * (lower.length - 1))] : valid[0];
    const flip = (level.id + level.objectives.indexOf(obj)) % 2 === 1;
    const pair = { A: flip ? lo : hi, B: flip ? hi : lo, higher: hi };
    truthCache.set(key, pair);
    return pair;
  }
  function directionAnswer(obj) {
    const chosen = state.get(obj.cellFrom)?.cell ?? truthOf(obj.cellFrom)[0];
    const d = data.main.windDirection[chosen];
    return { cell: chosen, from: compassOf(d ?? 0) };
  }
  const arrow = (obj) => { const a = directionAnswer(obj); return { cell: cell(a.cell), toDegrees: (data.main.windDirection[a.cell] + 180) % 360 }; };
  function directionOptions(obj) {
    const a = directionAnswer(obj).from;
    const i = COMPASS.indexOf(a);
    const set = [a, COMPASS[(i + 4) % 8], COMPASS[(i + 2) % 8], COMPASS[(i + 6) % 8]];
    return set.sort((x, y) => COMPASS.indexOf(x) - COMPASS.indexOf(y));
  }

  // ---- redaction-safe views
  const objectives = level.objectives;
  const currentIndex = () => objectives.findIndex((obj) => !state.get(obj.id).done);
  const total = objectives.length;
  const score = () => Math.min(100, objectives.reduce((s, obj) => s + state.get(obj.id).earned, 0));
  const regionOf = (indices) => {
    const r = indices.reduce((s, i) => s + cell(i).row, 0) / indices.length;
    const c = indices.reduce((s, i) => s + cell(i).col, 0) / indices.length;
    return { ns: r < (rows - 1) / 2 ? "north" : "south", ew: c < (cols - 1) / 2 ? "west" : "east" };
  };

  function objectiveView(obj) {
    const st = state.get(obj.id);
    const view = {
      id: obj.id, type: obj.type, stage: obj.stage, phen: obj.phen, change: Boolean(obj.change), together: obj.together ?? null, index: objectives.indexOf(obj), total,
      points: st.points, wrong: st.wrong, hintsUsed: st.hints, hintsLeft: Math.max(0, level.hints - st.hints), canShowAnswer: st.wrong >= SHOW_AFTER,
      candidates: null, pair: null, options: null, arrow: null, restricted: Boolean(obj.restrictTo),
      // The rule itself is not a secret (it is the question); the answer is.
      where: obj.where ?? null, layers: [...new Set([obj.phen, ...(obj.where ?? []).map((t) => t.phen)])],
    };
    if (obj.type === "pick-higher") { const p = pairOf(obj); view.pair = { A: cell(p.A), B: cell(p.B) }; }
    if (obj.type === "find-max") view.candidates = (candidatesOf(obj) ?? null)?.map(cell) ?? null;
    if (obj.type === "direction") { view.options = directionOptions(obj); view.arrow = arrow(obj); }
    return view;
  }

  /** The real values, only once the whole level is finished (the final reveal). Before that: nothing. Each layer is { main, from? } (from only on a two-date level). */
  function revealedLayers() {
    if (currentIndex() >= 0) return {};
    const out = {};
    for (const phen of level.phenomena) {
      const clean = (arr) => arr.map((v) => (Number.isFinite(v) ? v : null));
      out[phen] = { main: clean(values(phen)), direction: phen === "wind" ? data.main.windDirection.map((d) => (Number.isFinite(d) ? d : null)) : undefined };
      if (data.from) out[phen].from = clean(values(phen, "from"));
    }
    return out;
  }

  const finish = (obj, fraction, extra = {}) => {
    const st = state.get(obj.id);
    st.done = true;
    st.earned = earnedPoints(st.points, { fraction, wrong: st.wrong, hints: st.hints, shown: Boolean(extra.shown) });
    st.shown = Boolean(extra.shown);
    if (extra.cell !== undefined) st.cell = extra.cell;
  };

  const run = {
    ...(exposeTruth ? { _truth: (id) => truthOf(id), _pair: (id) => pairOf(defs.get(id)), _direction: (id) => directionAnswer(defs.get(id)) } : {}),
    level,
    get grid() { return level.grid; },
    view() {
      const index = currentIndex();
      return {
        levelId: level.id, grid: level.grid, dates: { ...level.dates }, index: index < 0 ? total : index, total, done: objectives.filter((x) => state.get(x.id).done).length,
        finished: index < 0, score: score(),
        objectives: objectives.map((x) => ({ id: x.id, type: x.type, stage: x.stage, done: state.get(x.id).done, earned: state.get(x.id).earned, points: state.get(x.id).points })),
        current: index < 0 ? null : objectiveView(objectives[index]),
        revealed: revealedLayers(),
      };
    },
    /** What a recording would play for a cell: the sound level (null = silence or a missing cell), the stereo pan (west -1 .. east +1) and the playback rate (south 0.85 .. north 1.25). */
    cue(phen, index, which = "main") {
      const value = values(phen, which)[index];
      const c = cell(index);
      const level0 = levelOf(phen, value);
      const missing = rankOf(phen, value) < 0;
      return { phenomenon: PACKAGE_ID[phen], level: level0, missing, pan: -1 + (2 * (c.col + 0.5)) / cols, rate: 0.85 + 0.4 * (rows > 1 ? 1 - c.row / (rows - 1) : 0.5) };
    },
    submit(answer) {
      const index = currentIndex();
      if (index < 0) return { ok: false, error: "finished" };
      const obj = objectives[index];
      const st = state.get(obj.id);
      if (obj.type === "mark-set") {
        const result = scoreMarks(truthOf(obj.id), answer.cells ?? []);
        if (result.pass) { finish(obj, result.f1); return { ok: true, completed: true, earned: st.earned, ...result, truth: truthOf(obj.id).map(cell) }; }
        st.wrong += 1;
        return { ok: false, completed: false, ...result, canShowAnswer: st.wrong >= SHOW_AFTER };
      }
      let correct = false;
      if (obj.type === "find-max") correct = truthOf(obj.id).includes(answer.cell);
      else if (obj.type === "pick-higher") correct = pairOf(obj)[answer.pick] === pairOf(obj).higher;
      else if (obj.type === "direction") correct = answer.option === directionAnswer(obj).from;
      if (correct) {
        finish(obj, 1, obj.type === "find-max" ? { cell: answer.cell } : {});
        return { ok: true, completed: true, earned: st.earned, truth: truthOf(obj.id).map(cell) };
      }
      st.wrong += 1;
      return { ok: false, completed: false, canShowAnswer: st.wrong >= SHOW_AFTER };
    },
    /** Progressive hint: 1 method, 2 region, 3 one correct cell. Costs points. Returns null when none is left. */
    hint() {
      const index = currentIndex();
      if (index < 0) return null;
      const obj = objectives[index];
      const st = state.get(obj.id);
      if (st.hints >= level.hints) return null;
      st.hints += 1;
      const stage = st.hints;
      const truth = obj.type === "direction" ? [directionAnswer(obj).cell] : truthOf(obj.id);
      const view = { level: stage, type: obj.type, phen: obj.phen };
      if (stage === 2 && truth.length && obj.type !== "pick-higher") view.region = regionOf(truth);
      if (stage >= 3 && truth.length) view.cell = cell(truth[0]);
      if (obj.type === "pick-higher" && stage >= 2) view.higher = truthOf(obj.id)[0] === pairOf(obj).A ? "A" : "B";
      if (obj.type === "direction" && stage >= 2) view.from = directionAnswer(obj).from;
      return view;
    },
    /** After SHOW_AFTER wrong attempts: complete the objective at the floor and return the answer. */
    showAnswer() {
      const index = currentIndex();
      if (index < 0) return null;
      const obj = objectives[index];
      const st = state.get(obj.id);
      if (st.wrong < SHOW_AFTER) return null;
      const truth = truthOf(obj.id);
      finish(obj, 0, { shown: true, cell: obj.type === "find-max" ? truth[0] : null });
      return { truth: truth.map(cell), earned: st.earned };
    },
    result() {
      const list = objectives.map((obj) => ({ id: obj.id, type: obj.type, points: state.get(obj.id).points, earned: state.get(obj.id).earned, wrong: state.get(obj.id).wrong, hints: state.get(obj.id).hints, shown: state.get(obj.id).shown }));
      return { levelId: level.id, score: score(), objectives: list, wrong: list.reduce((s, x) => s + x.wrong, 0), hints: list.reduce((s, x) => s + x.hints, 0), perfect: score() === 100 };
    },
    /** What a profile stores to resume this level later (no data values). */
    snapshot() {
      return { levelId: level.id, objectives: Object.fromEntries([...state].map(([id, st]) => [id, { done: st.done, earned: st.earned, wrong: st.wrong, hints: st.hints, shown: st.shown, cell: st.cell }])) };
    },
  };
  if (restore && restore.levelId === level.id) {
    for (const [id, saved] of Object.entries(restore.objectives ?? {})) {
      const st = state.get(id);
      if (st && saved && typeof saved === "object") Object.assign(st, { done: Boolean(saved.done), earned: Number(saved.earned) || 0, wrong: Number(saved.wrong) || 0, hints: Number(saved.hints) || 0, shown: Boolean(saved.shown), cell: Number.isInteger(saved.cell) ? saved.cell : null });
    }
  }
  return run;
}

export { sameSet as _sameSet, RANK_NAMES };
