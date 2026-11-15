// The end-of-level reveal effects (the animated look of the old Decode reveal, drawn on a 2D canvas over the map):
//   dust  -> the amber dust particles and haze of the cinematic reveal (web/cinematic/particles.js: the particle count of every cell follows its real value),
//   rain  -> a soft blue shimmer: faint falling streaks, denser where the real rain rate is higher (nothing where it is below 0.1 mm/h),
//   wind  -> drifting streaks that follow the real U/V direction of every cell, longer and faster where the wind is stronger (nothing where it is calm).
// All of it is a visual effect; the numbers are the real data. With reduced motion nothing animates (the page keeps the static data colours).
import { buildDustParticles } from "../../cinematic/particles.js";

export const EFFECT_NOTE_KEY = "effectNote";
export const MIN_RAIN_MM_H = 0.1;

function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/** Unit vector the wind blows TOWARD on a north-up map (x east, y down), from the meteorological "from" bearing in degrees. Null when calm. */
export function windVector(fromDegrees) {
  if (!Number.isFinite(fromDegrees)) return null;
  const a = (fromDegrees * Math.PI) / 180;
  return { x: -Math.sin(a), y: Math.cos(a) };
}

/**
 * Rain drops in unit map coordinates (0..1, origin top-left): per cell a count that grows with the real value, none below 0.1 mm/h.
 * cells: [{ row, col, value }] on a rows x cols grid.
 */
export function rainDrops(cells, { rows, cols }, { perCell = 46 } = {}) {
  const wet = cells.filter((c) => Number.isFinite(c.value) && c.value >= MIN_RAIN_MM_H);
  const vmax = Math.max(0, ...wet.map((c) => c.value));
  const drops = [];
  for (const cell of wet) {
    const random = seeded((cell.row * 977 + cell.col * 131 + 7) * 2654435761);
    const n = Math.max(3, Math.round((perCell * cell.value) / vmax));
    for (let k = 0; k < n; k++) drops.push({ row: cell.row, col: cell.col, x: random(), y: random(), len: 0.05 + random() * 0.07, speed: 0.35 + random() * 0.5, phase: random() });
  }
  return { drops, rows, cols };
}

/** Wind streaks: per cell a count and a length that grow with the speed, along the real direction; none when calm. cells: [{ row, col, value (speed), direction (from, degrees|null) }]. */
export function windStreaks(cells, { rows, cols }, { perCell = 14 } = {}) {
  const moving = cells.filter((c) => Number.isFinite(c.value) && Number.isFinite(c.direction));
  const vmax = Math.max(0, ...moving.map((c) => c.value));
  const streaks = [];
  for (const cell of moving) {
    const v = windVector(cell.direction);
    const random = seeded((cell.row * 613 + cell.col * 89 + 3) * 2654435761);
    const n = Math.max(2, Math.round((perCell * cell.value) / vmax));
    const strength = cell.value / vmax;
    for (let k = 0; k < n; k++) streaks.push({ row: cell.row, col: cell.col, x: random(), y: random(), dx: v.x, dy: v.y, len: 0.25 + 0.55 * strength, speed: 0.12 + 0.5 * strength, phase: random() });
  }
  return { streaks, rows, cols };
}

/** Dust particles from the cinematic builder, reused as is (count per cell proportional to the real value, normalised to the largest value). */
export function dustParticles(cells, grid, bounds) {
  return buildDustParticles({ phase: "reveal", grid: { rows: grid.rows, cols: grid.cols, cells: cells.map((c) => ({ row: c.row, col: c.col, value: Number.isFinite(c.value) ? c.value : 0 })) } }, bounds);
}

const BOUNDS = { north: 45, south: 15, west: -20, east: 50 };

/**
 * An effect on a canvas. layer: "dust" | "rain" | "wind" | null. `cells` are the revealed cells of that layer.
 * `reduced` (a function) stops all motion: the canvas stays empty and the data colours of the page are the whole picture.
 */
export function createEffect(canvas, { grid, reduced = () => false, now = () => performance.now(), request = (f) => requestAnimationFrame(f), cancel = (id) => cancelAnimationFrame(id) } = {}) {
  let layer = null;
  let cells = [];
  let field = null; // prepared data for the layer
  let sprite = null; // dust: the particles pre-rendered once
  let frame = 0;
  const size = () => ({ w: canvas.clientWidth || canvas.width || 1, h: canvas.clientHeight || canvas.height || 1 });
  function resize() {
    const { w, h } = size();
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(w * dpr)); canvas.height = Math.max(1, Math.round(h * dpr));
    sprite = null;
  }
  function renderDustSprite() {
    const { w, h } = size();
    const off = canvas.ownerDocument.createElement("canvas");
    off.width = canvas.width; off.height = canvas.height;
    const ctx = off.getContext("2d");
    if (!ctx || !field) return null;
    const k = canvas.width / w;
    const sx = (lon) => ((lon - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * canvas.width;
    const sy = (lat) => ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * canvas.height;
    for (let i = 0; i < field.count; i++) {
      const alpha = field.alpha[i];
      const r = field.size[i] * (canvas.width / 0.9) * 0.5 + 0.6 * k;
      const x = sx(field.lonLat[2 * i]), y = sy(field.lonLat[2 * i + 1]);
      if (field.size[i] > 0.015) { const g = ctx.createRadialGradient(x, y, 0, x, y, r * 2); g.addColorStop(0, `rgba(255,203,134,${alpha})`); g.addColorStop(1, "rgba(255,203,134,0)"); ctx.fillStyle = g; ctx.fillRect(x - r * 2, y - r * 2, r * 4, r * 4); }
      else { ctx.fillStyle = `rgba(255,190,110,${Math.min(1, alpha)})`; ctx.fillRect(x, y, Math.max(1, r), Math.max(1, r)); }
    }
    void h;
    return off;
  }
  function draw(t) {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!layer || !field) return;
    const W = canvas.width, H = canvas.height;
    const seconds = t / 1000;
    if (layer === "dust") {
      sprite ??= renderDustSprite();
      if (!sprite) return;
      const drift = reduced() ? 0 : 1;
      for (const [dx, dy, a] of [[0, 0, 0.85], [Math.sin(seconds * 0.35) * 5 * drift, Math.cos(seconds * 0.27) * 3 * drift, 0.45 + 0.1 * Math.sin(seconds * 0.8) * drift]]) { ctx.globalAlpha = a; ctx.drawImage(sprite, dx * (W / 700), dy * (W / 700)); }
      ctx.globalAlpha = 1;
    } else if (layer === "rain") {
      ctx.lineCap = "round";
      for (const d of field.drops) {
        const cw = W / field.cols, ch = H / field.rows;
        const t0 = (d.phase + seconds * d.speed) % 1;
        const y = (d.row + ((d.y + t0) % 1)) * ch, x = (d.col + d.x) * cw;
        const a = 0.18 + 0.35 * Math.sin(Math.PI * t0);
        ctx.strokeStyle = `rgba(150,205,255,${a})`; ctx.lineWidth = Math.max(1, W / 700);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 0.1 * d.len * cw, y + d.len * ch); ctx.stroke();
      }
    } else if (layer === "wind") {
      ctx.lineCap = "round";
      for (const s of field.streaks) {
        const cw = W / field.cols, ch = H / field.rows;
        const t0 = (s.phase + seconds * s.speed) % 1;
        const px = (s.col + ((s.x + s.dx * t0) % 1 + 1) % 1) * cw, py = (s.row + ((s.y + s.dy * t0) % 1 + 1) % 1) * ch;
        const l = s.len * cw * 0.5;
        const a = 0.15 + 0.45 * Math.sin(Math.PI * t0);
        ctx.strokeStyle = `rgba(205,242,236,${a})`; ctx.lineWidth = Math.max(1, W / 600);
        ctx.beginPath(); ctx.moveTo(px - s.dx * l, py - s.dy * l); ctx.lineTo(px, py); ctx.stroke();
      }
    }
  }
  function loop() { draw(now()); frame = request(loop); }
  const api = {
    /** Sets the layer and its revealed cells ({ row, col, value, direction? }) and (re)starts the animation unless motion is reduced. */
    set(nextLayer, nextCells) {
      layer = nextLayer; cells = nextCells; sprite = null;
      if (layer === "dust") field = dustParticles(cells, grid, BOUNDS);
      else if (layer === "rain") field = rainDrops(cells, grid);
      else if (layer === "wind") field = windStreaks(cells, grid);
      else field = null;
      api.stop();
      if (!layer || reduced()) { canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height); return; }
      resize();
      frame = request(loop);
    },
    stop() { if (frame) cancel(frame); frame = 0; },
    resize() { resize(); if (!frame && !reduced()) draw(now()); },
    get running() { return frame !== 0; },
    get layer() { return layer; },
    get field() { return field; },
  };
  return api;
}
