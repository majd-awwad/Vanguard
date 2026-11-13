import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseGediCase } from "../web/data/gedi-case.js";
import { makePlan } from "../web/audio/gedi-plan.js";
import { createTransport } from "../web/audio/transport.js";
import { createSession } from "../web/experiences/invisible-forest/session.js";

const science = new URL("../science/gedi/", import.meta.url);
const json = async (file) => JSON.parse(await readFile(new URL(file, science), "utf8"));
const sample = await json("sample.json");
const provenance = await json("provenance.json");
const data = parseGediCase(sample, provenance);
const selection = { axis: "horizontal", shotId: data.guide.low, bandM: data.guide.band };

function testClock(overrides = {}) {
  let elapsed = 0;
  let callback;
  return {
    advance(seconds) {
      elapsed += seconds;
      const next = callback;
      callback = null;
      next?.();
    },
    transport: createTransport({
      now: () => elapsed,
      requestFrame: (next) => { callback = next; return 1; },
      cancelFrame: () => { callback = null; },
      ...overrides,
    }),
  };
}

test("checkpoints match source manifests and reject manufactured or invalid rows", () => {
  assert.equal(data.footprints.length, 6);
  assert.equal(data.footprints[0].distance, 0);
  assert.equal(data.footprints.at(-1).distance, 286.7077);
  assert.ok(data.footprints.every(({ id }) => typeof id === "string"));
  assert.throws(() => parseGediCase({ ...sample, schema_version: 24 }, provenance), /do not agree/);
  assert.throws(() => parseGediCase(sample, { ...provenance, case_id: "unrelated" }), /do not agree/);
  const broken = structuredClone(sample);
  broken.footprints[0].VERIFIED.flags.quality_flag = 0;
  assert.throws(() => parseGediCase(broken, provenance), /Invalid verified/);
});

test("the browser plans match the Python science reference for both axes", () => {
  const python = process.env.EARTHPULSE_PYTHON ?? "python";
  const script = fileURLToPath(new URL("sonification.py", science));
  const modes = [
    ["horizontal", ["--band", "4", "10"]],
    ...data.footprints.map((row) => ["vertical", ["--shot", row.id]]),
  ];
  for (const [axis, args] of modes) {
    const reference = JSON.parse(execFileSync(python, ["-B", script, axis, ...args], { encoding: "utf8" }));
    const plan = makePlan(data, { ...selection, axis, shotId: axis === "vertical" ? args[1] : selection.shotId });
    assert.equal(plan.mappingVersion, reference.mapping_version);
    assert.deepEqual(plan.events.map((event) => [
      event.evidence.observationId, event.evidence.band, event.onsetS, event.evidence.value,
      event.tone?.gain ?? null, event.evidence.observationStatus,
    ]), reference.events.map((event) => [
      event.shot_number, event.height_band_m, event.onset_s, event.return_fraction, event.peak_linear_gain,
      { positive_residual: "measured", below_processing_threshold: "below_threshold", unavailable: "missing" }[event.status],
    ]));
  }
});

test("guided comparison, live position, step and locked evidence use the same observation", async () => {
  const { transport, advance } = testClock();
  const session = createSession(data, transport);
  const { dispatch, snapshot } = session;
  assert.equal(snapshot().event.evidence.value,
    sample.footprints.find((row) => row.shot_number === data.guide.low).DERIVED.comparison_fraction);
  dispatch({ type: "compare", shotId: data.guide.high });
  assert.equal(snapshot().observation.id, data.guide.high);
  dispatch({ type: "inspect" });
  dispatch({ type: "step", direction: -1 });
  assert.notEqual(snapshot().event.evidence.observationId, snapshot().inspected.observationId);
  await dispatch({ type: "replay", mode: "silent" });
  advance(1);
  assert.equal(snapshot().event.evidence.observationId, data.guide.low);
  dispatch({ type: "axis", axis: "vertical" });
  assert.equal(snapshot().transport.status, "paused");
  assert.equal(snapshot().plan.events.length, 32);
  dispatch({ type: "height", index: 15 });
  assert.deepEqual(snapshot().event.evidence.band, [5, 6]);
  assert.equal(snapshot().event.evidence.observationId, data.guide.low);
});

test("speed changes and pause preserve the playback position", async () => {
  const { transport, advance } = testClock();
  const plan = makePlan(data, selection);
  transport.load(plan);
  await transport.play("silent");
  advance(1);
  transport.setSpeed(2);
  assert.equal(transport.snapshot().positionS, 1);
  advance(1);
  assert.equal(transport.snapshot().positionS, 3);
  transport.pause();
  advance(1);
  assert.equal(transport.snapshot().positionS, 3);
  await transport.replay("silent");
  assert.equal(transport.snapshot().positionS, 0);
  advance(10);
  assert.equal(transport.snapshot().positionS, plan.durationS);
  assert.equal(transport.snapshot().status, "ended");
});

test("stale audio initialization cannot start playback in a replacement plan", async () => {
  let resolveResume;
  const context = {
    state: "suspended",
    createGain: () => ({ gain: { value: 0 }, connect() {} }),
    resume: () => new Promise((resolve) => { resolveResume = resolve; }),
  };
  const { transport } = testClock({ createContext: () => context });
  const plan = makePlan(data, selection);
  transport.load(plan);
  const pending = transport.play();
  transport.load(makePlan(data, { ...selection, axis: "vertical" }));
  resolveResume();
  await pending;
  assert.equal(transport.snapshot().planRevision, 2);
  assert.equal(transport.snapshot().status, "paused");
});

test("audio refusal leaves the same evidence available through silent playback", async () => {
  const { transport, advance } = testClock({ createContext: () => { throw new Error("Audio disabled"); } });
  const plan = makePlan(data, selection);
  transport.load(plan);
  await transport.play();
  assert.equal(transport.snapshot().playback, "silent");
  assert.equal(transport.snapshot().audioUnavailable, true);
  advance(1);
  assert.equal(transport.snapshot().activeEventId, plan.events[1].id);
});
