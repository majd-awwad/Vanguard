// Decode levels: the 25x40 package grid (1.2 x 1.75 degrees, W -20, E 50, S 15, N 45) is re-binned to a coarser grid by an
// AREA-WEIGHTED MEAN of the package cells each level cell overlaps (fractional overlap, spherical area of the overlap).
// Nothing is invented: a level cell is a documented aggregation of real cells. Any overlapped missing cell makes the level
// cell missing (null). Wind: U and V are averaged first, then speed and direction are derived. See docs/decode-levels/GRIDS.md.

export const SOURCE_GRID = Object.freeze({ rows: 25, cols: 40, north: 45, south: 15, west: -20, east: 50 });
/** Grid per level: cells grow 12, 16, 30, 36, 48. */
export const LEVEL_GRIDS = Object.freeze([
  Object.freeze({ rows: 3, cols: 4 }), Object.freeze({ rows: 4, cols: 4 }), Object.freeze({ rows: 5, cols: 6 }), Object.freeze({ rows: 6, cols: 6 }), Object.freeze({ rows: 6, cols: 8 }),
]);
/** Below this speed the direction is not defined (calm), as in the Studio. */
export const CALM_MPS = 0.3;

const rad = (deg) => (deg * Math.PI) / 180;

/** Overlaps of one level cell with the source cells: [{ row, col, weight }] where weight = spherical area of the overlap (steradian-proportional). */
export function overlaps(level, row, col, source = SOURCE_GRID) {
  const dLat = (source.north - source.south) / source.rows;
  const dLon = (source.east - source.west) / source.cols;
  const cellNorth = source.north - (row * (source.north - source.south)) / level.rows;
  const cellSouth = source.north - ((row + 1) * (source.north - source.south)) / level.rows;
  const cellWest = source.west + (col * (source.east - source.west)) / level.cols;
  const cellEast = source.west + ((col + 1) * (source.east - source.west)) / level.cols;
  const out = [];
  const eps = 1e-9;
  for (let r = 0; r < source.rows; r++) {
    const north = Math.min(cellNorth, source.north - r * dLat);
    const south = Math.max(cellSouth, source.north - (r + 1) * dLat);
    if (north - south <= eps) continue;
    const band = Math.sin(rad(north)) - Math.sin(rad(south));
    for (let c = 0; c < source.cols; c++) {
      const west = Math.max(cellWest, source.west + c * dLon);
      const east = Math.min(cellEast, source.west + (c + 1) * dLon);
      if (east - west <= eps) continue;
      out.push({ row: r, col: c, weight: band * rad(east - west) });
    }
  }
  return out;
}

const finite = (v) => typeof v === "number" && Number.isFinite(v);

/** Area-weighted mean of one 1000-value array on a level grid. Returns an array of rows*cols values (null = missing). */
export function aggregateValues(values, level, source = SOURCE_GRID) {
  if (!Array.isArray(values) && !ArrayBuffer.isView(values)) throw new TypeError("values must be an array");
  if (values.length !== source.rows * source.cols) throw new RangeError("Unexpected number of source values.");
  const out = new Array(level.rows * level.cols);
  for (let row = 0; row < level.rows; row++) {
    for (let col = 0; col < level.cols; col++) {
      let sum = 0;
      let weight = 0;
      let missing = false;
      for (const o of overlaps(level, row, col, source)) {
        const v = values[o.row * source.cols + o.col];
        if (!finite(v)) { missing = true; break; }
        sum += v * o.weight;
        weight += o.weight;
      }
      out[row * level.cols + col] = missing || weight === 0 ? null : sum / weight;
    }
  }
  return out;
}

/** Meteorological direction the wind blows FROM (0 = north, 90 = east), or null when calm. */
export function directionFrom(u, v) {
  if (!finite(u) || !finite(v) || Math.hypot(u, v) < CALM_MPS) return null;
  return (((270 - (Math.atan2(v, u) * 180) / Math.PI) % 360) + 360) % 360;
}

/** Wind on a level grid: U and V are averaged first, then speed and direction are derived (never averaged speeds or directions). */
export function aggregateWind(u, v, level, source = SOURCE_GRID) {
  const mu = aggregateValues(u, level, source);
  const mv = aggregateValues(v, level, source);
  return mu.map((uu, i) => {
    const vv = mv[i];
    if (!finite(uu) || !finite(vv)) return { u: null, v: null, speed: null, direction: null };
    return { u: uu, v: vv, speed: Math.hypot(uu, vv), direction: directionFrom(uu, vv) };
  });
}

/** Geographic bounds of a level cell (row 0 = north, column 0 = west). */
export function levelCellBounds(level, row, col, source = SOURCE_GRID) {
  const dLat = (source.north - source.south) / level.rows;
  const dLon = (source.east - source.west) / level.cols;
  return { north: source.north - row * dLat, south: source.north - (row + 1) * dLat, west: source.west + col * dLon, east: source.west + (col + 1) * dLon };
}
