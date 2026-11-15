import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { gameCopy } from "../web/cinematic/site/decode-game-copy.js";
import { createEffect, dustParticles, rainDrops, windStreaks, windVector } from "../web/experiences/levels/effects.js";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");
const grid = { rows: 2, cols: 2 };
const cell = (row, col, value, direction) => ({ row, col, value, direction });

test("wind direction: the streak vector follows the real FROM bearing (north-up map, y down)", () => {
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  let v = windVector(0); // wind from the north blows south
  assert.ok(near(v.x, 0) && near(v.y, 1));
  v = windVector(270); // from the west blows east
  assert.ok(near(v.x, 1) && near(v.y, 0));
  v = windVector(90);
  assert.ok(near(v.x, -1));
  v = windVector(180); // from the south blows north
  assert.ok(near(v.y, -1));
  assert.equal(windVector(null), null);
});

test("wind streaks: only where the wind moves, along its real direction, more and longer where it is stronger", () => {
  const field = windStreaks([cell(0, 0, 8, 270), cell(0, 1, 2, 270), cell(1, 0, 5, null), cell(1, 1, null, null)], grid);
  const by = (r, c) => field.streaks.filter((s) => s.row === r && s.col === c);
  assert.equal(by(1, 0).length, 0, "calm: no direction, no streaks");
  assert.equal(by(1, 1).length, 0, "missing: nothing");
  assert.ok(by(0, 0).length > by(0, 1).length, "stronger wind, more streaks");
  assert.ok(by(0, 0)[0].len > by(0, 1)[0].len, "stronger wind, longer streaks");
  assert.ok(by(0, 0).every((s) => Math.abs(s.dx - 1) < 1e-9 && Math.abs(s.dy) < 1e-9), "wind from the west: streaks go east");
});

test("rain shimmer: nothing below 0.1 mm/h, denser where the real rate is higher", () => {
  const field = rainDrops([cell(0, 0, 0.05), cell(0, 1, 0.1), cell(1, 0, 1.5), cell(1, 1, null)], grid);
  const n = (r, c) => field.drops.filter((d) => d.row === r && d.col === c).length;
  assert.equal(n(0, 0), 0, "no measurable rain: no drops");
  assert.equal(n(1, 1), 0);
  assert.ok(n(1, 0) > n(0, 1) && n(0, 1) >= 3);
});

test("dust: the cinematic amber particles are reused, their number per cell follows the real value", () => {
  const bounds = { north: 45, south: 15, west: -20, east: 50 };
  const p = dustParticles([cell(0, 0, 0.02), cell(0, 1, 0.5), cell(1, 0, 0), cell(1, 1, null)], grid, bounds);
  assert.ok(p.count > 0);
  const per = (r, c) => p.perCell.find((x) => x.row === r && x.col === c).particles;
  assert.ok(per(0, 1) > per(0, 0), "more dust, more particles");
  assert.equal(per(1, 0), 0);
  assert.equal(per(1, 1), 0);
  const src = readFile(new URL("../web/experiences/levels/effects.js", import.meta.url), "utf8");
  return src.then((text) => assert.ok(text.includes('from "../../cinematic/particles.js"')));
});

test("reduced motion: the effect never starts (static data colours only); otherwise it runs and can stop", () => {
  const frames = [];
  const canvas = { width: 100, height: 50, clientWidth: 100, clientHeight: 50, getContext: () => ({ clearRect() {}, setTransform() {} }), ownerDocument: { createElement: () => ({ getContext: () => null }) } };
  const still = createEffect(canvas, { grid, reduced: () => true, request: (f) => { frames.push(f); return 1; }, cancel() {} });
  still.set("wind", [cell(0, 0, 5, 90)]);
  assert.equal(still.running, false);
  assert.equal(frames.length, 0);
  const moving = createEffect(canvas, { grid, reduced: () => false, request: (f) => { frames.push(f); return frames.length; }, cancel() {} });
  moving.set("wind", [cell(0, 0, 5, 90)]);
  assert.equal(moving.running, true);
  moving.stop();
  assert.equal(moving.running, false);
  assert.equal(moving.layer, "wind");
});

test("the interface: reveal text in English and Arabic, outcome by colour AND symbol, values only from the reveal", async () => {
  for (const language of ["en", "ar"]) {
    const p = gameCopy[language].play;
    assert.deepEqual(Object.keys(p.sym), ["correct", "wrong", "missed"]);
    assert.deepEqual([p.sym.correct, p.sym.wrong, p.sym.missed], ["✓", "×", "–"]);
    for (const k of ["lead", "pick", "pickValues", "max", "maxWrong", "marksAll", "marks", "direction", "directionWrong", "points", "more"]) assert.ok(p.feedback[k], `${language} ${k}`);
    assert.ok(gameCopy[language].result.reveal.effectNote);
  }
  assert.equal(gameCopy.en.play.feedback.lead.correct, "Correct");
  assert.equal(gameCopy.en.play.feedback.lead.wrong, "Not quite");
  assert.equal(gameCopy.en.play.feedback.pick, "{lead}: {cell} has {more}{values}.");
  assert.equal(gameCopy.en.result.reveal.effectNote, "Visual effect; values are the real data.");
  const ui = await read("web/cinematic/site/decode-game.js");
  assert.ok(ui.includes("st.reveal = { cells: result.reveal.cells"), "the reveal comes from the engine's answer only");
  assert.equal((ui.match(/st\.reveal = \{/g) ?? []).length, 1, "set in one place only");
  assert.ok(!/showAnswer|canShowAnswer/.test(ui));
  assert.ok(ui.includes("el.live.textContent = st.feedback") && ui.includes('role: "status"'), "the feedback and the revealed values are announced");
  assert.ok(ui.includes("showLevelReveal(app, level, run, result, outcome)") && ui.includes("createEffect("), "the level-end reveal with the effect");
  const css = await read("web/cinematic/site/decode-game.css");
  assert.ok(css.includes('data-outcome="correct"') && css.includes('data-outcome="wrong"') && css.includes('data-outcome="missed"') && css.includes("#68e0d0") && css.includes("#ff4fd8") && css.includes("#b9a2ff"));
  assert.ok(css.includes(".dg-sym"), "a symbol, not colour alone");
});
