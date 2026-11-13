import { cp, mkdir, copyFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const root = fileURLToPath(new URL("..", import.meta.url));
const destination = resolve(root, "dist");
const manifest = JSON.parse(await readFile(resolve(root, "science/gedi/provenance.json"), "utf8"));
const digest = (bytes) => createHash("sha256").update(bytes).digest("hex");
const sample = await readFile(resolve(root, "science/gedi/sample.json"));
const eic = await readFile(resolve(root, "web/assets/gedi/svs-4950.jpg"));
if (digest(sample) !== "153b9fce2eb38fa62f2db2638f73ab66414871996e7ff101aee2136e03542c56"
    || digest(eic) !== manifest.eic.asset_sha256) {
  throw new Error("GEDI checkpoint data or EIC image failed its integrity check.");
}

await cp(resolve(root, "web"), destination, { recursive: true });
await mkdir(resolve(destination, "assets/gedi"), { recursive: true });
for (const file of ["sample.json", "provenance.json"]) {
  await copyFile(resolve(root, "science/gedi", file), resolve(destination, "assets/gedi", file));
}
console.log("Built dist/ with the verified GEDI case and NASA SVS image.");
