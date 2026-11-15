import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openPackage } from "../web/studio/datasets.js";
import { channelCompatibility, defaultChannels, ORCHESTRA_IDS, timeKey } from "../web/studio/orchestra-data.js";
import { channelPresentation, chooseListeningWindow, windowIdentity } from "../web/studio/orchestra-state.js";

const pkg = await openPackage({ baseUrl: new URL("../web/assets/earthpulse-json/", import.meta.url), digest: async b => createHash("sha256").update(b).digest("hex"), fetchImpl: async url => {
  const b = await readFile(url); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) };
} });
const phens = Object.fromEntries(await Promise.all(ORCHESTRA_IDS.map(async id => [id, await pkg.openPhenomenon(id)])));
function choices(date, index) {
  return ["dust", "temperature"].map(anchorId => {
    const anchor = phens[anchorId].byDate(date), primary = phens.dust.byDate(date);
    const observations = Object.fromEntries(ORCHESTRA_IDS.map(id => [id, channelCompatibility({ primary, anchor, candidate: phens[id].byDate(date), grid: phens[id].grid, referenceGrid: phens.dust.grid, index })]));
    return { key: timeKey(anchor), observations, compatible: Object.values(observations).filter(o => o.ok).length };
  });
}

test("workspace defaults to the largest scientifically validated group, even on the Dust map", () => {
  const result = chooseListeningWindow(choices("2025-04-15", 214));
  assert.equal(result.selected.compatible, 3);
  assert.match(result.selected.key, /T19:00:00Z/);
});

test("explicit windows persist independently of map/order/date; smaller dust choice is never overridden", () => {
  const apr = choices("2025-04-15", 214), feb = choices("2025-02-15", 222);
  for (const id of [0, 1]) {
    const preference = windowIdentity(apr[id].key);
    assert.equal(chooseListeningWindow([...apr].reverse(), preference).selected.key, apr[id].key);
    assert.equal(chooseListeningWindow(feb, preference).selected.key, feb[id].key);
  }
});

test("an unavailable explicit window remains unavailable with an offered alternative, never silently replaced", () => {
  const apr = choices("2025-04-15", 214), preference = windowIdentity(apr[0].key);
  const missing = chooseListeningWindow([apr[1]], preference);
  assert.equal(missing.selected, null); assert.equal(missing.unavailable, true); assert.equal(missing.alternative, apr[1]);
  // The real upstream January dust publication conflict is unavailable, while the hourly group remains valid.
  const jan = chooseListeningWindow(choices("2025-01-15", 300), preference);
  assert.equal(jan.selected.compatible, 0); assert.equal(jan.unavailable, true); assert.equal(jan.alternative.compatible, 3);
  assert.equal(windowIdentity(jan.selected.key), preference);
  assert.equal(chooseListeningWindow([], preference).alternative, null);
});

test("window identity does not substitute a different hour just because averaging kinds match", () => {
  const c = choices("2025-11-15", 326);
  const otherHour = windowIdentity("2025-11-15T20:00:00Z|2025-11-15T21:00:00Z|one-hour mean");
  assert.equal(chooseListeningWindow(c, otherHour).selected, null);
  assert.equal(windowIdentity("invalid"), null);
});

test("F23, I7 and F15 distinguish three compatible/enabled/sounding layers from paused or master-off output", () => {
  for (const [date, index] of [["2025-02-15", 222], ["2025-11-15", 326], ["2025-04-15", 214]]) {
    const observations = chooseListeningWindow(choices(date, index)).selected.observations;
    const s = channelPresentation(observations, defaultChannels(), { playing: true });
    assert.deepEqual([s.compatible, s.enabled, s.audible], [3, 3, 3]);
    assert.equal(channelPresentation(observations, defaultChannels()).audible, 0);
    assert.equal(channelPresentation(observations, defaultChannels(), { playing: true, outputOn: false }).audible, 0);
  }
});

test("H21 retains its real dry-rain silence; counts respond to gain, activation, mute and inclusive solo", () => {
  const observations = chooseListeningWindow(choices("2025-11-15", 300)).selected.observations;
  const settings = defaultChannels();
  let s = channelPresentation(observations, settings, { playing: true });
  assert.deepEqual([s.compatible, s.enabled, s.audible], [3, 3, 2]);
  assert.equal(s.channels.rainfall.silent, true);
  settings.wind.gain = 0;
  assert.equal(channelPresentation(observations, settings, { playing: true }).audible, 1);
  settings.temperature.muted = true;
  assert.equal(channelPresentation(observations, settings, { playing: true }).audible, 0);
  settings.wind.enabled = false;
  assert.equal(channelPresentation(observations, settings).enabled, 2);
  settings.temperature.muted = false; settings.rainfall.solo = true;
  s = channelPresentation(observations, settings, { playing: true });
  assert.equal(s.audible, 0); assert.equal(s.channels.temperature.excluded, true);
});
