import { PHENOMENA } from "./datasets.js";
import { cellInfo } from "./sonify.js";
import { DOCUMENTED_BREAKPOINTS, levelFor } from "./ambience-core.js";

export const ORCHESTRA_IDS = ["rainfall", "wind", "dust"];
export const ORCHESTRA_SECONDS = 12;
export const timeKey = (s) => `${s?.time?.start}|${s?.time?.end}|${s?.time?.kind}`;
const sameBounds = (a, b) => a && b && ["north", "south", "east", "west"].every(k => Number.isFinite(a[k]) && a[k] === b[k]);
const sameCell = (a, b) => a && b && a.row === b.row && a.col === b.col && a.lat === b.lat && a.lon === b.lon && sameBounds(a.bounds, b.bounds);
const knownMethod = (s) => s.metadata?.method?.startsWith("spherical-area-weighted native-footprint overlap mean;");
const AUDITED_BUILDS = new Set(["GEOSadas-5_29_5-p6 experiment_id: f5295_fp", "GEOSadas-5_29_5-p6-SLES15 experiment_id: f5295_fp"]);

function variableValid(id, s, index) {
  const v = s.variables;
  const m = s.measures;
  const near = (a, b) => Number.isFinite(a) && Number.isFinite(b) && Math.abs(a - b) < 1e-7;
  if (id === "dust") return s.metadata.variable === "DUEXTTAU" && s.metadata.unit === "1";
  if (id === "rainfall") return v?.rate?.name === "PRECTOT" && v.rate.unit === "kg m-2 s-1" && v.intervalAccumulation?.unit === "mm" && v.intervalAccumulation.derivedFrom === "PRECTOT * 3600 s" && near(m.rateKgM2S?.[index] * 3600, s.values[index]);
  if (id === "wind") {
    const u = m.uMps?.[index], north = m.vMps?.[index], dir = m.directionFromDegrees?.[index];
    const expected = (Math.atan2(-u, -north) * 180 / Math.PI + 360) % 360;
    return v?.u?.name === "U10M" && v.u.unit === "m s-1" && v.u.positive === "eastward" && v?.v?.name === "V10M" && v.v.unit === "m s-1" && v.v.positive === "northward" && v.speed?.unit === "m s-1" && near(Math.hypot(u, north), s.values[index]) && (dir === null && s.values[index] < 0.3 || Number.isFinite(dir) && Math.min(Math.abs(dir - expected), 360 - Math.abs(dir - expected)) < 1e-7);
  }
  return false;
}

/** The recording level (low / mid / high) for a real value, or null for silence (no measurable rain). Same rule as the Studio. */
export const recordingLevel = (id, value) => levelFor({ phenomenon: id, value, breakpoints: DOCUMENTED_BREAKPOINTS[id] });

/** Strict compatibility, never nearest-time matching or inferred build equivalence.
 * Checks the physical target footprint, exact averaging interval, source provenance,
 * supported aggregation, units and derived values. Catalog groups alone cannot pass it.
 */
export function channelCompatibility({ primary, anchor, candidate, grid, referenceGrid, index, integrity = true, locked = false }) {
  const no = reason => ({ ok: false, reason });
  if (locked) return no("locked");
  if (!candidate || !primary || !anchor) return no("missing");
  if (index === null || index === undefined) return no("missing");
  if (!integrity || !candidate.integrityVerified || !anchor.integrityVerified || !primary.integrityVerified) return no("integrity");
  if (!Number.isInteger(index) || index < 0 || !sameBounds(grid?.bounds, referenceGrid?.bounds) || grid?.orientation !== referenceGrid?.orientation || grid?.rows !== referenceGrid?.rows || grid?.cols !== referenceGrid?.cols || !sameCell(grid?.cells?.[index], referenceGrid?.cells?.[index])) return no("geography");
  const a = anchor.time, b = candidate.time;
  if (!a || !b || !Number.isFinite(Date.parse(b.start)) || Date.parse(b.end) <= Date.parse(b.start) || timeKey(anchor) !== timeKey(candidate) || b.center !== a.center) return no("time");
  const id = candidate.phenomenon;
  if (b.kind !== (id === "dust" ? "three-hour mean" : "one-hour mean") || Date.parse(b.end) - Date.parse(b.start) !== (id === "dust" ? 10800000 : 3600000)) return no("time");
  if (candidate.catalogValidation?.ok === false || anchor.catalogValidation?.ok === false) return no("catalog");
  const source = candidate.source, base = anchor.source;
  if (!AUDITED_BUILDS.has(source?.modelSource) || source.modelSource !== base?.modelSource || source.modelSource !== primary.source?.modelSource || source.version !== "5.29.5" || source.version !== base.version || source.shortName !== PHENOMENA[id]?.short || !source.product?.startsWith("GEOS FP") || !source.granule || !/^[a-f0-9]{64}$/.test(source.sha256 ?? "") || !source.url?.startsWith("https://portal.nccs.nasa.gov/datashare/gmao/geos-fp/") || source.nativeResolutionDegrees?.lat !== base.nativeResolutionDegrees?.lat || source.nativeResolutionDegrees?.lon !== base.nativeResolutionDegrees?.lon) return no("source");
  if (candidate.metadata?.fixture !== false || !knownMethod(candidate) || !knownMethod(anchor) || candidate.metadata?.gridId !== grid.id || !sameBounds(candidate.metadata.bounds, grid.bounds)) return no("quality");
  const value = candidate.values[index];
  if (!Number.isFinite(value)) return no("missing");
  if (value < 0 || !variableValid(id, candidate, index)) return no("variable");
  return { ok: true, reason: null, value, level: recordingLevel(id, value), info: cellInfo(id, candidate, index) };
}

export function defaultChannels() {
  return Object.fromEntries(ORCHESTRA_IDS.map(id => [id, { enabled: true, muted: false, solo: false, gain: 0.7 }]));
}

/** The listening level of one channel: 0 when inactive, muted or left out by another channel's solo. */
export function channelGain(settings, id, observations = null) {
  const usable = (key) => settings[key]?.enabled && (!observations || observations[key]?.ok);
  const soloed = ORCHESTRA_IDS.some(key => usable(key) && settings[key].solo);
  const s = settings[id];
  if (!s || !usable(id) || s.muted || (soloed && !s.solo)) return 0;
  return Math.max(0, Math.min(1, s.gain ?? 1));
}

/** What each channel plays: its recording at the level of its real value, at its listening level. */
export function recordingSpec(observations, settings) {
  return Object.fromEntries(ORCHESTRA_IDS.map(id => {
    const item = observations[id];
    if (!item?.ok || !item.level) return [id, null];
    return [id, { phenomenon: id, level: item.level, gain: channelGain(settings, id, observations), pan: 0 }];
  }));
}

/** One shared clock for play / pause / stop and position. The plan carries markers only (no synthesized tones):
 * each channel's sound is the user's recording for its real value (recordingSpec), played by the Studio's recordings.
 * Twelve listening seconds repeat the selected model mean; they are NOT a time series.
 */
export function orchestraPlan(observations, settings, durationS = ORCHESTRA_SECONDS) {
  const events = [];
  const channels = {};
  for (const id of ORCHESTRA_IDS) {
    const item = observations[id];
    channels[id] = { ...settings[id], enabled: Boolean(item?.ok && settings[id].enabled) };
    if (!item?.ok) continue;
    events.push({ id: `${id}-0`, channelId: id, onsetS: 0, level: item.level ?? null, evidence: { mappingVersion: "recordings-v1", snapshotId: item.snapshot.id, index: item.index, value: item.value, level: item.level ?? null, time: item.snapshot.time, variable: PHENOMENA[id].variable, unit: PHENOMENA[id].unit } });
  }
  events.sort((a, b) => a.onsetS - b.onsetS || a.id.localeCompare(b.id));
  return { caseId: "earthmap", mode: "orchestra", mappingVersion: "recordings-v1", durationS, channels, events };
}
