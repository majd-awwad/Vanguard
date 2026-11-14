import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { Vector3 } from "../web/vendor/three/three.module.min.js";
import {
  DEG, cameraMatrices, cellRect, createFrame, ease, fillTriangles, gridLines, projectToNdc, ringTriangles,
  spherePoint, surfacePoint, unroll,
} from "../web/cinematic/geo.js";
import { overlayModel, sanitizeOutcomes } from "../web/cinematic/overlay.js";
import { createGlobeMount } from "../web/cinematic/globe.js";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");
const bytes = (path) => readFileSync(new URL(path, root));
const sha256 = (data) => createHash("sha256").update(data).digest("hex");

const dust = { west: -20, east: 50, south: 15, north: 45 };
const fixture = { west: 0, east: 8, south: 0, north: 6 };
const sizes = [[3, 4], [6, 8]];

test("at full unroll every cell corner lands on the interactive grid rectangle for any canvas aspect", () => {
  for (const bounds of [dust, fixture]) {
    const frame = createFrame(bounds);
    for (const aspect of [0.7, 1, 2.33, 3]) {
      const camera = cameraMatrices(frame, 1, aspect);
      for (const [rows, cols] of sizes) {
        for (let row = 0; row <= rows; row++) {
          for (let col = 0; col <= cols; col++) {
            const lon = bounds.west + (col * (bounds.east - bounds.west)) / cols;
            const lat = bounds.north - (row * (bounds.north - bounds.south)) / rows;
            const ndc = projectToNdc(camera, surfacePoint(frame, lon, lat, 1));
            assert.ok(Math.abs(ndc.x - (-1 + (2 * col) / cols)) < 1e-9, `x at row ${row}, col ${col}`);
            assert.ok(Math.abs(ndc.y - (1 - (2 * row) / rows)) < 1e-9, `y at row ${row}, col ${col}`);
            assert.ok(ndc.z > -1 && ndc.z < 1, "inside the depth range");
          }
        }
      }
    }
  }
});

test("the surface morphs from the unit sphere to the tangent plate carree plane", () => {
  const frame = createFrame(dust);
  for (const [lon, lat] of [[-20, 15], [15, 30], [50, 45], [-120, -30], [170, 70]]) {
    assert.ok(Math.abs(surfacePoint(frame, lon, lat, 0).length() - 1) < 1e-12, "t=0 is on the sphere");
    const flat = surfacePoint(frame, lon, lat, 1);
    const local = flat.clone().sub(frame.normal);
    assert.ok(Math.abs(local.dot(frame.normal)) < 1e-12, "t=1 is on the tangent plane");
    assert.ok(Math.abs(local.dot(frame.east) - (lon - frame.lon0) * DEG) < 1e-12, "x is longitude");
    assert.ok(Math.abs(local.dot(frame.north) - (lat - frame.lat0) * DEG) < 1e-12, "y is latitude");
  }
  const lifted = surfacePoint(frame, frame.lon0, frame.lat0, 1, 0.01);
  assert.ok(Math.abs(lifted.clone().sub(frame.normal).dot(frame.normal) - 0.01) < 1e-12, "lift follows the normal");
});

test("the fly-to starts with the whole globe in view and eases to the unrolled map", () => {
  assert.equal(ease(0), 0);
  assert.equal(ease(1), 1);
  assert.equal(unroll(0), 0);
  assert.equal(unroll(1), 1);
  let previous = -1;
  for (let step = 0; step <= 100; step++) {
    const value = unroll(step / 100);
    assert.ok(value >= previous, "monotone");
    previous = value;
  }
  const frame = createFrame(dust);
  const camera = cameraMatrices(frame, 0, 16 / 9);
  const eye = new Vector3().setFromMatrixPosition(camera.world);
  const toward = eye.clone().normalize();
  let visible = 0;
  for (let lon = -180; lon < 180; lon += 6) {
    for (let lat = -84; lat <= 84; lat += 6) {
      const point = spherePoint(lon, lat);
      if (point.dot(toward) < 1 / eye.length()) continue;
      visible++;
      const ndc = projectToNdc(camera, point);
      assert.ok(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1, `visible globe point ${lon},${lat} is on screen`);
    }
  }
  assert.ok(visible > 100);
});

test("shape builders emit the expected vertex counts and stay on the unrolled plane", () => {
  const frame = createFrame(dust);
  const rects = [cellRect(frame.bounds, 3, 4, 0, 0), cellRect(frame.bounds, 3, 4, 2, 3)];
  assert.equal(rects[0].north, 45);
  assert.equal(rects[0].west, -20);
  assert.equal(rects[1].south, 15);
  assert.equal(rects[1].east, 50);
  const fill = fillTriangles(frame, rects, { t: 1, lift: 0.004, subdiv: 4 });
  assert.equal(fill.positions.length, rects.length * 4 * 4 * 6 * 3);
  assert.equal(fill.uvs.length, rects.length * 4 * 4 * 6 * 2);
  for (let i = 0; i < fill.positions.length; i += 3) {
    const offset = new Vector3(fill.positions[i], fill.positions[i + 1], fill.positions[i + 2]).sub(frame.normal);
    assert.ok(Math.abs(offset.dot(frame.normal) - 0.004) < 1e-6);
  }
  const ring = ringTriangles(frame, rects, { t: 0.5, segments: 6 });
  assert.equal(ring.length, rects.length * 24 * 6 * 3);
  assert.equal(gridLines(frame, 3, 4, { t: 1, segments: 24 }).length, (4 + 5) * 24 * 2 * 3);
  assert.ok([...ring, ...fill.positions].every(Number.isFinite));
  assert.throws(() => createFrame({ west: 10, east: -10, south: 0, north: 1 }), RangeError);
});

test("the overlay model reads only the playhead, the guesses and approved outcomes", () => {
  const grid = { rows: 3, cols: 4, cells: [] };
  const outcomes = [
    { row: 0, col: 2, outcome: "correct" },
    { row: 1, col: 1, outcome: "incorrect" },
    { row: 2, col: 0, outcome: "missed" },
  ];
  const before = overlayModel({ phase: "decode", grid, activeCell: [1, 2], guesses: [[0, 2], [9, 9]] }, outcomes);
  assert.deepEqual(before.active, [1, 2]);
  assert.deepEqual(before.selected, [[0, 2]]);
  assert.deepEqual(before.outcomes, [], "nothing is tinted before Reveal, whatever the caller supplies");
  for (const phase of ["intro", "legend", "listen", "decode"]) {
    assert.deepEqual(overlayModel({ phase, grid, guesses: [] }, outcomes).outcomes, []);
  }
  assert.equal(overlayModel({ phase: "listen", grid, activeCell: null, guesses: [] }).active, null);
  assert.equal(overlayModel({ phase: "listen", grid, activeCell: [3, 0], guesses: [] }).active, null, "out of grid");
  assert.equal(overlayModel({ phase: "listen", grid, activeCell: "ev-3", guesses: [] }).active, null, "never an event id");

  const after = overlayModel({ phase: "reveal", grid, guesses: [[0, 2]] }, outcomes);
  assert.deepEqual(after.outcomes, outcomes);
  assert.deepEqual(sanitizeOutcomes([{ row: 0, col: 0, outcome: "correct" }, { row: 0, col: 0, outcome: "missed" }], 3, 4), []);
  assert.deepEqual(sanitizeOutcomes([{ row: 0, col: 0, outcome: "dusty" }], 3, 4), []);
  assert.deepEqual(sanitizeOutcomes([{ row: 5, col: 0, outcome: "missed" }], 3, 4), []);
  assert.deepEqual(sanitizeOutcomes(null, 3, 4), []);
  // A raw reading in a snapshot cannot reach the model.
  const leaky = overlayModel({ phase: "reveal", grid: { rows: 3, cols: 4, cells: [{ row: 0, col: 0, value: 0.9, status: "measured" }] }, guesses: [] });
  assert.ok(!JSON.stringify(leaky).includes("0.9") && !JSON.stringify(leaky).includes("measured"));
});

test("without WebGL the globe mount hands over to the flat visual and still returns its handle", () => {
  const stage = { dataset: {}, style: { setProperty() {}, removeProperty() {} } };
  const rootElement = { ownerDocument: { defaultView: {} }, parentElement: stage };
  const session = { getState: () => ({}), subscribe: () => () => {} };
  const options = { t: (key) => key };
  const handle = { dispose() {}, prepareReveal: () => null, clearReveal() {} };
  const calls = [];
  const fallback = (...args) => { calls.push(args); return handle; };

  const denied = createGlobeMount({ fallback, createRenderer() { throw new Error("Error creating WebGL context."); } });
  assert.equal(denied(rootElement, session, options), handle);
  assert.equal(stage.dataset.renderer, "svg");
  assert.deepEqual(calls[0], [rootElement, session, options]);

  const absent = createGlobeMount({ fallback, hasWebGL: () => false });
  assert.equal(absent(rootElement, session, options), handle);
  assert.equal(calls.length, 2);
  assert.throws(() => createGlobeMount({}), TypeError);
});

function comments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/([^:])\/\/.*$/gm, "$1");
}

test("the 3D layer never reads readings, statuses, plans or event ids, and loads nothing from the network", () => {
  const files = readdirSync(new URL("web/cinematic/", root)).filter((name) => name.endsWith(".js"));
  assert.ok(files.includes("globe.js") && files.includes("geo.js") && files.includes("overlay.js") && files.includes("main.js"));
  for (const name of files) {
    const code = comments(read(`web/cinematic/${name}`));
    for (const forbidden of [/activeEventId/, /eventCount/, /\bevidence\b/i, /\.events\b/,
      /\.status\b/, /below_threshold/, /\bmeasured\b/, /\bmissing\b/, /\.planRevision\b/, /\btruth\b/, /\.score\b/]) {
      assert.doesNotMatch(code, forbidden, `${name} must not use ${forbidden}`);
    }
    // Only the page wiring in main.js may hand plans to the session; the renderer never builds or reads one.
    if (name !== "main.js") assert.doesNotMatch(code, /\bmakePlan\b|\bheardClass\b|\btransport\b/, `${name} must not touch plans or transport`);
    assert.doesNotMatch(code, /https?:\/\//, `${name} must not reference the network`);
    assert.doesNotMatch(code, /\bfetch\(|XMLHttpRequest|importScripts|\bcdn\b|unpkg|jsdelivr/i, `${name} must work offline`);
  }
  const css = read("web/cinematic/cinematic.css");
  assert.doesNotMatch(css, /https?:\/\/|@import/);
  const html = read("web/decode-3d.html");
  assert.doesNotMatch(html, /https?:\/\//, "the page loads nothing from the network");
  assert.match(html, /\.\/cinematic\/main\.js/);
  assert.match(html, /\.\/cinematic\/cinematic\.css/);
  assert.match(read("web/cinematic/globe.js"), /\.\.\/vendor\/three\/three\.module\.min\.js/);
});

test("the 3D page keeps every element the shared Decode wiring queries and carries the corrected copy", () => {
  const html = read("web/decode-3d.html");
  const source = read("web/decode.js");
  const ids = new Set([...source.matchAll(/byId\("([\w-]+)"\)/g)].map((match) => `decode-${match[1]}`));
  for (const match of source.matchAll(/querySelector\("#([\w-]+)"\)/g)) ids.add(match[1]);
  assert.ok(ids.size > 25);
  for (const id of ids) assert.match(html, new RegExp(`id="${id}"`), `decode-3d.html needs #${id}`);
  assert.match(html, />Turning NASA dust data into sound</);
  assert.doesNotMatch(html + read("web/cinematic/main.js"), /Turned NASA dust data/);
  assert.match(read("web/cinematic/main.js"), /Turning NASA dust data into sound/);
});

function jpegSize(buffer) {
  assert.equal(buffer.readUInt16BE(0), 0xffd8, "JPEG signature");
  let offset = 2;
  while (offset < buffer.length) {
    assert.equal(buffer[offset], 0xff);
    const marker = buffer[offset + 1];
    const length = buffer.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xc3) return { height: buffer.readUInt16BE(offset + 5), width: buffer.readUInt16BE(offset + 7) };
    offset += 2 + length;
  }
  throw new Error("No JPEG frame header");
}

test("Earth textures and three.js are packaged locally, small, and documented with sources and SHA-256", () => {
  const desktop = bytes("web/assets/earth/blue-marble-4096.jpg");
  const mobile = bytes("web/assets/earth/blue-marble-2048.jpg");
  assert.deepEqual(jpegSize(desktop), { width: 4096, height: 2048 });
  assert.deepEqual(jpegSize(mobile), { width: 2048, height: 1024 });
  assert.ok(desktop.length + mobile.length < 8 * 1024 * 1024, "textures stay under 8 MB in total");
  assert.ok(mobile.length < desktop.length);
  const three = bytes("web/vendor/three/three.module.min.js");
  assert.ok(statSync(new URL("web/vendor/three/LICENSE", root)).size > 0);
  assert.match(read("web/vendor/three/LICENSE"), /MIT License/);

  const docs = read("docs/earth-assets.md");
  for (const [name, data] of [["blue-marble-4096.jpg", desktop], ["blue-marble-2048.jpg", mobile], ["three.module.min.js", three]]) {
    assert.ok(docs.includes(name), `${name} is documented`);
    assert.ok(docs.includes(sha256(data)), `${name} SHA-256 matches the documented value`);
  }
  assert.match(docs, /https:\/\/assets\.science\.nasa\.gov\/content\/dam\/science\/esd\/eo\/images\/bmng\/bmng-base\/august\/world\.200408\.3x5400x2700\.jpg/);
  assert.ok(docs.includes("2048023ccc62250c677c0f4b03d4362f997b130eb0154a6cad00aa1b27c390b9"), "source download hash is recorded");
  assert.match(docs, /Reto St[oö]ckli/);
  assert.match(docs, /0\.169\.0/);
  assert.match(docs, /Black Marble/);
});
