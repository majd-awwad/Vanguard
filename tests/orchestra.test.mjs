import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openPackage } from "../web/studio/datasets.js";
import { channelCompatibility, defaultChannels, orchestraPlan, ORCHESTRA_IDS } from "../web/studio/orchestra-data.js";
import { orchestraCopy } from "../web/studio/orchestra-copy.js";
import { createTransport } from "../web/audio/transport.js";
import { soundParams } from "../web/studio/sonify.js";

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

test("Orchestra uses deterministic existing scientific voices; controls never change evidence or fixed scales", () => {
  const obs = observations(), settings = defaultChannels();
  const before = structuredClone(obs);
  const plan = orchestraPlan(obs, settings);
  assert.ok(plan.events.some(e => e.channelId === "wind"));
  assert.ok(plan.events.every(e => !e.tone.sample && e.channelId !== "dust"));
  assert.deepEqual(plan, orchestraPlan(obs, settings));
  settings.wind.gain = 0; settings.rainfall.solo = true; settings.dust.muted = true;
  assert.deepEqual(plan.events, orchestraPlan(obs, settings).events);
  assert.deepEqual(obs, before);
  const pulses = plan.events.find(e => e.channelId === "wind").tone.pulses;
  const rate = soundParams("wind", obs.wind.info).rate;
  assert.ok(pulses.every((at, i) => Math.abs(at - i / rate) < 1e-9), "fractional rates never reset at second boundaries");
  const changed = structuredClone(obs); changed.wind.info.value += 4;
  assert.notDeepEqual(orchestraPlan(changed, settings).events.find(e => e.channelId === "wind").tone.pulses, plan.events.find(e => e.channelId === "wind").tone.pulses);
  // A real wet cell makes audible rainfall, not a fabricated nonzero minimum.
  const wet = phens.rainfall.byDate(date).values.findIndex(v => v > 0.5);
  const a = args("rainfall", wet); obs.rainfall = { ...channelCompatibility(a), snapshot: a.candidate, index: wet };
  assert.ok(orchestraPlan(obs, settings).events.some(e => e.channelId === "rainfall"));
  obs.rainfall.info.value = 0;
  assert.equal(orchestraPlan(obs, settings).events.some(e => e.channelId === "rainfall"), false);
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

test("Orchestra transport shares a clock, independently ramps buses, preserves pause, and releases nodes", async () => {
  const h = harness(), settings = defaultChannels(), obs = observations(wetIndex);
  h.transport.load(orchestraPlan(obs, settings)); await h.transport.play();
  const osc = h.nodes.filter(n => n.type !== "gain" && n.frequency);
  assert.ok(osc.length > 2);
  assert.ok(osc.filter(n => n.startAt === 0.035).length >= 2, "channels start at one common origin");
  const first = osc.find(n => n.frequency.value === 180);
  const bus = first.connections[0].connections[0].connections[0];
  assert.equal(bus.gain.value, 0.7 / 4);
  const busCount = h.nodes.filter(n => n.type === "gain").length;
  settings.wind.muted = true; h.transport.setChannels(settings);
  assert.deepEqual(bus.gain.calls.at(-1), ["target", 0, 0, 0.012]);
  settings.wind.muted = false; settings.rainfall.solo = true; h.transport.setChannels(settings);
  assert.equal(bus.gain.calls.at(-1)[1], 0);
  settings.rainfall.solo = false; settings.wind.gain = 0.4; h.transport.setChannels(settings);
  assert.equal(bus.gain.calls.at(-1)[1], 0.1);
  assert.equal(h.nodes.filter(n => n.type === "gain").length, busCount, "gain changes create no nodes or clocks");
  h.advance(2); h.transport.pause();
  const position = h.transport.snapshot().positionS; assert.ok(position > 1.9 && position < 2);
  assert.ok(osc.every(n => n.stopAt <= 2.02), "all previous sources stopped with 20 ms fade");
  const count = h.nodes.length;
  await h.transport.play();
  assert.equal(h.created, 1);
  assert.ok(h.nodes.slice(count).some(n => n.frequency?.value === 180), "wind pulses resume after pause");
  h.transport.stop(); assert.equal(h.transport.snapshot().positionS, 0);
  for (const n of h.nodes) n.onended?.();
  assert.ok(h.nodes.filter(n => n.frequency).every(n => n.disconnected));
  h.transport.dispose(); assert.equal(h.context.closed, true);
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
