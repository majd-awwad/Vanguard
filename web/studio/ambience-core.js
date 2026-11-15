// The optional "illustrative ambience" layer: which recording plays, chosen from the REAL value under the cursor.
// Pure functions only (no audio, no DOM). Documented in docs/earth-map/SONIFICATION_MAPPING.md.

/** Phenomena that have a recording. Temperature has none. */
export const AMBIENCE_PHENOMENA = Object.freeze(["dust", "rainfall", "wind"]);
export const LEVELS = Object.freeze(["low", "mid", "high"]);
export const LOW_PERCENTILE = 0.33;
export const HIGH_PERCENTILE = 0.66;

/** The recording for a phenomenon and level (the pack names rainfall "rain"). */
export const fileFor = (phenomenon, level) => `${phenomenon === "rainfall" ? "rain" : phenomenon}-${level}.mp3`;

/** Linear-interpolation percentile of an ascending array (the same definition as numpy's default). */
export function percentile(sorted, p) {
  if (!sorted.length) return Number.NaN;
  const rank = (sorted.length - 1) * p;
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  return sorted[low] + (sorted[high] - sorted[low]) * (rank - low);
}

const valid = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Fixed breakpoints for one phenomenon: the 33rd and 66th percentiles of every valid value across all sampled dates.
 * `snapshotValues` is an array of value arrays (one per date); null and NaN are ignored.
 */
export function breakpoints(snapshotValues) {
  const all = [];
  for (const values of snapshotValues) for (const v of values) if (valid(v)) all.push(v);
  all.sort((a, b) => a - b);
  return { low: percentile(all, LOW_PERCENTILE), high: percentile(all, HIGH_PERCENTILE), count: all.length };
}

/**
 * The level to play for a value, or null for silence: unsupported phenomenon, missing value, or no rain at all.
 * At or below the low breakpoint is "low", at or below the high breakpoint is "mid", above it is "high".
 */
export function levelFor({ phenomenon, value, breakpoints: bp }) {
  if (!AMBIENCE_PHENOMENA.includes(phenomenon)) return null;
  if (!valid(value) || !bp || !valid(bp.low) || !valid(bp.high)) return null;
  if (phenomenon === "rainfall" && value <= 0) return null;
  if (value <= bp.low) return "low";
  if (value <= bp.high) return "mid";
  return "high";
}
