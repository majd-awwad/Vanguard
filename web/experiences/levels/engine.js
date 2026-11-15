// The mission engine for one Decode level: objectives with real checks, scoring, hints and ANSWER SAFETY.
// The level's real values live only inside the closure. What leaves it: cell positions, sound cues (the level a recording would
// play), and, after an objective is completed, the values of the layers that objective used (the reveal). Nothing the player
// can read before the reveal contains a number from the data. Same redaction idea as experiences/decode/session.js, in our own file.
import { LEVELS, PACKAGE_ID, RANK_NAMES, levelOf, objectivePoints, rankOf } from "./levels.js";

export const PASS_F1 = 0.8 - 1e-9;
/** Fair scoring: every objective is answered once and then revealed. A hint costs 10% of its points; a wrong answer pays the floor (40%), or for marks 75% of the F1 score when that is higher; nothing pays less than 40%. */
export const HINT_COST = 0.1;
export const FLOOR = 0.4;
export const WRONG_MARK_SHARE = 0.75;
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

/** Points of one objective: the fraction it earned (1 when right, F1 for marks) minus the cost of hints, never below the floor, whole points. */
export function earnedPoints(points, { fraction = 1, hints = 0 }) {
  const raw = points * fraction - points * HINT_COST * hints;
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
  const state = new Map(level.objectives.map((obj, k) => [obj.id, { done: false, earned: 0, wrong: 0, hints: 0, cell: null, points: points[k] }]));
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
      points: st.points, hintsUsed: st.hints, hintsLeft: Math.max(0, level.hints - st.hints),
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
      if (data.from) { out[phen].from = clean(values(phen, "from")); if (phen === "wind") out[phen].fromDirection = data.from.windDirection.map((d) => (Number.isFinite(d) ? d : null)); }
    }
    return out;
  }

  /**
   * The reveal after one objective: only the cells involved. A cell keeps its data hidden (but still shows its outcome symbol) when it is the
   * SUBJECT of a later objective (a pair to compare, the cell of a wind arrow, the candidates of a restricted search), and a missed cell of a
   * "mark" objective keeps its data hidden while a later objective still works on the same layer. Everything is revealed at the end of the level.
   */
  function buildReveal(obj, index, involved, correct, detail) {
    const later = objectives.slice(index + 1);
    const subjects = new Set();
    const layersLater = new Set();
    for (const next of later) {
      for (const phen of new Set([next.phen, ...(next.where ?? []).map((t) => t.phen)])) layersLater.add(phen);
      if (next.type === "pick-higher") { const p = pairOf(next); subjects.add(p.A); subjects.add(p.B); }
      if (next.type === "direction") subjects.add(directionAnswer(next).cell);
      if (next.type === "find-max" && next.restrictTo) for (const i of truthOf(next.restrictTo)) subjects.add(i);
    }
    const layers = [...new Set([obj.phen, ...(obj.where ?? []).map((t) => t.phen)])];
    const sameLayerLater = layers.some((phen) => layersLater.has(phen));
    const clean = (v) => (Number.isFinite(v) ? v : null);
    const cells = involved.map(({ index: i, outcome }) => {
      const withheld = subjects.has(i) || (obj.type === "mark-set" && outcome === "missed" && sameLayerLater);
      const record = { index: i, row: Math.floor(i / cols), col: i % cols, outcome, withheld };
      if (!withheld) {
        record.layers = layers.map((phen) => ({
          phen, value: clean(values(phen)[i]),
          ...(data.from && obj.change ? { fromValue: clean(values(phen, "from")[i]) } : {}),
          ...(phen === "wind" && Number.isFinite(data.main.windDirection[i]) ? { direction: data.main.windDirection[i] } : {}),
        }));
      }
      return record;
    });
    const value = (i, phen = obj.phen) => { const cell = cells.find((x) => x.index === i); return cell && !cell.withheld ? clean(values(phen)[i]) : null; };
    const feedback = { ...detail, correct, phen: obj.phen, change: Boolean(obj.change), together: obj.together ?? null, anyWithheld: cells.some((x) => x.withheld) };
    if (detail.kind === "pick") { feedback.values = value(detail.higher) !== null && value(detail.lower) !== null ? [value(detail.higher), value(detail.lower)] : null; }
    if (detail.kind === "max") { feedback.value = value(detail.cell); feedback.level = levelOf(obj.phen, values(obj.phen)[detail.cell]); }
    if (detail.kind === "direction") feedback.degrees = Math.round(data.main.windDirection[detail.cell]);
    return { cells, feedback };
  }

  const finish = (obj, fraction, extra = {}) => {
    const st = state.get(obj.id);
    st.done = true;
    st.earned = earnedPoints(st.points, { fraction, hints: st.hints });
    st.wrong = extra.wrong ? 1 : 0;
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
    /**
     * The one answer to the current objective. The objective is then closed (right or wrong) and the cells involved are revealed:
     * { ok (right), completed: true, earned, reveal: { cells: [{ index, row, col, outcome, withheld, layers }], feedback } }.
     */
    submit(answer) {
      const index = currentIndex();
      if (index < 0) return { ok: false, error: "finished" };
      const obj = objectives[index];
      let correct = false;
      let fraction = 1;
      let detail = {};
      let involved = [];
      if (obj.type === "mark-set") {
        const truth = truthOf(obj.id);
        const marked = [...new Set((answer.cells ?? []).filter((i) => Number.isInteger(i) && i >= 0 && i < n))];
        const result = scoreMarks(truth, marked);
        correct = result.pass;
        fraction = result.pass ? result.f1 : Math.max(FLOOR, result.f1 * WRONG_MARK_SHARE);
        detail = { kind: "marks", hits: result.hits, extra: result.extra, missing: result.missing, total: truth.length };
        const t = new Set(truth);
        involved = [...new Set([...marked, ...truth])].sort((x, y) => x - y).map((i) => ({ index: i, outcome: marked.includes(i) ? (t.has(i) ? "correct" : "wrong") : "missed" }));
      } else if (obj.type === "find-max") {
        const truth = truthOf(obj.id);
        correct = truth.includes(answer.cell);
        detail = { kind: "max", cell: answer.cell };
        involved = [{ index: answer.cell, outcome: correct ? "correct" : "wrong" }];
        if (!correct) involved.push({ index: truth[0], outcome: "missed" });
      } else if (obj.type === "pick-higher") {
        const pair = pairOf(obj);
        const picked = pair[answer.pick];
        correct = picked === pair.higher;
        const lower = pair.A === pair.higher ? pair.B : pair.A;
        detail = { kind: "pick", higher: pair.higher, lower };
        involved = correct ? [{ index: pair.higher, outcome: "correct" }, { index: lower, outcome: "none" }] : [{ index: picked, outcome: "wrong" }, { index: pair.higher, outcome: "missed" }];
      } else {
        const truth = directionAnswer(obj);
        correct = answer.option === truth.from;
        detail = { kind: "direction", cell: truth.cell, from: truth.from, chosen: answer.option };
        involved = [{ index: truth.cell, outcome: correct ? "correct" : "wrong" }];
      }
      if (!correct && obj.type !== "mark-set") fraction = FLOOR;
      finish(obj, fraction, { wrong: !correct, cell: obj.type === "find-max" ? answer.cell : undefined });
      const st = state.get(obj.id);
      return { ok: correct, completed: true, earned: st.earned, reveal: buildReveal(obj, index, involved, correct, detail) };
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
    result() {
      const list = objectives.map((obj) => ({ id: obj.id, type: obj.type, points: state.get(obj.id).points, earned: state.get(obj.id).earned, wrong: state.get(obj.id).wrong, hints: state.get(obj.id).hints }));
      return { levelId: level.id, score: score(), objectives: list, wrong: list.reduce((s, x) => s + x.wrong, 0), hints: list.reduce((s, x) => s + x.hints, 0), perfect: score() === 100 };
    },
    /** What a profile stores to resume this level later (no data values). */
    snapshot() {
      return { levelId: level.id, objectives: Object.fromEntries([...state].map(([id, st]) => [id, { done: st.done, earned: st.earned, wrong: st.wrong, hints: st.hints, cell: st.cell }])) };
    },
  };
  if (restore && restore.levelId === level.id) {
    for (const [id, saved] of Object.entries(restore.objectives ?? {})) {
      const st = state.get(id);
      if (st && saved && typeof saved === "object") Object.assign(st, { done: Boolean(saved.done), earned: Number(saved.earned) || 0, wrong: Number(saved.wrong) || 0, hints: Number(saved.hints) || 0, cell: Number.isInteger(saved.cell) ? saved.cell : null });
    }
  }
  return run;
}

export { sameSet as _sameSet, RANK_NAMES };
