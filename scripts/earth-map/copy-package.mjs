// Copies Mohammad's verified JSON package (deliverables/EarthPulse-JSON-ONLY, never edited) to
// web/assets/earthpulse-json/ so the web server can serve it, and verifies EVERY file against the sha256 and byte
// count in the master catalog before writing.
//
//   node scripts/earth-map/copy-package.mjs          copy + verify
//   node scripts/earth-map/copy-package.mjs --check  verify the existing copy only (writes nothing)
//
// Current publication policy requires exact UTF-8 LF bytes, with no normalization exemption.
// Source and browser directories are protected from Git line-ending conversion. Older packages
// with the previous integrityPolicy retain their documented CRLF-to-LF verification path.

import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
export const SOURCE = resolve(root, "deliverables/EarthPulse-JSON-ONLY");
export const TARGET = resolve(root, "web/assets/earthpulse-json");
/** Phenomena of the package the app intentionally does not use: never copied, never verified in the copy. */
export const EXCLUDED_PHENOMENA = Object.freeze(["temperature"]);
const excluded = (path) => EXCLUDED_PHENOMENA.some((id) => path.startsWith(id + "/"));

export const toLF = (bytes) => Buffer.from(bytes.toString("latin1").replace(/\r\n/g, "\n"), "latin1");
export const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
export const exactBytePolicy = (master) => master.integrityPolicy?.includes("No newline normalization") === true;

/** Verifies every master-catalog asset under `dir` (the source package in full; the copy without the excluded phenomena); returns { ok, failures[] }. */
export async function verifyDirectory(dir, { skipExcluded = dir !== SOURCE } = {}) {
  const master = JSON.parse((await readFile(resolve(dir, "catalog.json"), "utf8")));
  const failures = [];
  let ok = 0;
  const wanted = master.assets.filter((asset) => !(skipExcluded && excluded(asset.path)));
  for (const asset of wanted) {
    try {
      const raw = await readFile(resolve(dir, asset.path));
      const bytes = exactBytePolicy(master) ? raw : toLF(raw);
      if (sha256(bytes) !== asset.sha256) failures.push(`${asset.path}: sha256 mismatch`);
      else if (bytes.length !== asset.bytes) failures.push(`${asset.path}: byte count ${bytes.length} != ${asset.bytes}`);
      else ok++;
    } catch (error) {
      failures.push(`${asset.path}: ${error.message}`);
    }
  }
  return { ok, total: wanted.length, failures };
}

export async function copyPackage() {
  const source = await verifyDirectory(SOURCE);
  if (source.failures.length) throw new Error("Source package failed verification:\n" + source.failures.join("\n"));
  const master = JSON.parse(await readFile(resolve(SOURCE, "catalog.json"), "utf8"));
  for (const path of ["catalog.json", ...master.assets.map((a) => a.path).filter((p) => !excluded(p))]) {
    const raw = await readFile(resolve(SOURCE, path));
    const bytes = exactBytePolicy(master) ? raw : toLF(raw);
    const target = resolve(TARGET, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
  }
  await writeFile(resolve(TARGET, ".gitattributes"), "# Verified bytes: never convert line endings.\n* -text\n");
  const copy = await verifyDirectory(TARGET);
  if (copy.failures.length) throw new Error("Copy failed verification:\n" + copy.failures.join("\n"));
  return copy;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    const result = process.argv.includes("--check") ? await verifyDirectory(TARGET) : await copyPackage();
    if (result.failures?.length) { console.error(result.failures.join("\n")); process.exit(1); }
    console.log(`earthpulse-json: ${result.ok}/${result.total} files match the master catalog sha256 and byte counts.`);
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
