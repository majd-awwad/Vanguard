import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { openPackage, fetchVerified, validateCatalogEntry } from "../web/studio/datasets.js";
import { channelCompatibility } from "../web/studio/orchestra-data.js";
import { verifyDirectory, SOURCE, TARGET } from "../scripts/earth-map/copy-package.mjs";

const base = new URL("../web/assets/earthpulse-json/", import.meta.url);
const fetchImpl = async url => { const b = await readFile(url); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
const digest = async b => createHash("sha256").update(b).digest("hex");
const pkg = await openPackage({ baseUrl: base, fetchImpl, digest });
const ids = ["dust", "rainfall", "temperature", "wind"];
const phens = Object.fromEntries(await Promise.all(ids.map(async id => [id, await pkg.openPhenomenon(id)])));

test("main integration: all 63 exact-byte assets verify; browser and delivery copies are byte-identical", async () => {
  for (const dir of [SOURCE, TARGET]) assert.deepEqual((await verifyDirectory(dir)).failures, []);
  assert.equal(pkg.integrity.bytePolicy, "exact");
  for (const path of ["catalog.json", ...pkg.master.assets.map(a => a.path)]) {
    assert.deepEqual(await readFile(`${SOURCE}/${path}`), await readFile(new URL(path, base)), path);
  }
});

test("main integration: new compatibility groups and literal builds agree with every scientific snapshot", () => {
  for (const id of ids) {
    const p = phens[id];
    assert.equal(p.catalog.compatibilityGroups.length, 2);
    for (const s of p.list) {
      const groups = p.catalog.compatibilityGroups.filter(g => g.snapshotIds.includes(s.id));
      assert.equal(groups.length, 1);
      assert.equal(groups[0].modelSource, s.source.modelSource);
      assert.equal(p.catalog.snapshots.find(e => e.id === s.id).modelSource, s.source.modelSource);
    }
  }
});

test("main integration: conflicting dust publications are identified and excluded, not silently repaired", () => {
  assert.deepEqual(pkg.integrity.catalogConflicts.map(c => c.id).sort(), ["geos-fp-dust-20241215-1930", "geos-fp-dust-20250115-1930"]);
  for (const snap of phens.dust.list) {
    const expected = snap.catalogValidation.ok;
    const result = channelCompatibility({ primary: snap, anchor: snap, candidate: snap, grid: phens.dust.grid, referenceGrid: phens.dust.grid, index: 520 });
    assert.equal(result.ok, expected, snap.id);
    if (!expected) assert.equal(result.reason, "catalog");
  }
  // A bad dust publication does not suppress a valid hourly listening frame on the same date.
  const date = "2025-01-15", primary = phens.dust.byDate(date), anchor = phens.wind.byDate(date);
  for (const id of ["rainfall", "temperature", "wind"]) assert.equal(channelCompatibility({ primary, anchor, candidate: phens[id].byDate(date), grid: phens[id].grid, referenceGrid: phens.dust.grid, index: 520 }).ok, true);
});

test("main integration: conflicting group/time/source/quality declarations fail validation (mutated test metadata)", () => {
  const p = phens.wind, s = p.byDate("2025-04-15"), entry = p.catalog.snapshots.find(e => e.id === s.id);
  const asset = pkg.assets.get(`wind/${entry.path}`);
  assert.equal(validateCatalogEntry(entry, asset, s, p.catalog.compatibilityGroups, { exactBytes: true }).ok, true);
  for (const mutate of [e => e.modelSource = "other", e => e.bytes++, e => e.sha256 = "other", e => e.time.start = "2025-04-15T18:00:00Z", e => e.sourceSha256 = "other", e => e.extractionStatus = "pending"]) {
    const e = structuredClone(entry); mutate(e);
    assert.equal(validateCatalogEntry(e, asset, s, p.catalog.compatibilityGroups, { exactBytes: true }).ok, false);
  }
  assert.equal(validateCatalogEntry(entry, asset, s, [], { exactBytes: true }).ok, false);
  assert.equal(validateCatalogEntry(entry, asset, s, [...p.catalog.compatibilityGroups, p.catalog.compatibilityGroups.find(g => g.snapshotIds.includes(s.id))], { exactBytes: true }).ok, false);
});

test("main integration: exact-byte integrity rejects CRLF/extra whitespace even when JSON values are unchanged", async () => {
  const asset = pkg.assets.get("dust/grid.json");
  for (const suffix of ["\n", "\r\n"]) {
    const changed = async url => { const b = Buffer.concat([await readFile(url), Buffer.from(suffix)]); return { ok: true, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) }; };
    await assert.rejects(fetchVerified(new URL(asset.path, base), asset, { fetchImpl: changed, digest, exactBytes: true }), /Integrity check failed/);
  }
});
