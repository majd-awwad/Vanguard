import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openPackage } from "../web/studio/datasets.js";
import { channelCompatibility, defaultChannels, orchestraPlan, ORCHESTRA_IDS, recordingLevel, recordingSpec } from "../web/studio/orchestra-data.js";
import { createRecordings } from "../web/studio/recordings.js";
import { orchestraCopy } from "../web/studio/orchestra-copy.js";
import { createTransport } from "../web/audio/transport.js";

const pkg = await openPackage({ baseUrl: new URL("../web/assets/earthpulse-json/", import.meta.url), digest: async bytes => createHash("sha256").update(bytes).digest("hex"), fetchImpl: async url => {
  const b = await readFile(url); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
} });
const phens = Object.fromEntries(await Promise.all(ORCHESTRA_IDS.map(async id => [id, await pkg.openPhenomenon(id)])));
const date = "2025-04-15";
const args = (id, index = 520, anchorId = "wind", day = date) => ({ primary: phens.dust.byDate(day), anchor: phens[anchorId].byDate(day), candidate: phens[id].byDate(day), grid: phens[id].grid, referenceGrid: phens.dust.grid, index });
const observations = (index = 520) => Object.fromEntries(ORCHESTRA_IDS.map(id => [id, { ...channelCompatibility(args(id, index)), snapshot: args(id, index).candidate, index } ]));
const wetIndex = phens.rainfall.byDate(date).values.findIndex(v => v > 0.5);

test("Orchestra: all 13 real dates and 1000 cells support the hourly pair; the dust mean is rejected", () => {
  for (const snap of phens.wind.list) for (let i = 0; i < 1000; i++) {
    for (const id of ORCHESTRA_IDS) {
      const result = channelCompatibility(args(id, i, "wind", snap.date));
      assert.equal(result.ok, id !== "dust", `${snap.date}/${i}/${id}: ${result.reason}`);
    }
  }
});

test("Orchestra: the real three-hour dust frame plays only dust, never fabricates hourly co-observations", () => {
  for (const id of ORCHESTRA_IDS) assert.equal(channelCompatibility(args(id, 520, "dust")).ok, id === "dust");
});

test("Orchestra rejects geographic, temporal, build, unit, quality, missing and integrity mismatches (mutated test data only)", () => {
  const bad = (mutate, reason) => { const a = structuredClone(args("wind")); a.candidate = structuredClone(a.candidate); mutate(a); assert.deepEqual(channelCompatibility(a), { ok: false, reason }); };
  bad(a => a.grid.cells[a.index].lat += 0.01, "geography");
  bad(a => a.grid.cells[a.index].bounds.west += 0.01, "geography");
  bad(a => a.index = -1, "geography");
  bad(a => a.candidate.time.start = "2025-04-15T18:00:00Z", "time");
  bad(a => a.candidate.time.start = "invalid", "time");
  bad(a => a.candidate.time.kind = "instant", "time");
  bad(a => a.candidate.source.modelSource += "other", "source");
  bad(a => a.candidate.source.version = "unknown", "source");
  bad(a => a.candidate.source.sha256 = null, "source");
  bad(a => a.candidate.variables.u.unit = "km h-1", "variable");
  bad(a => a.candidate.measures.vMps[a.index] += 1, "variable");
  bad(a => a.candidate.metadata.fixture = true, "quality");
  bad(a => a.candidate.metadata.method = "unverified", "quality");
  bad(a => a.candidate.values[a.index] = null, "missing");
  bad(a => a.candidate.values[a.index] = NaN, "missing");
  bad(a => a.candidate.integrityVerified = false, "integrity");
  bad(a => a.integrity = false, "integrity");
  bad(a => a.locked = true, "locked");
  bad(a => a.candidate = null, "missing");
  const wind = structuredClone(args("wind")); wind.candidate.measures.uMps[wind.index] += 1;
  assert.equal(channelCompatibility(wind).reason, "variable");
});

test("Orchestra plays the user's recordings at the level of each real value; controls never change evidence", () => {
  const obs = observations(wetIndex), settings = defaultChannels();
  const before = structuredClone(obs);
  const plan = orchestraPlan(obs, settings);
  assert.ok(plan.events.every(e => e.tone === undefined), "no synthesized tones");
  for (const id of ["rainfall", "wind"]) assert.equal(plan.events.find(e => e.channelId === id).level, recordingLevel(id, obs[id].value));
  assert.deepEqual(plan, orchestraPlan(obs, settings));
  const spec = recordingSpec(obs, settings);
  assert.deepEqual(spec.wind, { phenomenon: "wind", level: obs.wind.level, gain: 0.7, pan: 0 });
  assert.equal(spec.rainfall.level, "high", "a real wet cell plays the high rain recording");
  assert.equal(spec.dust, null, "the three-hour dust mean is not part of the hourly window");
  settings.wind.gain = 0.4; assert.equal(recordingSpec(obs, settings).wind.gain, 0.4);
  settings.wind.muted = true; assert.equal(recordingSpec(obs, settings).wind.gain, 0);
  settings.wind.muted = false; settings.rainfall.solo = true;
  assert.equal(recordingSpec(obs, settings).wind.gain, 0);
  assert.equal(recordingSpec(obs, settings).rainfall.gain, 0.7);
  assert.deepEqual(plan.events, orchestraPlan(obs, settings).events);
  assert.deepEqual(obs, before);
  assert.equal(recordingLevel("wind", 1), "low");
  assert.equal(recordingLevel("wind", 3), "mid");
  assert.equal(recordingLevel("wind", 9), "high");
  // A dry hour is silent: no rain recording plays.
  assert.equal(recordingLevel("rainfall", 0.05), null);
  const dry = structuredClone(obs); dry.rainfall.level = null;
  assert.equal(recordingSpec(dry, defaultChannels()).rainfall, null);
});

function harness() {
  const nodes = []; let frame;
  const param = () => ({ value: 0, calls: [], setValueAtTime(...a) { this.calls.push(["set", ...a]); }, linearRampToValueAtTime(...a) { this.calls.push(["ramp", ...a]); }, setTargetAtTime(...a) { this.calls.push(["target", ...a]); }, cancelAndHoldAtTime(...a) { this.calls.push(["hold", ...a]); } });
  const node = type => { const n = { type, connections: [], connect(to) { this.connections.push(to); }, disconnect() { this.disconnected = true; } }; nodes.push(n); return n; };
  const context = { state: "running", currentTime: 0, destination: {}, createGain: () => Object.assign(node("gain"), { gain: param() }), createStereoPanner: () => Object.assign(node("pan"), { pan: param() }), createOscillator: () => Object.assign(node("osc"), { frequency: param(), start(at) { this.startAt = at; }, stop(at) { this.stopAt = at; } }), close() { this.closed = true; } };
  let created = 0;
  const transport = createTransport({ createContext: () => { created++; return context; }, requestFrame: f => { frame = f; return 1; }, cancelFrame: () => { frame = null; } });
  return { transport, context, nodes, get created() { return created; }, advance(t) { context.currentTime = t; frame?.(); } };
}

function recHarness() {
  const nodes = [], fetched = [], timers = [];
  const param = () => ({ value: 1, calls: [], setValueAtTime(v, t) { this.calls.push(["set", v, t]); this.value = v; }, linearRampToValueAtTime(v, t) { this.calls.push(["ramp", v, t]); this.value = v; }, setTargetAtTime(v, t, c) { this.calls.push(["target", v, t, c]); this.value = v; }, cancelScheduledValues() {} });
  const node = (type, extra = {}) => { const n = { type, connections: [], connect(to) { this.connections.push(to); }, disconnect() { this.disconnected = true; }, ...extra }; nodes.push(n); return n; };
  const context = { state: "running", currentTime: 0, destination: {}, createGain: () => node("gain", { gain: param() }), createStereoPanner: () => node("pan", { pan: param() }), createBufferSource: () => node("source", { stops: [], start(at) { this.startAt = at; }, stop(at) { this.stops.push(at); } }), decodeAudioData: async () => ({ duration: 4 }) };
  const rec = createRecordings({ baseUrl: "http://studio.test/assets/ambient/", createContext: () => context, fetchImpl: async url => { fetched.push(String(url).split("/").pop()); return { ok: true, arrayBuffer: async () => new ArrayBuffer(8) }; }, setTimer: f => { timers.push(f); return timers.length; }, clearTimer: () => {}, setTick: () => 1, clearTick: () => {} });
  return { rec, nodes, fetched, flush() { while (timers.length) timers.shift()(); } };
}

test("Orchestra recordings: one loop per channel from the user's files, gain-only control changes, clean stop", async () => {
  const h = recHarness();
  await h.rec.ensemble({ rainfall: { phenomenon: "rainfall", level: "high", gain: 0.7, pan: 0 }, wind: { phenomenon: "wind", level: "mid", gain: 0.7, pan: 0 }, dust: null });
  assert.deepEqual([...h.rec.voices].sort(), ["rainfall:rainfall-high", "wind:wind-mid"]);
  assert.deepEqual([...h.fetched].sort(), ["rain-high.mp3", "wind-mid.mp3"]);
  const sources = h.nodes.filter(n => n.type === "source").length;
  await h.rec.ensemble({ rainfall: { phenomenon: "rainfall", level: "high", gain: 0, pan: 0 }, wind: { phenomenon: "wind", level: "mid", gain: 0.4, pan: 0 } });
  assert.equal(h.nodes.filter(n => n.type === "source").length, sources, "a gain change starts no new recording");
  await h.rec.ensemble({ rainfall: null, wind: { phenomenon: "wind", level: "high", gain: 0.4, pan: 0 } });
  assert.deepEqual(h.rec.voices, ["wind:wind-high"], "a new level crossfades to the matching recording");
  h.rec.ensembleStop(); h.flush();
  assert.deepEqual(h.rec.voices, []);
  assert.ok(h.nodes.filter(n => n.type === "source").every(n => n.stops.includes(undefined)), "every recording source is released");
});

test("Orchestra language dictionaries have full Arabic/English parity", () => {
  const keys = o => Object.entries(o).flatMap(([k, v]) => typeof v === "object" ? keys(v).map(x => `${k}.${x}`) : [k]).sort();
  assert.deepEqual(keys(orchestraCopy.en), keys(orchestraCopy.ar));
});

test("Orchestra transport cancels a pending browser resume before any oscillator can start", async () => {
  const h = harness(); let resume;
  h.context.state = "suspended";
  h.context.resume = () => new Promise(resolve => { resume = () => { h.context.state = "running"; resolve(); }; });
  h.transport.load(orchestraPlan(observations(), defaultChannels()));
  const starting = h.transport.play();
  h.transport.stop(); resume(); await starting;
  assert.equal(h.nodes.some(n => n.frequency), false);
  assert.equal(h.transport.snapshot().positionS, 0);
  assert.equal(h.transport.snapshot().status, "paused");
});
