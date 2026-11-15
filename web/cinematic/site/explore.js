import { drawWaveform } from "../audio-tap.js";
import { DOCUMENTED_BREAKPOINTS, levelFor } from "../../studio/ambience-core.js";
import { DECODE_LOCKED_DATES, PHENOMENA, isLocked, normalizer, openPackage, rampFromStops } from "../../studio/datasets.js";
import { meaningLevel, meaningPhrase } from "../../studio/meaning.js";
import { createRecordings } from "../../studio/recordings.js";
import { dryNotice } from "../../studio/signal-core.js";
import { aggregateValues, aggregateWind } from "../../experiences/levels/aggregate.js";
import { copy as cinematicCopy } from "../copy.js";
import { createScene } from "../scene.js";
import { cellBounds, cellId, cellSize, fillIso, formatLat, formatLon, formatUtcDate, formatUtcTime, textureCrop, trimNumber } from "./cells.js";
import { mountCellGrid } from "./cell-grid.js";
import { h } from "./dom.js";
import { exploreCopy } from "./explore-copy.js";
import { COMPASS_NAMES, exploreData } from "./explore-data-copy.js";
import { mountNav } from "./nav.js";
import { allowSpoilersThisVisit, isDecodeFinished, spoilersUnlocked } from "./progress.js";
import { loadSettings, saveSettings } from "./settings.js";

export const PHENOMENA_ORDER = Object.freeze(["dust", "rainfall", "wind"]);
/** The two grids of the page (as before): Quick 3×4 and Advanced 6×8 over the same region. A cell is the area-weighted mean of the real 25×40 cells it covers. */
export const GRIDS = Object.freeze({ quick: Object.freeze({ rows: 3, cols: 4 }), advanced: Object.freeze({ rows: 6, cols: 8 }) });
const BOUNDS = Object.freeze({ north: 45, south: 15, west: -20, east: 50 });
const TEXTURE = "../assets/earth/blue-marble-4096.jpg";
export const ZOOM_MIN = 1;
export const ZOOM_MAX = 1.35;
const DEFAULT_DATE = { dust: "2025-04-15", rainfall: "2025-08-15", wind: "2025-04-15" };
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Cell record from a snapshot, or undefined. */
export function cellOf(snapshot, row, col) {
  return snapshot.grid.cells.find((cell) => cell.row === row && cell.col === col);
}

export function levelMax(snapshot) {
  return Math.max(0, ...snapshot.grid.cells.map((cell) => (Number.isFinite(cell.value) ? cell.value : 0)));
}

/** Numerical difference and which cell is higher; pure so it can be tested. */
export function compareValues(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { difference: Math.abs(a - b), higher: a === b ? null : a > b ? "a" : "b" };
}

export function startExplore(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "explore", from: "pages" });
  const c = exploreCopy[language];
  const d = exploreData[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("explore-root");
  if (spoilersUnlocked()) return mountExplore(document, root, language);
  root.replaceChildren(h(document, "section", { class: "panel lock", "aria-labelledby": "lock-title" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", { id: "lock-title", text: d.lock.title }),
    h(document, "p", { class: "lede", text: d.lock.text }),
    h(document, "div", { class: "actions" },
      h(document, "a", { class: "button", href: "./decode.html", text: d.lock.decode }),
      (() => { const show = h(document, "button", { type: "button", class: "button ghost", text: c.lock.show }); show.addEventListener("click", () => { allowSpoilersThisVisit(); mountExplore(document, root, language); }); return show; })())));
  return Promise.resolve();
}

async function mountExplore(document, root, language) {
  const c = exploreCopy[language];
  const d = exploreData[language];
  const settings = loadSettings();
  const body = document.body;
  root.replaceChildren(h(document, "p", { class: "status", role: "status", text: c.loading }));

  // The 3D Earth: the same scene the Decode page uses, registered to the HTML grid below.
  let scene = null;
  try {
    scene = createScene({ document });
    scene.setDirection(language === "ar");
    body.prepend(scene.canvas);
    body.classList.add("explore-3d");
    body.dataset.renderer = "webgl";
    body.dataset.flight = "hero";
    scene.onFrame(({ progress, target }) => {
      const flight = progress !== target ? "flying" : target === 1 ? "done" : "hero";
      if (body.dataset.flight !== flight) body.dataset.flight = flight;
    });
    scene.onLost(() => { body.dataset.renderer = "svg"; body.classList.remove("explore-3d"); scene.canvas.remove(); stageFallback(); });
  } catch (error) {
    console.warn("WebGL is unavailable; using the flat map.", error);
    body.dataset.renderer = "svg";
  }

  // The data: Dust, Rainfall and Wind of the verified package (the Studio's loaders).
  const phens = {};
  try {
    const pkg = await openPackage();
    for (const id of PHENOMENA_ORDER) phens[id] = await pkg.openPhenomenon(id);
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: c.retry });
    retry.addEventListener("click", () => location.reload());
    root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: c.error }), retry);
    return;
  }
  // Listening plays the user's recordings, chosen by the real value of the cell.
  const rec = createRecordings({ baseUrl: new URL("../../assets/ambient/", import.meta.url), reduced: () => matchMedia?.("(prefers-reduced-motion: reduce)").matches === true });
  rec.setVolume(settings.volume);

  const finished = isDecodeFinished();
  const wanted = new URL(document.URL).searchParams.get("phen");
  const state = { id: PHENOMENA_ORDER.includes(wanted) ? wanted : "dust", level: "quick", snapshot: null, cells: [], a: null, b: null, active: null, zoom: 1 };
  const phen = () => phens[state.id];
  const spec = () => PHENOMENA[state.id];
  const unit = () => d.phen[state.id].unit;
  const bounds = BOUNDS;
  const firstOpen = (id) => phens[id].list.find((s) => s.date === DEFAULT_DATE[id] && !isLocked(id, s.date, finished)) ?? phens[id].list.find((s) => !isLocked(id, s.date, finished));
  state.snapshot = firstOpen(state.id);

  /** The cells of the current phenomenon, date and grid: area-weighted means of the real data cells. */
  function buildCells() {
    const g = GRIDS[state.level];
    const s = state.snapshot;
    const wind = state.id === "wind" ? aggregateWind(s.measures.uMps, s.measures.vMps, g) : null;
    const values = wind ? wind.map((x) => x.speed) : aggregateValues(s.values, g);
    state.cells = values.map((value, i) => ({ row: Math.floor(i / g.cols), col: i % g.cols, value: Number.isFinite(value) ? value : null, status: Number.isFinite(value) ? "measured" : "missing", direction: wind ? wind[i].direction : undefined }));
  }
  const view = () => ({ level: state.level, grid: { rows: GRIDS[state.level].rows, cols: GRIDS[state.level].cols, cells: state.cells } });
  /** What the globe draws: the dust particles follow the dust values; rain and wind show their colours on the cells instead. */
  const sceneSnapshot = () => ({
    caseId: `${state.id}-${state.snapshot.date}`, level: state.level, phase: "reveal", activeCell: state.active, guesses: [],
    grid: { rows: GRIDS[state.level].rows, cols: GRIDS[state.level].cols, cells: state.cells.map((cell) => ({ ...cell, value: state.id === "dust" && cell.value !== null ? cell.value : 0 })) },
  });
  buildCells();

  const el = {};
  const idOf = ([row, col]) => cellId(row, col);
  const levelOfValue = (v) => levelFor({ phenomenon: state.id, value: Number.isFinite(v) ? v : null, breakpoints: DOCUMENTED_BREAKPOINTS[state.id] });
  const measureLabel = () => d.phen[state.id].measure;
  const fmt = (v) => (Number.isFinite(v) ? trimNumber(v, spec().decimals) : "—");

  // ---- Left column
  const features = h(document, "ul", { class: "xp-features" });
  c.features.forEach(([title, text], index) => features.append(h(document, "li", {}, h(document, "span", { class: "xp-icon", "aria-hidden": "true", text: ["♫", "⌖", "⇄"][index] }), h(document, "div", {}, h(document, "h3", { text: title }), h(document, "p", { text: text })))));
  const levelPicker = h(document, "fieldset", { class: "level-picker" }, h(document, "legend", { text: c.level }));
  for (const level of ["quick", "advanced"]) {
    const input = h(document, "input", { type: "radio", name: "xp-level", id: "xp-level-" + level, value: level, checked: level === state.level });
    input.addEventListener("change", () => { rec.stop(); state.level = level; state.a = state.b = null; state.active = null; buildCells(); buildGrid(); renderAll(); });
    levelPicker.append(h(document, "label", { for: input.id }, input, h(document, "span", { text: c[level] + " " + GRIDS[level].rows + "×" + GRIDS[level].cols })));
  }
  el.dataset = h(document, "section", { class: "panel xp-dataset" });
  el.dod = h(document, "section", { class: "panel xp-dod" });
  const left = h(document, "div", { class: "xp-left" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }),
    h(document, "h1", {}, c.titleLead + " ", h(document, "em", { text: c.titleAccent })),
    h(document, "p", { class: "lede", text: d.lede }), features, el.dataset, el.dod);

  // ---- Centre: the Dust · Rainfall · Wind switch and the date, then the stage registered to the globe
  const tabs = h(document, "div", { class: "seg xp-tabs", role: "group", "aria-label": d.tabs.label });
  const tabButtons = {};
  for (const id of PHENOMENA_ORDER) { const b = h(document, "button", { type: "button", "aria-pressed": id === state.id, "data-phen": id, text: d.tabs[id] }); b.addEventListener("click", () => switchTo(id)); tabButtons[id] = b; tabs.append(b); }
  el.date = h(document, "select", { id: "xp-date", "aria-label": d.date.label });
  el.dry = h(document, "div", { class: "callout xp-dry", role: "status", hidden: true });
  const switchRow = h(document, "div", { class: "xp-switch" }, tabs, el.date);
  el.stage = h(document, "div", { class: "xp-stage", dir: "ltr" });
  el.grid = h(document, "div", { class: "xp-grid" });
  el.stage.append(el.grid);
  const crop = textureCrop(bounds);
  el.stage.style.aspectRatio = String(crop.aspect);
  function stageFallback() {
    el.stage.dataset.renderer = "svg";
    el.stage.style.backgroundImage = `url("${TEXTURE}")`;
    el.stage.style.backgroundSize = `${crop.sizeX}% ${crop.sizeY}%`;
    el.stage.style.backgroundPosition = `${crop.posX}% ${crop.posY}%`;
    el.note.hidden = false;
  }
  el.note = h(document, "p", { class: "small xp-fallback", role: "note", hidden: true, text: c.map.fallback });
  el.caption = h(document, "p", { class: "small xp-particles", text: cinematicCopy[language].caption.dust });
  const zoomIn = h(document, "button", { type: "button", class: "xp-tool", "aria-label": c.map.zoomIn, text: "+" });
  const zoomOut = h(document, "button", { type: "button", class: "xp-tool", "aria-label": c.map.zoomOut, text: "−" });
  const reset = h(document, "button", { type: "button", class: "xp-tool", "aria-label": c.map.reset, text: "⟲" });
  const setZoom = (value) => { state.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)); el.stage.style.transform = `scale(${state.zoom})`; scene?.canvas && scene.setStage(el.stage); };
  zoomIn.addEventListener("click", () => setZoom(state.zoom + 0.15));
  zoomOut.addEventListener("click", () => setZoom(state.zoom - 0.15));
  reset.addEventListener("click", () => setZoom(1));
  const compass = h(document, "div", { class: "xp-compass", role: "img", "aria-label": c.map.compass }, h(document, "span", { "aria-hidden": "true", text: c.map.north }), h(document, "span", { class: "needle", "aria-hidden": "true", text: "↑" }));
  const centre = h(document, "section", { class: "xp-centre", "aria-label": c.title },
    switchRow, el.dry,
    h(document, "div", { class: "xp-stage-box" }, el.stage, h(document, "div", { class: "xp-tools", dir: "ltr" }, zoomIn, zoomOut, reset), compass),
    h(document, "p", { class: "small", id: "xp-help", text: c.map.help }), el.note, el.caption,
    h(document, "div", { class: "xp-scale panel" }, h(document, "h3", { id: "xp-scale-title" }), (el.scale = h(document, "div", {}))));

  function describe(row, col) {
    const b = cellBounds(bounds, GRIDS[state.level], row, col);
    return c.map.cell.replace("{id}", cellId(row, col)).replace("{lat}", formatLat(b.north) + " – " + formatLat(b.south)).replace("{lon}", formatLon(b.west) + " – " + formatLon(b.east));
  }
  let gridApi;
  let ramp = null;
  let norm = null;
  /** The cell colours: the phenomenon's own scale, softly, so the globe stays visible under them. */
  function paintCells() {
    const snap = view();
    snap.grid.cells.forEach((cell) => {
      const button = gridApi.buttons[cell.row][cell.col];
      if (!Number.isFinite(cell.value) || (state.id === "rainfall" && cell.value < 0.1)) { button.style.background = ""; return; }
      const t = Math.round(norm(cell.value) * 255);
      button.style.background = `rgb(${ramp[t * 4]} ${ramp[t * 4 + 1]} ${ramp[t * 4 + 2]} / .38)`;
    });
  }
  function buildGrid() {
    const snap = view();
    gridApi = mountCellGrid(document, el.grid, { rows: snap.grid.rows, cols: snap.grid.cols, label: c.map.label, describe, onChoose: choose, helpId: "xp-help" });
    gridApi.setSelected(state);
    paintCells();
  }

  // ---- Right column
  el.selected = h(document, "section", { class: "panel", "aria-labelledby": "xp-sel-title" });
  el.listen = h(document, "section", { class: "panel", "aria-labelledby": "xp-listen-title" });
  el.compare = h(document, "section", { class: "panel", "aria-labelledby": "xp-compare-title" });
  el.selected.className = "xp-part";
  el.listen.className = "xp-part";
  el.compare.className = "xp-compare-body";
  const drawerClose = h(document, "button", { type: "button", class: "icon-btn", "aria-label": c.compare.title + " ×", text: "×" });
  const drawer = h(document, "aside", { class: "xp-drawer", id: "xp-compare-drawer", hidden: true, "aria-label": c.compare.title }, h(document, "div", { class: "xp-drawer-head" }, drawerClose), el.compare);
  const openCompare = h(document, "button", { type: "button", class: "button ghost", "aria-expanded": "false", "aria-controls": "xp-compare-drawer", text: c.compare.title });
  const setDrawer = (open, focus = false) => { drawer.hidden = !open; openCompare.setAttribute("aria-expanded", String(open)); if (open) drawerClose.focus(); else if (focus) openCompare.focus(); };
  openCompare.addEventListener("click", () => setDrawer(drawer.hidden));
  drawerClose.addEventListener("click", () => setDrawer(false, true));
  drawer.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); setDrawer(false, true); } });
  const right = h(document, "div", { class: "xp-right" }, h(document, "section", { class: "panel xp-card" }, el.selected, el.listen, openCompare), drawer);
  const cta = h(document, "section", { class: "xp-cta", "aria-label": d.cta.button }, h(document, "p", { text: d.cta.text }), h(document, "a", { class: "button", href: "./decode.html", text: d.cta.button }));

  root.replaceChildren(h(document, "div", { class: "xp-layout" }, left, centre, right), cta, h(document, "p", { class: "credit", text: c.credit }));
  if (!scene) stageFallback(); else { scene.setStage(el.stage); scene.setGeography({ caseId: "explore", bounds: { ...bounds }, projection: "plate-carree" }); }

  // ---- Listen panel (built once; state text updates on playback)
  el.state = h(document, "span", { class: "player-state", role: "status" });
  el.cellLabel = h(document, "span", { class: "player-cell" });
  const play = h(document, "button", { type: "button", class: "button", text: c.listen.play });
  const stop = h(document, "button", { type: "button", class: "button ghost", text: c.listen.stop });
  el.volume = h(document, "input", { type: "range", min: 0, max: 100, step: 1, id: "xp-volume", value: Math.round(settings.volume * 100) });
  el.wave = h(document, "canvas", { width: 480, height: 80, role: "img", "aria-label": c.listen.wave });
  el.caption2 = h(document, "p", { class: "captions", role: "status", "aria-live": "polite" });
  el.caption2.classList.toggle("visually-hidden", !settings.captions);
  el.listenNote = h(document, "p", { class: "small" });
  el.listen.append(h(document, "h2", { id: "xp-listen-title", text: c.listen.title }), h(document, "div", { class: "player-line" }, el.cellLabel, el.state),
    h(document, "div", { class: "player-buttons" }, play, stop), h(document, "label", { class: "volume", for: "xp-volume" }, h(document, "span", { text: c.listen.volume }), el.volume), el.wave, el.listenNote, el.caption2);
  play.addEventListener("click", () => { if (!state.a) { el.caption2.textContent = c.listen.needCell; return; } hearCell(state.a[0], state.a[1]); el.caption2.textContent = fillIso(c.captions.playing, { id: idOf(state.a) }, language); });
  stop.addEventListener("click", () => { rec.stop(); clearTimeout(second); setActive(null); el.state.textContent = c.listen.states.paused; el.caption2.textContent = c.captions.stopped; });
  el.volume.addEventListener("input", () => { const value = Number(el.volume.value) / 100; rec.setVolume(value); saveSettings({ volume: value }); });
  const panOfCell = (row, col) => { const b = cellBounds(bounds, GRIDS[state.level], row, col); const lon = (b.west + b.east) / 2; return Math.max(-1, Math.min(1, (2 * (lon - bounds.west)) / (bounds.east - bounds.west) - 1)); };
  let second = 0;
  let activeTimer = 0;
  /** The ring on the globe follows what is playing. */
  function setActive(cell, seconds = 1.8) {
    clearTimeout(activeTimer);
    state.active = cell;
    scene?.setSnapshot(sceneSnapshot());
    if (cell) activeTimer = setTimeout(() => { state.active = null; scene?.setSnapshot(sceneSnapshot()); }, seconds * 1000);
  }
  function hearCell(row, col, seconds = 1.8) {
    const value = cellOf(view(), row, col)?.value;
    const level = levelOfValue(value);
    rec.unlock().then(() => rec.preview(phen().id, level, panOfCell(row, col), seconds)).catch(() => {});
    setActive([row, col], seconds);
    el.state.textContent = level ? c.listen.states.playing : c.listen.states.idle;
    return level;
  }
  el.listenLabel = h(document, "small", { class: "st-sound-note", text: language === "ar" ? "الأصوات تسجيلات تُختار بالقيمة الحقيقية: منخفض / متوسط / مرتفع. المستوى يتبع البيانات؛ أما التسجيلات نفسها فتوضيحية." : "Sounds are recordings chosen by the real value: low / mid / high. The level follows the data; the recordings themselves are illustrative." });
  el.listen.append(el.listenLabel);

  function choose(row, col) {
    state.a = [row, col];
    if (state.b && state.b[0] === row && state.b[1] === col) state.b = null;
    hearCell(row, col);
    el.caption2.textContent = fillIso(c.captions.playing, { id: idOf(state.a) }, language);
    gridApi.setSelected(state);
    gridApi.focusCell(row, col);
    renderPanels();
  }

  // ---- The phenomenon and the date
  function renderDates() {
    el.date.replaceChildren();
    for (const s of phen().list) {
      const lock = isLocked(state.id, s.date, finished);
      el.date.append(h(document, "option", { value: s.id, disabled: lock, selected: s.id === state.snapshot.id, text: formatUtcDate(s.time.start, language) + (lock ? " — " + d.date.locked : "") }));
    }
  }
  function renderDry() {
    const notice = dryNotice({ phenomenon: state.id, list: phen().list, currentId: state.snapshot.id, exclude: finished ? [] : state.id === "dust" ? DECODE_LOCKED_DATES : [] });
    el.dry.hidden = !notice;
    if (!notice) return;
    const words = d.dry[state.id];
    const buttons = notice.suggestions.map((s) => { const b = h(document, "button", { type: "button", class: "button ghost small-button", text: fillIso(words.pick, { date: formatUtcDate(phen().snapshot(s.id).time.start, language), n: Math.round(s.share * 100) }, language) }); b.addEventListener("click", () => setDate(s.id)); return b; });
    el.dry.replaceChildren(h(document, "p", { text: words.notice }), h(document, "div", { class: "actions" }, ...buttons));
  }
  function renderLeft() {
    const s = state.snapshot;
    const p = d.phen[state.id];
    el.dataset.replaceChildren(h(document, "h2", { text: c.dataset.title }),
      h(document, "dl", { class: "kv" },
        h(document, "dt", { text: "NASA" }), h(document, "dd", { class: "ltr", text: d.dataset.source }),
        h(document, "dt", { text: "⌖" }), h(document, "dd", { text: d.dataset.region }),
        h(document, "dt", { text: "◷" }), h(document, "dd", { text: fillIso(d.dataset.date, { date: formatUtcDate(s.time.start, language), from: formatUtcTime(s.time.start).replace(" UTC", ""), to: formatUtcTime(s.time.end) }, language) }),
        h(document, "dt", { text: "▦" }), h(document, "dd", { class: "ltr", text: fillIso(d.dataset.coverage, { south: formatLat(bounds.south), north: formatLat(bounds.north), west: formatLon(bounds.west), east: formatLon(bounds.east) }, language) }),
        h(document, "dt", { text: "◌" }), h(document, "dd", { text: p.variable })), levelPicker, h(document, "p", { class: "small", text: d.dataset.note }));
    el.dod.replaceChildren(h(document, "h2", { text: p.name }), h(document, "p", { text: p.what }), h(document, "p", { class: "callout", text: p.highLow }));
    el.caption.hidden = state.id !== "dust";
    el.caption.textContent = d.particles;
  }
  function renderScale() {
    const s = spec();
    const stops = s.stops.map(([t, rgb]) => `rgb(${rgb.join(",")}) ${(t * 100).toFixed(1)}%`).join(",");
    document.getElementById("xp-scale-title").textContent = fillIso(d.scale.title, { measure: measureLabel(), unit: unit() }, language);
    el.scale.replaceChildren(h(document, "div", { class: "scale-bar", style: `background:linear-gradient(90deg,${stops})`, "aria-hidden": "true" }),
      h(document, "div", { class: "scale-labels ltr", "aria-hidden": "true" }, h(document, "span", { text: String(s.min) }), ...s.ticks.map((v) => h(document, "span", { text: String(v) })), h(document, "span", { text: String(s.max) })),
      h(document, "p", { class: "small", text: d.scale.note }));
  }
  function setDate(id) { state.snapshot = phen().snapshot(id); state.a = state.b = null; state.active = null; buildCells(); buildGrid(); renderAll(); }
  el.date.addEventListener("change", () => setDate(el.date.value));
  function switchTo(id) {
    if (id === state.id) return;
    rec.stop(); clearTimeout(second);
    state.id = id; state.snapshot = firstOpen(id); state.a = state.b = null; state.active = null;
    for (const [key, b] of Object.entries(tabButtons)) b.setAttribute("aria-pressed", String(key === id));
    buildCells(); buildGrid(); renderAll();
  }

  // ---- Panels that depend on the selection
  function badge(value) {
    const level = meaningLevel({ phenomenon: state.id, value: Number.isFinite(value) ? value : null });
    return h(document, "span", { class: "xp-badge", dir: "auto", "data-level": level, text: meaningPhrase({ phenomenon: state.id, value: Number.isFinite(value) ? value : null, language }) });
  }
  function renderPanels() {
    const snap = view();
    // Selected cell
    const parts = [h(document, "h2", { id: "xp-sel-title", text: c.selected.title })];
    if (!state.a) parts.push(h(document, "p", { text: c.selected.none }));
    else {
      const [row, col] = state.a;
      const record = cellOf(snap, row, col);
      const b = cellBounds(bounds, GRIDS[snap.level], row, col);
      const size = cellSize(bounds, GRIDS[snap.level]);
      const level = levelOfValue(record?.value);
      const dir = record?.direction;
      parts.push(
        h(document, "div", { class: "xp-cell-head" }, h(document, "span", { class: "xp-cell-id", text: idOf(state.a) }), badge(record?.value)),
        h(document, "dl", { class: "kv" },
          h(document, "dt", { text: measureLabel() }), h(document, "dd", { class: "ltr" }, Number.isFinite(record?.value) ? [h(document, "span", { class: "xp-value", text: fmt(record.value) }), h(document, "span", { class: "small", text: " " + unit() })] : h(document, "span", { text: c.selected.missing })),
          h(document, "dt", { text: c.selected.cellSize }), h(document, "dd", { class: "ltr", text: c.selected.size.replace("{lat}", trimNumber(size.lat)).replace("{lon}", trimNumber(size.lon)) }),
          h(document, "dt", { text: "⌖" }), h(document, "dd", { class: "ltr", text: fillIso(c.selected.bounds, { south: formatLat(b.south), north: formatLat(b.north), west: formatLon(b.west), east: formatLon(b.east) }, language) })),
        state.id === "wind" && Number.isFinite(record?.value) ? h(document, "p", { class: "small", text: dir === null ? d.selected.calm : fillIso(d.selected.dir, { dir: COMPASS_NAMES[language][COMPASS[Math.round(dir / 45) % 8]], deg: Math.round(dir) }, language) }) : null,
        h(document, "p", { class: "callout", text: d.phen[state.id].short }));
      el.listenNote.textContent = !Number.isFinite(record?.value) ? d.selected.missing : level ? fillIso(d.selected.sound, { level: d.levelWord[level] }, language) : d.selected.silent;
    }
    el.selected.replaceChildren(...parts.filter(Boolean));
    el.cellLabel.textContent = state.a ? idOf(state.a) : "—";
    if (!state.a) el.listenNote.textContent = c.listen.needCell;

    // Compare
    const cmp = [h(document, "h2", { id: "xp-compare-title", text: c.compare.title })];
    const select = h(document, "select", { id: "xp-other", "aria-label": c.compare.other });
    select.append(h(document, "option", { value: "", text: c.compare.choose }));
    for (const cell of snap.grid.cells) {
      if (state.a && cell.row === state.a[0] && cell.col === state.a[1]) continue;
      select.append(h(document, "option", { value: cell.row + "," + cell.col, text: cellId(cell.row, cell.col), selected: state.b && state.b[0] === cell.row && state.b[1] === cell.col }));
    }
    select.disabled = !state.a;
    select.addEventListener("change", () => { state.b = select.value ? select.value.split(",").map(Number) : null; gridApi.setSelected(state); renderPanels(); select.focus?.(); });
    const hear = h(document, "button", { type: "button", class: "button", text: c.compare.hear });
    hear.disabled = !(state.a && state.b);
    hear.addEventListener("click", () => {
      hearCell(state.a[0], state.a[1], 1.4);
      clearTimeout(second);
      second = setTimeout(() => hearCell(state.b[0], state.b[1], 1.4), 1900);
      el.caption2.textContent = fillIso(c.captions.contrast, { a: idOf(state.a), b: idOf(state.b) }, language);
    });
    cmp.push(h(document, "label", { class: "xp-pick", for: "xp-other" }, h(document, "span", { text: c.compare.other }), select), h(document, "div", { class: "player-buttons" }, hear), h(document, "p", { class: "small", text: c.compare.hearNote }));
    if (state.a && state.b) {
      const va = cellOf(snap, ...state.a)?.value;
      const vb = cellOf(snap, ...state.b)?.value;
      const result = compareValues(va, vb);
      const max = levelMax(snap) || 1;
      const bar = (id, value, tag) => h(document, "div", { class: "xp-bar-row" }, h(document, "span", { class: "ltr", text: id + (tag ? " " + c.compare.selectedTag : "") }),
        h(document, "div", { class: "xp-bar-track", "aria-hidden": "true" }, h(document, "div", { class: "xp-bar", style: `width:${Math.max(2, (value / max) * 100)}%` })), h(document, "span", { class: "ltr", text: trimNumber(value, 3) }));
      if (result) {
        cmp.push(h(document, "div", { class: "xp-chart", role: "img", "aria-label": c.compare.chart + ": " + idOf(state.a) + " " + trimNumber(va, 3) + ", " + idOf(state.b) + " " + trimNumber(vb, 3) }, bar(idOf(state.a), va, true), bar(idOf(state.b), vb, false)),
          h(document, "p", { class: "xp-diff" }, h(document, "span", { text: c.compare.diff + ": " }), h(document, "strong", { class: "ltr", text: trimNumber(result.difference, 3) + " " + unit() }), " · " + (result.higher ? c.compare.higher.replace("{id}", idOf(result.higher === "a" ? state.a : state.b)) : c.compare.equal)));
      }
    } else cmp.push(h(document, "p", { class: "small", text: c.compare.needBoth }));
    el.compare.replaceChildren(...cmp);
  }

  function renderAll() {
    norm = normalizer(spec());
    ramp = rampFromStops(spec().stops);
    renderDates(); renderDry(); renderLeft(); renderScale(); paintCells(); renderPanels();
    scene?.setSnapshot(sceneSnapshot());
  }

  // ---- Wiring
  norm = normalizer(spec());
  ramp = rampFromStops(spec().stops);
  buildGrid();
  renderAll();
  let frame;
  const loop = () => { drawWaveform(el.wave, rec.analyser, { color: "#68e0d0" }); frame = requestAnimationFrame(loop); };
  frame = requestAnimationFrame(loop);
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(frame); frame = undefined; } else if (frame === undefined) frame = requestAnimationFrame(loop); });
  if (new URL(document.URL).searchParams.has("debug")) window.__explore = { state, scene, rec, phens, switchTo, setDate, view };
}
