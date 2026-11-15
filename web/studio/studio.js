import { cellId, cellSize, fill, fillIso, formatLat, formatLon, formatUtcDate, formatUtcTime, trimNumber } from "../cinematic/site/cells.js";
import { drawWaveform } from "../cinematic/audio-tap.js";
import { h } from "../cinematic/site/dom.js";
import { mountNav } from "../cinematic/site/nav.js";
import { allowSpoilersThisVisit, spoilersUnlocked } from "../cinematic/site/progress.js";
import { loadSettings, saveSettings } from "../cinematic/site/settings.js";
import { createStudioAudio } from "./audio.js";
import {
  DECODE_LOCKED_DATES, PHENOMENA, PHENOMENON_IDS, changeNormalizer, formatChange, formatValue, isLocked, normalizer, openPackage, rampFromStops,
} from "./datasets.js";
import { cellAt, cellCenter, cellRect, rampTable } from "./field.js";
import { createAnalysisClient } from "./analysis-client.js";
import { mountCompare } from "./compare.js";
import { mountEcho } from "./echo-ui.js";
import { mountHunter } from "./hunter-ui.js";
import { changeSemitones, changeTones, hoverPlan as changeHoverPlan } from "./mapping.js";
import { cellInfo, hoverPlan as valueHoverPlan, soundParams, stepTones } from "./sonify.js";
import { createCanvasRenderer } from "./renderer-2d.js";
import { createGlRenderer } from "./renderer-gl.js";
import { decodeShare, mountShare } from "./share.js";
import { GUIDED, PURE, createSpeech } from "./speech.js";
import { AUDIO, SOUND_MODES, TOOLS, createAppState, createStore } from "./state.js";
import { mapCopy } from "./earthmap-copy.js";
import { studioCopy } from "./studio-copy.js";
import { mountTools } from "./tools.js";
import { clampView, createView, geoToScreen, lerpView, panBy, pixelsPerDegree, screenToGeo, zoomAt } from "./view.js";

export const DEFAULT_DATE = "2025-04-15";
const EARTH_URL = () => new URL("../assets/earth/blue-marble-4096.jpg", import.meta.url).href;
const EARTH_URL_SMALL = () => new URL("../assets/earth/blue-marble-2048.jpg", import.meta.url).href;
const CARDINAL_EN = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
const CARDINAL_AR = ["شمال", "شمال-شمال شرق", "شمال شرق", "شرق-شمال شرق", "شرق", "شرق-جنوب شرق", "جنوب شرق", "جنوب-جنوب شرق", "جنوب", "جنوب-جنوب غرب", "جنوب غرب", "غرب-جنوب غرب", "غرب", "غرب-شمال غرب", "شمال غرب", "شمال-شمال غرب"];
export const cardinal = (degrees, language = "en") => (language === "ar" ? CARDINAL_AR : CARDINAL_EN)[Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16];

/** Chronological sampled dates of a phenomenon. */
export const chronological = (phen) => [...phen.list];

// ---------------------------------------------------------------------------------------------------------------
// Entry: one sentence, one button, no autoplay. Then the two-choice sound-mode dialog.
export function openModeDialog(document, language, { current = null, dismissable = false, onChoose, onClose = () => {} }) {
  const m = mapCopy[language];
  const overlay = h(document, "div", { class: "em-modal-backdrop" });
  const dialog = h(document, "div", { class: "em-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "em-mode-title" });
  const choice = (mode, title, text) => {
    const button = h(document, "button", { type: "button", class: "em-choice", "data-mode": mode, "aria-pressed": String(current === mode) }, h(document, "strong", { text: title }), h(document, "span", { text }));
    button.addEventListener("click", () => { close(); onChoose(mode); });
    return button;
  };
  const buttons = [choice(GUIDED, m.mode.guided, m.mode.guidedText), choice(PURE, m.mode.pure, m.mode.pureText)];
  const closeButton = dismissable ? h(document, "button", { type: "button", class: "button ghost", text: m.mode.close }) : null;
  dialog.append(h(document, "h2", { id: "em-mode-title", text: m.mode.title }), h(document, "div", { class: "em-choices" }, ...buttons), h(document, "p", { class: "small", text: m.mode.note }), closeButton);
  overlay.append(dialog);
  const previous = document.activeElement;
  function close() { overlay.remove(); document.removeEventListener("keydown", onKey, true); previous?.focus?.(); onClose(); }
  function onKey(event) {
    if (event.key === "Escape" && dismissable) { event.preventDefault(); close(); return; }
    if (event.key !== "Tab") return;
    const focusable = [...dialog.querySelectorAll("button")];
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
  closeButton?.addEventListener("click", close);
  document.addEventListener("keydown", onKey, true);
  document.body.append(overlay);
  (buttons.find((b) => b.dataset.mode === current) ?? buttons[0]).focus();
  return { close };
}

export function startStudio(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "studio", from: "pages" });
  const m = mapCopy[language];
  document.title = m.title + " · EARTHPULSE";
  const root = document.getElementById("studio-root");
  const params = new URL(document.URL).searchParams;
  const preset = params.get("mode") === "pure" ? PURE : params.get("mode") === "guided" ? GUIDED : null;
  if (params.get("entry") === "skip" && preset) return mountApp(document, root, language, preset);
  const start = h(document, "button", { type: "button", class: "button em-start", text: m.entry.start });
  root.replaceChildren(h(document, "section", { class: "em-entry", "aria-labelledby": "em-entry-title" },
    h(document, "p", { class: "eyebrow", text: m.entry.eyebrow }), h(document, "h1", { id: "em-entry-title", text: m.entry.title }),
    h(document, "p", { class: "lede", text: m.entry.sentence }), start, h(document, "p", { class: "small", text: m.entry.note })));
  start.addEventListener("click", () => openModeDialog(document, language, { onChoose: (mode) => mountApp(document, root, language, mode) }));
  return Promise.resolve();
}

// ---------------------------------------------------------------------------------------------------------------
async function mountApp(document, root, language, initialMode) {
  const c = studioCopy[language];
  const m = mapCopy[language];
  const win = document.defaultView;
  const params = new URL(document.URL).searchParams;
  const reduced = () => win.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
  const T = (template, extra) => fillIso(template, extra, language);
  const settings = loadSettings();
  root.replaceChildren(h(document, "p", { class: "status", role: "status", text: m.entry.loading }));

  // ---- Data
  let pkg;
  let phen;
  const startParams = new URLSearchParams(new URL(document.URL).search);
  const wantedPhen = PHENOMENON_IDS.includes(startParams.get("phen")) ? startParams.get("phen") : "dust";
  try {
    pkg = await openPackage();
    phen = await pkg.openPhenomenon(wantedPhen);
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: m.phen.retry });
    retry.addEventListener("click", () => location.reload());
    root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: m.phen.error }), retry);
    return null;
  }
  const grid = phen.grid;
  const bounds = grid.bounds;
  const size = cellSize(bounds, grid);
  const unlocked = () => spoilersUnlocked();
  const firstOpen = () => phen.list.find((s) => !isLocked(phen.id, s.date, unlocked()) && s.date === DEFAULT_DATE) ?? phen.list.find((s) => !isLocked(phen.id, s.date, unlocked()));
  const decoded = decodeShare(new URL(document.URL).search, { snapshots: phen.list, comparisons: phen.comparisons, compatibilityGroups: phen.compatibilityGroups, unavailableComparisons: phen.unavailableComparisons }, bounds);
  const startSnap = (decoded.snapshotId && !isLocked(phen.id, phen.snapshot(decoded.snapshotId).date, unlocked()) ? phen.snapshot(decoded.snapshotId) : null) ?? firstOpen();

  const store = createStore(createAppState({ datasetId: phen.id, variable: phen.spec.measure, soundMode: initialMode, uiLanguage: language, timeRange: { start: startSnap.date, end: startSnap.date } }));
  const state = { snapshot: startSnap, comparison: null, view: createView(bounds), cursor: null, selected: null, pins: [], tool: "explore", width: 1, height: 1, outside: false, extraOverlay: [], understandExtras: [], onKeyExtra: [], pointerHandlers: [], dataHooks: [] };
  const el = {};
  const spec = () => phen.spec;
  const layerValues = () => (state.comparison ? state.comparison.values : state.snapshot.values);
  const layerKind = () => (state.comparison ? "change" : "dust");
  const fmt = (value) => formatValue(spec(), value);
  const fmtChange = (value) => formatChange(spec(), value);
  const unitText = () => m.phen.unitName[phen.id];
  const catalog = () => ({ snapshots: phen.list, comparisons: phen.comparisons, compatibilityGroups: phen.compatibilityGroups, unavailableComparisons: phen.unavailableComparisons, bounds });
  const dateOf = (snapshot) => formatUtcDate(snapshot.time.start, language);
  const sampleName = (index) => cellId(Math.floor(index / grid.cols), index % grid.cols);

  // ---- Skeleton
  el.live = h(document, "p", { class: "visually-hidden", id: "em-live", role: "status", "aria-live": "polite" });
  el.frame = h(document, "div", { class: "st-map", dir: "ltr", tabindex: "0", role: "application", "aria-label": c.map.label, "aria-describedby": "st-keys" });
  el.overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  el.overlay.setAttribute("class", "st-overlay");
  el.overlay.setAttribute("aria-hidden", "true");
  el.compass = h(document, "div", { class: "st-compass", dir: "ltr", role: "img", "aria-label": m.compass }, h(document, "span", { "aria-hidden": "true", text: "N" }), h(document, "span", { class: "needle", "aria-hidden": "true", text: "↑" }));
  el.frame.append(el.overlay, el.compass);
  el.note = h(document, "p", { class: "small st-note", role: "note" });

  // ---- Renderer
  let renderer;
  let frameRequest = 0;
  const earth = () => (win.matchMedia?.("(max-width: 700px)").matches ? EARTH_URL_SMALL() : EARTH_URL());
  function makeRenderer(force2d) {
    renderer?.dispose();
    const options = { document, container: el.frame, earthUrl: earth(), onReady: invalidate };
    renderer = null;
    if (!force2d) {
      try { renderer = createGlRenderer({ ...options, onLost: () => { el.note.textContent = c.map.fallback; makeRenderer(true); } }); } catch (error) { console.warn("WebGL unavailable", error); }
    }
    if (!renderer) { renderer = createCanvasRenderer(options); el.note.textContent = c.map.fallback; }
    el.frame.dataset.renderer = renderer.kind;
    resize();
    applyLayer();
  }
  function resize() {
    const w = Math.max(1, el.frame.clientWidth);
    const hh = Math.max(1, el.frame.clientHeight);
    state.width = w; state.height = hh;
    renderer.resize(w, hh, Math.min(win.devicePixelRatio || 1, 2));
    state.view = clampView(state.view, bounds, w, hh);
    invalidate();
  }
  function layerDescription() {
    const s = spec();
    if (state.comparison) {
      const norm = changeNormalizer(s);
      return { mode: "diff", values: layerValues(), normalize: (v) => 0.5 + 0.5 * norm(v), ramp: rampTable("diff") };
    }
    return { mode: "value", values: layerValues(), normalize: normalizer(s), ramp: rampFromStops(s.stops) };
  }
  function applyLayer() { renderer.setLayer(layerDescription(), grid); invalidate(); }
  function invalidate() { if (!frameRequest) frameRequest = win.requestAnimationFrame(draw); }
  function draw() {
    frameRequest = 0;
    renderer.setView(state.view, pixelsPerDegree(state.view, bounds, state.width, state.height), bounds);
    renderer.render();
    drawOverlay();
  }
  const toScreen = (lon, lat) => geoToScreen(state.view, bounds, state.width, state.height, lon, lat);
  const toGeo = (x, y) => screenToGeo(state.view, bounds, state.width, state.height, x, y);
  let animation = 0;
  function setView(target, animate = true) {
    const next = clampView(target, bounds, state.width, state.height);
    win.cancelAnimationFrame(animation);
    if (!animate || reduced()) { state.view = next; invalidate(); store.dispatch("SET_CAMERA", { bounds: visibleWindow() }); return; }
    const from = state.view;
    const start = win.performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / 320);
      state.view = clampView(lerpView(from, next, 1 - (1 - t) ** 3), bounds, state.width, state.height);
      invalidate();
      if (t < 1) animation = win.requestAnimationFrame(step); else store.dispatch("SET_CAMERA", { bounds: visibleWindow() });
    };
    animation = win.requestAnimationFrame(step);
  }
  const visibleWindow = () => { const a = toGeo(0, 0); const b = toGeo(state.width, state.height); return { west: a.lon, east: b.lon, north: a.lat, south: b.lat }; };
  const zoomBy = (factor, x, y, animate = true) => setView(zoomAt(state.view, bounds, state.width, state.height, factor, x, y), animate);
  const svg = (name, attrs) => { const node = document.createElementNS("http://www.w3.org/2000/svg", name); for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v)); return node; };
  function drawOverlay() {
    el.overlay.setAttribute("viewBox", `0 0 ${state.width} ${state.height}`);
    el.overlay.replaceChildren();
    const cellBox = (index, cls) => {
      const r = cellRect(grid, Math.floor(index / grid.cols), index % grid.cols);
      const a = toScreen(r.west, r.north);
      const b = toScreen(r.east, r.south);
      el.overlay.append(svg("rect", { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, class: cls }));
    };
    if (state.selected) cellBox(state.selected.index, "st-selected");
    if (state.cursor) cellBox(state.cursor.index, "st-cursor");
    for (const pin of state.pins) {
      const centre = cellCenter(grid, Math.floor(pin.index / grid.cols), pin.index % grid.cols);
      const p = toScreen(centre.lon, centre.lat);
      el.overlay.append(svg("circle", { cx: p.x, cy: p.y, r: pin.selected ? 15 : 11, class: "st-pin st-pin-" + pin.kind + (pin.selected ? " active" : "") }));
      const label = svg("text", { x: p.x, y: p.y + 4, class: "st-pin-label", "text-anchor": "middle" });
      label.textContent = String(pin.label);
      el.overlay.append(label);
    }
    for (const extra of state.extraOverlay) extra(el.overlay, svg, toScreen);
  }

  // ---- Audio, speech
  const audio = createStudioAudio({ volume: settings.volume });
  const speech = createSpeech({ language: () => language, liveRegion: el.live, onState: (s) => store.dispatch("SET_SPEECH", { speech: s }), onDuck: (on) => audio.setDuck(on) });
  speech.setMode(initialMode);
  const speak = (text) => speech.say(text);
  const guided = (text) => speech.announce(text);

  // ---- Understand / info panel
  const row = (label) => ({ dt: h(document, "dt", { text: label }), dd: h(document, "dd", {}) });
  const u = { cell: row(m.info.sample), loc: row(c.understand.location), bounds: row(c.understand.bounds), value: row(m.info.value), time: row(m.info.window), source: row(m.info.source), type: row(m.info.dataType), sound: row(m.info.sound), wind: row(m.info.wind), cover: row(m.info.coverage) };
  const dl = h(document, "dl", { class: "kv" }, ...Object.values(u).flatMap((r) => [r.dt, r.dd]));
  el.status = h(document, "p", { class: "callout", role: "status" });
  el.status.setAttribute("aria-live", initialMode === GUIDED ? "polite" : "off");
  el.provenance = h(document, "details", { class: "em-provenance" }, h(document, "summary", { text: m.info.provenance }));
  const info = h(document, "section", { class: "panel st-understand", "aria-labelledby": "st-u-title" }, h(document, "h2", { id: "st-u-title", text: m.info.title }), el.status, dl, el.provenance);

  function describeCell(cell) {
    const kind = layerKind();
    const value = layerValues()[cell.index];
    const centre = cellCenter(grid, cell.row, cell.col);
    return { value, kind, id: cellId(cell.row, cell.col), lat: formatLat(centre.lat), lon: formatLon(centre.lon), r: cellRect(grid, cell.row, cell.col), index: cell.index };
  }
  const windText = (index) => {
    const w = cellInfo("wind", state.snapshot, index);
    if (w.direction === null || w.direction === undefined) return m.info.windCalm;
    return T(m.info.windFrom, { dir: cardinal(w.direction, language), deg: Math.round(w.direction) });
  };
  function soundText(d) {
    if (d.value === null) return c.understand.missingSound;
    if (d.kind === "change") { const norm = changeNormalizer(spec()); return norm(d.value) === 0 ? c.understand.soundFlat : T(d.value > 0 ? c.understand.soundUp : c.understand.soundDown, { semi: changeSemitones(d.value, norm) }); }
    const p = soundParams(phen.id, cellInfo(phen.id, state.snapshot, d.index));
    const meaning = m.phen.soundMeaning[phen.id];
    const part = p.silent ? "" : p.rate ? " " + trimNumber(p.rate, 1) + "/s" : p.frequencyHz ? " " + trimNumber(p.frequencyHz, 0) + " Hz" : "";
    return meaning + (p.silent ? "" : "" + part);
  }
  function renderInfo() {
    const s = state.snapshot;
    u.time.dd.textContent = T(c.date.window, { date: dateOf(s), from: formatUtcTime(s.time.start).replace(" UTC", ""), to: formatUtcTime(s.time.end).replace(" UTC", ""), hours: trimNumber((Date.parse(s.time.end) - Date.parse(s.time.start)) / 3600000, 2) });
    u.source.dd.textContent = T(m.info.sourceValue, { short: s.source.shortName, variable: spec().variable });
    u.source.dd.className = "ltr";
    u.type.dd.textContent = m.info.dataTypeValue;
    u.cover.dd.textContent = T(m.info.coverageValue, { west: formatLon(bounds.west), east: formatLon(bounds.east), south: formatLat(bounds.south), north: formatLat(bounds.north) });
    const showWind = phen.id === "wind";
    for (const node of [u.wind.dt, u.wind.dd]) node.hidden = !showWind;
    const cell = state.cursor;
    if (!cell) {
      el.status.hidden = false;
      el.status.textContent = state.outside ? m.info.outside : m.info.none;
      for (const key of ["cell", "loc", "bounds", "value", "sound", "wind"]) u[key].dd.textContent = "—";
    } else {
      const d = describeCell(cell);
      el.status.hidden = d.value !== null;
      el.status.textContent = d.value === null ? m.info.missing : "";
      u.cell.dd.textContent = d.id;
      u.loc.dd.textContent = T(c.understand.cellRow, { lat: d.lat, lon: d.lon });
      u.loc.dd.className = "ltr";
      u.bounds.dd.textContent = T("{south} to {north}, {west} to {east}", { south: formatLat(d.r.south), north: formatLat(d.r.north), west: formatLon(d.r.west), east: formatLon(d.r.east) });
      u.bounds.dd.className = "ltr";
      if (d.kind === "dust") u.value.dd.textContent = d.value === null ? "—" : T("{value} {unit}", { value: fmt(d.value), unit: unitText() });
      else u.value.dd.textContent = d.value === null ? "—" : T("{value} {unit}", { value: fmtChange(d.value), unit: unitText() });
      u.sound.dd.textContent = soundText(d);
      u.wind.dd.textContent = showWind ? windText(d.index) : "—";
      for (const extra of state.understandExtras) extra(d);
    }
    renderProvenance();
  }
  function renderProvenance() {
    const s = state.snapshot;
    const items = [h(document, "li", { class: "ltr", text: T(m.info.build, { build: s.source.modelSource }) }), h(document, "li", { class: "ltr mono", text: s.source.granule })];
    for (const rel of spec().related) if (!rel.only || rel.only === s.date) items.push(h(document, "li", {}, T(m.info.related, { label: "" }).replace(/:\s*$/, ": "), h(document, "a", { href: rel.url, target: "_blank", rel: "noopener noreferrer", text: rel.label + " (" + rel.relation + ")" })));
    items.push(h(document, "li", { text: T(m.info.files, { n: pkg.integrity.verified }) }));
    el.provenance.replaceChildren(h(document, "summary", { text: m.info.provenance }), h(document, "ul", { class: "st-keys small" }, ...items));
  }
  const readText = (cell) => {
    const d = describeCell(cell);
    const measure = m.phen.measure[phen.id];
    if (d.kind === "change") return T(d.value === null ? c.read.changeMissing : m.read.change, { id: d.id, lat: d.lat, lon: d.lon, measure, value: fmtChange(d.value), unit: unitText(), direction: d.value === null ? "" : Math.abs(d.value) < spec().change.nearZero ? c.understand.flat : d.value > 0 ? c.understand.up : c.understand.down });
    const base = T(d.value === null ? m.read.missing : m.read.cell, { id: d.id, lat: d.lat, lon: d.lon, measure, value: fmt(d.value), unit: unitText(), date: dateOf(state.snapshot) });
    return phen.id === "wind" && d.value !== null ? base + " " + windText(d.index) + "." : base;
  };

  // ---- Legend
  el.legend = h(document, "div", { class: "st-legend panel" });
  function renderLegend() {
    const s = spec();
    const parts = [];
    if (!state.comparison) {
      const norm = normalizer(s);
      const stops = s.stops.map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${(t * 100).toFixed(1)}%`).join(",");
      const ticks = s.ticks.map((v) => h(document, "span", { class: "tick ltr", style: `left:${norm(v) * 100}%`, text: String(v) }));
      parts.push(h(document, "h3", { text: m.phen.measure[phen.id] + " · " + unitText() }), h(document, "div", { class: "st-bar", style: `background:linear-gradient(90deg,${stops})`, "aria-hidden": "true" }), h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, ...ticks),
        h(document, "p", { class: "small", text: T("{min} … {max}", { min: s.min, max: s.max }) + " (" + (s.transform === "log" ? "log" : s.transform === "sqrt" ? "√" : "linear") + ")" }), h(document, "p", { class: "small" }, h(document, "span", { class: "st-hatch" }), " " + c.legend.missing));
    } else {
      parts.push(h(document, "h3", { text: c.legend.changeTitle + " · " + unitText() }), h(document, "div", { class: "st-bar st-bar-diff", "aria-hidden": "true" }),
        h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, h(document, "span", { class: "tick", style: "left:0%", text: "−" + s.change.max }), h(document, "span", { class: "tick", style: "left:50%", text: "0" }), h(document, "span", { class: "tick", style: "left:100%", text: "+" + s.change.max })),
        h(document, "p", { class: "small" }, h(document, "span", { class: "sw sw-up" }), " " + c.legend.increase + "  ", h(document, "span", { class: "sw sw-down" }), " " + c.legend.decrease + "  ", h(document, "span", { class: "sw sw-flat" }), " " + T(c.legend.near, { band: s.change.nearZero })),
        h(document, "p", { class: "small", text: c.legend.changeNote }), h(document, "p", { class: "small" }, h(document, "span", { class: "st-hatch" }), " " + c.legend.missing));
    }
    el.legend.replaceChildren(...parts);
  }

  // ---- Cursor and selection
  function setCursor(cell, { announce = false, outside = false } = {}) {
    const changed = (state.cursor?.index ?? -1) !== (cell?.index ?? -1) || state.outside !== outside;
    state.cursor = cell;
    state.outside = outside;
    if (changed) { renderInfo(); invalidate(); if (cell) store.dispatch("MOVE_FOCUS", { sampleId: cell.index }); state.onCursor?.(cell); }
    if (announce && cell) speech.say(readText(cell));
  }
  const cursorAt = (x, y) => { const g = toGeo(x, y); return cellAt(grid, g.lon, g.lat); };
  function selectCell(cell, { play = true, say = true, user = true } = {}) {
    if (!cell) return;
    state.selected = cell;
    state.cursor = cell;
    store.dispatch("SELECT_SAMPLE", { sampleId: cell.index });
    renderInfo();
    invalidate();
    for (const hook of state.selectHooks ?? []) hook(cell, { user });
    if (play) soundForCursor(true);
    if (say) guided(readText(cell));
  }
  const explain = () => { if (state.cursor) speech.say(readText(state.cursor)); else speech.say(m.info.none); };

  // ---- Sound for the cursor
  const slotFor = (kind) => (layerKind() === "change" ? 0.12 : kind === "area" ? 0.18 : 0.2);
  function tonesFor(step, pan, { kind, slotS, compact }) {
    if (kind === "change") return changeTones(step.value, pan, compact ? 0.05 : 0.09, changeNormalizer(spec()));
    return stepTones(phen.id, state.snapshot, step, pan, Math.max(0.1, slotS * 0.9));
  }
  const cursorKey = () => [phen.id, state.snapshot.id, state.comparison?.id ?? "value", state.cursor?.index].join("|");
  function planFor(cell) {
    const centre = cellCenter(grid, cell.row, cell.col);
    if (layerKind() === "change") return changeHoverPlan("change", cell, layerValues()[cell.index], grid, changeNormalizer(spec()));
    return valueHoverPlan(phen.id, state.snapshot, cell, grid, centre.lon);
  }
  function soundForCursor(force = false) {
    if (!audio.enabled || !state.cursor || state.busy) return;
    const cell = state.cursor;
    if (force) audio.play(planFor(cell)); else audio.hover(cursorKey(), () => planFor(cell));
  }
  state.onCursor = (cell) => {
    if (state.tool === "explore") soundForCursor();
    if (cell && state.tool === "explore" && store.state.tool === TOOLS.EXPLORE) guided(readText(cell));
  };

  const setSound = async (on) => {
    el.soundButton.setAttribute("aria-pressed", String(on));
    el.soundButton.textContent = on ? m.sound.disable : m.sound.enable;
    if (on) { await audio.enable(); el.soundState.textContent = audio.unavailable ? c.sound.unavailable : m.sound.on; } else { audio.disable(); el.soundState.textContent = m.sound.off; }
    store.dispatch("SET_AUDIO", { audio: on ? AUDIO.IDLE : AUDIO.MUTED });
    renderInfo();
    if (on && state.cursor) soundForCursor();
  };

  // ---- Pointer, wheel, touch
  const pointers = new Map();
  let dragging = null;
  const local = (event) => { const r = el.frame.getBoundingClientRect(); return { x: event.clientX - r.left, y: event.clientY - r.top }; };
  el.frame.addEventListener("pointerdown", (event) => {
    el.frame.focus({ preventScroll: true });
    pointers.set(event.pointerId, local(event));
    el.frame.setPointerCapture?.(event.pointerId);
    state.onPointer?.("down", event, local(event), pointers);
    if (event.defaultPrevented) return;
    dragging = { id: event.pointerId, start: local(event), last: local(event), moved: false, pinch: pointers.size > 1 };
  });
  el.frame.addEventListener("pointermove", (event) => {
    const p = local(event);
    if (!pointers.has(event.pointerId)) {
      if (event.pointerType === "mouse") { const cell = cursorAt(p.x, p.y); setCursor(cell, { outside: !cell }); }
      state.onPointer?.("hover", event, p, pointers);
      return;
    }
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, p);
    state.onPointer?.("move", event, p, pointers);
    if (event.defaultPrevented) return;
    if (pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const [pa, pb] = [...pointers.entries()].map(([id, pt]) => (id === event.pointerId ? previous : pt));
      const before = Math.hypot(pa.x - pb.x, pa.y - pb.y);
      const after = Math.hypot(a.x - b.x, a.y - b.y);
      const centre = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      let view = zoomAt(state.view, bounds, state.width, state.height, before > 0 ? after / before : 1, centre.x, centre.y);
      view = panBy(view, bounds, state.width, state.height, centre.x - (pa.x + pb.x) / 2, centre.y - (pa.y + pb.y) / 2);
      state.view = view; invalidate();
      return;
    }
    if (!dragging || dragging.id !== event.pointerId || dragging.pinch) return;
    if (!dragging.moved && Math.hypot(p.x - dragging.start.x, p.y - dragging.start.y) < 4) return;
    dragging.moved = true;
    state.view = panBy(state.view, bounds, state.width, state.height, p.x - dragging.last.x, p.y - dragging.last.y);
    dragging.last = p;
    el.frame.dataset.dragging = "true";
    invalidate();
  });
  const endPointer = (event) => {
    const p = local(event);
    pointers.delete(event.pointerId);
    state.onPointer?.("up", event, p, pointers);
    if (dragging?.id === event.pointerId) {
      if (!dragging.moved && event.type === "pointerup" && state.tool === "explore") { const cell = cursorAt(p.x, p.y); if (cell) selectCell(cell); else setCursor(null, { outside: true }); }
      dragging = null;
    }
    if (pointers.size === 0) delete el.frame.dataset.dragging;
  };
  el.frame.addEventListener("pointerup", endPointer);
  el.frame.addEventListener("pointercancel", endPointer);
  el.frame.addEventListener("wheel", (event) => { event.preventDefault(); const p = local(event); zoomBy(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : 0.0016)), p.x, p.y, false); }, { passive: false });
  el.frame.style.touchAction = "none";
  state.onPointer = (type, event, p, ptrs) => {
    for (const handler of state.pointerHandlers) { handler(type, event, p, ptrs); if (event.defaultPrevented) return; }
    if (event.pointerType === "touch" && state.tool === "explore" && audio.enabled && ptrs.size === 1 && (type === "down" || type === "move")) { event.preventDefault(); const cell = cursorAt(p.x, p.y); setCursor(cell, { outside: !cell }); }
  };

  // ---- Keyboard: arrows move one cell, geography never mirrors.
  function moveCursor(dRow, dCol) {
    const from = state.cursor ?? (() => { const g = toGeo(state.width / 2, state.height / 2); return cellAt(grid, g.lon, g.lat) ?? { row: 0, col: 0 }; })();
    const row = Math.max(0, Math.min(grid.rows - 1, from.row + dRow));
    const col = Math.max(0, Math.min(grid.cols - 1, from.col + dCol));
    setCursor({ row, col, index: row * grid.cols + col });
    const centre = cellCenter(grid, row, col);
    const s = toScreen(centre.lon, centre.lat);
    if (s.x < 40 || s.x > state.width - 40 || s.y < 40 || s.y > state.height - 40) setView({ ...state.view, lon: centre.lon, lat: centre.lat }, true);
  }
  state.onKeyExtra.push((event) => {
    if (event.key === "Enter" && state.tool === "explore" && state.cursor) { event.preventDefault(); selectCell(state.cursor); return true; }
    return false;
  });
  state.onKey = (event) => {
    if (event.key === " " && state.cursor) { event.preventDefault(); if (audio.enabled) soundForCursor(true); else speech.say(m.sound.off + " " + readText(state.cursor)); return; }
    for (const handler of state.onKeyExtra) if (handler(event)) return;
  };
  el.frame.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const arrows = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (arrows[event.key]) {
      event.preventDefault();
      if (event.shiftKey) { const [dr, dc] = arrows[event.key]; setView(panBy(state.view, bounds, state.width, state.height, -dc * 60, -dr * 60), false); return; }
      moveCursor(...arrows[event.key]);
      return;
    }
    if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomBy(1.4); return; }
    if (event.key === "-" || event.key === "_") { event.preventDefault(); zoomBy(1 / 1.4); return; }
    if (event.key === "Home") { event.preventDefault(); setView(createView(bounds)); return; }
    if (event.key === "Escape") { speech.cancel(); return; }
    if ((event.key === "r" || event.key === "R") && state.cursor) { event.preventDefault(); explain(); return; }
    state.onKey?.(event);
  });

  // ---- Left/explore panels (the tools and compare modules insert their own panels into these containers)
  const zoomIn = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.zoom.in, text: "+" });
  const zoomOut = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.zoom.out, text: "−" });
  const resetView = h(document, "button", { type: "button", class: "st-icon", "aria-label": c.zoom.reset, text: "⟲" });
  zoomIn.addEventListener("click", () => zoomBy(1.5));
  zoomOut.addEventListener("click", () => zoomBy(1 / 1.5));
  resetView.addEventListener("click", () => setView(createView(bounds)));
  const viewPanel = h(document, "section", { class: "panel", "aria-label": c.zoom.label }, h(document, "div", { class: "st-row" }, zoomOut, zoomIn, resetView));
  el.soundButton = h(document, "button", { type: "button", class: "button", "aria-pressed": "false", text: m.sound.enable });
  el.soundState = h(document, "p", { class: "small", role: "status", "aria-live": "polite", text: m.sound.off });
  el.volume = h(document, "input", { type: "range", id: "st-volume", min: 0, max: 100, step: 1, value: Math.round(settings.volume * 100) });
  el.voiceVolume = h(document, "input", { type: "range", id: "st-voice-volume", min: 0, max: 100, step: 1, value: 100 });
  el.volume.addEventListener("input", () => { const v = Number(el.volume.value) / 100; audio.setVolume(v); saveSettings({ volume: v }); });
  el.voiceVolume.addEventListener("input", () => speech.setSpeechVolume(Number(el.voiceVolume.value) / 100));
  el.soundButton.addEventListener("click", () => setSound(!audio.enabled));
  el.voiceNote = h(document, "p", { class: "small", hidden: true, text: m.voice.unavailable });
  const explainButton = h(document, "button", { type: "button", class: "button ghost small-button", text: m.voice.explain });
  const helpButton = h(document, "button", { type: "button", class: "button ghost small-button", text: m.voice.help });
  const lastButton = h(document, "button", { type: "button", class: "button ghost small-button", text: m.voice.last });
  lastButton.addEventListener("click", () => {
    const cell = state.selected ?? state.cursor;
    if (!cell) { speak(m.info.none); return; }
    selectCell(cell, { play: false, say: false });
    const centre = cellCenter(grid, cell.row, cell.col);
    setView({ ...state.view, lon: centre.lon, lat: centre.lat });
    speech.say(readText(cell));
  });
  explainButton.addEventListener("click", explain);
  const toolIntro = () => speech.say(m.voice.helpText[store.state.tool]);
  helpButton.addEventListener("click", toolIntro);
  const soundPanel = h(document, "section", { class: "panel", "aria-labelledby": "st-sound-title" }, h(document, "h2", { id: "st-sound-title", text: c.sound.title }), el.soundButton, el.soundState,
    h(document, "label", { class: "volume", for: "st-volume" }, h(document, "span", { text: m.voice.dataVolume }), el.volume),
    h(document, "label", { class: "volume", for: "st-voice-volume" }, h(document, "span", { text: m.voice.speechVolume }), el.voiceVolume), el.voiceNote,
    h(document, "div", { class: "st-tools-row" }, explainButton, helpButton, lastButton),
    h(document, "p", { class: "small", id: "em-sound-meaning" }));
  state.left = h(document, "div", { class: "em-col" }, viewPanel, soundPanel);
  state.right = h(document, "div", { class: "em-col" }, h(document, "div", { hidden: true }), h(document, "div", { hidden: true }));
  const explorePanel = h(document, "div", { id: "em-panel-explore", role: "tabpanel", "aria-labelledby": "em-tab-explore", class: "em-tabpanel" }, state.left, state.right);
  const hunterPanel = h(document, "div", { id: "em-panel-hunter", role: "tabpanel", "aria-labelledby": "em-tab-hunter", class: "em-tabpanel", hidden: true });
  const echoPanel = h(document, "div", { id: "em-panel-echo", role: "tabpanel", "aria-labelledby": "em-tab-echo", class: "em-tabpanel", hidden: true });

  // ---- Top bar: phenomena, date, mode, help, status
  const phenButtons = {};
  el.phenGroup = h(document, "div", { class: "em-phen", role: "group", "aria-label": m.phen.label });
  for (const id of PHENOMENON_IDS) {
    const b = h(document, "button", { type: "button", class: "em-pill", "aria-pressed": String(id === phen.id), text: m.phen[id], "data-phen": id });
    b.addEventListener("click", () => switchPhenomenon(id));
    phenButtons[id] = b;
    el.phenGroup.append(b);
  }
  const forests = h(document, "button", { type: "button", class: "em-pill", "aria-disabled": "true", title: m.phen.forestsReason, "aria-describedby": "em-forests-reason", text: m.phen.forests });
  forests.addEventListener("click", () => { el.live.textContent = m.phen.forestsReason; el.forestsNote.hidden = false; });
  el.forestsNote = h(document, "p", { class: "small em-forests", id: "em-forests-reason", hidden: true, text: m.phen.forestsReason });
  el.phenGroup.append(forests);
  el.date = h(document, "select", { id: "st-date", "aria-label": m.date.label });
  el.prev = h(document, "button", { type: "button", class: "st-icon", "aria-label": m.date.prev, text: "‹" });
  el.next = h(document, "button", { type: "button", class: "st-icon", "aria-label": m.date.next, text: "›" });
  el.dateInfo = h(document, "span", { class: "small em-dateinfo" });
  el.lock = h(document, "div", { class: "callout warn em-lock", role: "alert", hidden: true });
  function fillDates() {
    const seasonLabel = (season) => m.date.seasons[season.name] + " " + season.seasonYear;
    el.date.replaceChildren(...phen.seasons.map((season) => h(document, "optgroup", { label: seasonLabel(season) }, ...season.snapshotIds.map((id) => { const entry = phen.snapshot(id); return h(document, "option", { value: id, text: entry.date + (isLocked(phen.id, entry.date, unlocked()) ? " 🔒" : ""), selected: id === state.snapshot.id }); }))));
  }
  async function requestDate(id) {
    const entry = phen.snapshot(id);
    if (!entry) return;
    if (isLocked(phen.id, entry.date, unlocked())) {
      el.lock.hidden = false;
      el.lock.replaceChildren(h(document, "span", { text: T(m.lock.text, { date: entry.date }) + " " }), (() => { const show = h(document, "button", { type: "button", class: "button ghost small-button", text: m.lock.show }); show.addEventListener("click", () => { allowSpoilersThisVisit(); el.lock.hidden = true; fillDates(); renderTimeline(); requestDate(id); }); return show; })(),
        h(document, "a", { class: "button ghost small-button", href: "../" + (language === "ar" ? "?lang=ar" : ""), text: m.lock.decode }));
      el.date.value = state.snapshot.id;
      return;
    }
    el.lock.hidden = true;
    state.snapshot = entry;
    el.date.value = entry.id;
    store.dispatch("SET_TIME_RANGE", { start: entry.date, end: entry.date });
    onSnapshotChanged();
  }
  function onSnapshotChanged() {
    el.dateInfo.textContent = "";
    if (!state.comparison) applyLayer();
    renderTimeline();
    onDataChanged();
    for (const hook of state.dateHooks ?? []) hook();
  }
  el.date.addEventListener("change", () => requestDate(el.date.value));
  const stepDate = (delta) => { const i = phen.list.findIndex((s) => s.id === state.snapshot.id); const next = phen.list[Math.min(phen.list.length - 1, Math.max(0, i + delta))]; if (next) requestDate(next.id); };
  el.prev.addEventListener("click", () => stepDate(-1));
  el.next.addEventListener("click", () => stepDate(1));
  el.modeButton = h(document, "button", { type: "button", class: "button ghost small-button em-mode-button" });
  const helpOpen = h(document, "button", { type: "button", class: "button ghost small-button", text: m.help.title });
  el.sourceStatus = h(document, "p", { class: "small em-source" });
  function renderStatus() {
    const verified = pkg.integrity.mode === "sha256" ? T(m.status.verified, { n: pkg.integrity.verified }) : m.status.verifyOff;
    el.sourceStatus.textContent = m.status.source + " · " + verified + (pkg.integrity.failed.length ? " · ⚠ " + pkg.integrity.failed.length : "");
  }
  const modeName = () => (store.state.soundMode === PURE ? m.mode.pure : m.mode.guided);
  function renderModeButton() { el.modeButton.textContent = T(m.mode.button, { mode: modeName() }); }
  function setSoundMode(mode) {
    store.dispatch("SET_SOUND_MODE", { mode });
    speech.setMode(mode);
    el.status.setAttribute("aria-live", mode === GUIDED ? "polite" : "off");
    renderModeButton();
    el.live.textContent = m.mode.switched[mode];
    if (mode === GUIDED && state.cursor) speak(m.mode.switched[mode] + " " + readText(state.cursor));
  }
  el.modeButton.addEventListener("click", () => openModeDialog(document, language, { current: store.state.soundMode, dismissable: true, onChoose: setSoundMode }));
  const helpDialog = () => {
    const overlay = h(document, "div", { class: "em-modal-backdrop" });
    const close = h(document, "button", { type: "button", class: "button", text: m.help.close });
    const dialog = h(document, "div", { class: "em-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "em-help-title" }, h(document, "h2", { id: "em-help-title", text: m.help.title }), h(document, "p", { text: m.help.keys }), ...c.help.items.map((line) => h(document, "p", { class: "small", text: line })), close);
    overlay.append(dialog);
    const done = () => { overlay.remove(); helpOpen.focus(); };
    close.addEventListener("click", done);
    overlay.addEventListener("keydown", (event) => { if (event.key === "Escape") done(); });
    document.body.append(overlay);
    close.focus();
  };
  helpOpen.addEventListener("click", helpDialog);
  const topbar = h(document, "div", { class: "em-top" }, el.phenGroup, h(document, "div", { class: "em-datebox" }, el.prev, el.date, el.next, el.dateInfo), h(document, "div", { class: "em-topactions" }, el.modeButton, helpOpen), el.sourceStatus, el.forestsNote, el.lock);

  // ---- Tabs
  const tabIds = [[TOOLS.EXPLORE, "explore"], [TOOLS.HUNTER, "hunter"], [TOOLS.ECHO, "echo"]];
  const panels = { EXPLORE: explorePanel, HUNTER: hunterPanel, ECHO: echoPanel };
  const tabButtons = {};
  el.tabs = h(document, "div", { class: "em-tabs", role: "tablist", "aria-label": m.tabs.label });
  const introduced = new Set();
  function setTab(tool, { focus = false } = {}) {
    store.dispatch("SET_TOOL", { tool });
    for (const [key, panel] of Object.entries(panels)) panel.hidden = key !== tool;
    for (const [key, button] of Object.entries(tabButtons)) { button.setAttribute("aria-selected", String(key === tool)); button.tabIndex = key === tool ? 0 : -1; }
    el.frame.dataset.tab = tool;
    speech.cancel();
    if (tool !== TOOLS.EXPLORE) { state.cursorBeforeTab = state.cursor; }
    if (!introduced.has(tool) && store.state.soundMode === GUIDED) { introduced.add(tool); speak(m.voice.toolIntro[tool]); }
    state.tabHooks?.[tool]?.();
    if (focus) tabButtons[tool].focus();
    invalidate();
  }
  for (const [tool, key] of tabIds) {
    const b = h(document, "button", { type: "button", role: "tab", id: "em-tab-" + key, class: "em-tab", "aria-selected": String(tool === TOOLS.EXPLORE), "aria-controls": "em-panel-" + key, text: m.tabs[key], "data-tool": tool, tabindex: tool === TOOLS.EXPLORE ? "0" : "-1" });
    b.addEventListener("click", () => setTab(tool));
    b.addEventListener("keydown", (event) => { const i = tabIds.findIndex(([t]) => t === tool); const next = event.key === "ArrowRight" ? tabIds[(i + (language === "ar" ? -1 : 1) + 3) % 3] : event.key === "ArrowLeft" ? tabIds[(i + (language === "ar" ? 1 : -1) + 3) % 3] : null; if (next) { event.preventDefault(); setTab(next[0], { focus: true }); } });
    tabButtons[tool] = b;
    el.tabs.append(b);
  }
  const sheetToggle = h(document, "button", { type: "button", class: "button ghost small-button em-sheet-toggle", "aria-expanded": "false", "aria-controls": "em-tools", text: m.mobile.tools });
  el.bar = h(document, "div", { class: "em-bar" }, el.tabs, sheetToggle);

  // ---- Bottom bar: timeline, play/stop, waveform, measure
  el.timeline = h(document, "div", { class: "em-timeline", role: "group", "aria-label": m.date.timeline });
  function renderTimeline() {
    el.timeline.replaceChildren(...phen.list.map((s) => {
      const locked = isLocked(phen.id, s.date, unlocked());
      const b = h(document, "button", { type: "button", class: "em-date", "aria-pressed": String(s.id === state.snapshot.id), "aria-label": s.date + (locked ? " (" + m.date.locked + ")" : ""), "data-locked": String(locked), text: s.date.slice(2).replace(/-/g, "/") + (locked ? " 🔒" : "") });
      b.addEventListener("click", () => requestDate(s.id));
      return b;
    }));
  }
  const playArea = h(document, "button", { type: "button", class: "button small-button", text: m.sound.play });
  const stopAll = h(document, "button", { type: "button", class: "button ghost small-button", text: m.sound.stop });
  const replay = h(document, "button", { type: "button", class: "button ghost small-button", text: m.sound.replay });
  playArea.addEventListener("click", () => api.playVisible?.());
  stopAll.addEventListener("click", () => { api.stopRun?.(true); audio.stop(); speech.cancel(); store.dispatch("STOP_SCAN"); });
  replay.addEventListener("click", () => { if (state.cursor) { if (!audio.enabled) setSound(true).then(() => soundForCursor(true)); else soundForCursor(true); } });
  el.wave = h(document, "canvas", { width: 360, height: 48, role: "img", "aria-label": c.sound.wave });
  el.measure = h(document, "p", { class: "small em-measure" });
  const bottom = h(document, "div", { class: "em-bottom" }, el.timeline, h(document, "div", { class: "em-bottom-row" }, playArea, stopAll, replay, el.wave, el.measure));
  let waveFrame = win.requestAnimationFrame(function loop() { drawWaveform(el.wave, audio.tap.analyser, { color: "#68e0d0" }); waveFrame = win.requestAnimationFrame(loop); });
  audio.transport.subscribe((snap) => { store.dispatch("SET_AUDIO", { audio: !audio.enabled ? AUDIO.MUTED : snap.status === "playing" ? AUDIO.PLAYING : snap.status === "paused" ? AUDIO.PAUSED : AUDIO.IDLE }); });

  function onDataChanged() {
    renderLegend();
    renderInfo();
    el.measure.textContent = T(m.sound.measure, { name: m.phen.measure[phen.id], unit: unitText() });
    document.getElementById("em-sound-meaning").textContent = m.phen.soundMeaning[phen.id];
    invalidate();
    for (const hook of state.dataHooks) hook();
    if (state.audio) state.onCursor?.(state.cursor);
  }

  // ---- Phenomenon switch (the dataset changes; position, tab, mode and sound settings stay)
  async function switchPhenomenon(id) {
    if (id === phen.id) return;
    speech.cancel();
    for (const b of Object.values(phenButtons)) b.disabled = true;
    el.sourceStatus.textContent = T(m.phen.loading, { name: m.phen[id] });
    try {
      const next = await pkg.openPhenomenon(id);
      const date = state.snapshot.date;
      const same = next.byDate(date);
      phen = next;
      state.comparison = null;
      state.pins = [];
      api.stopRun?.(true);
      const open = same && !isLocked(id, same.date, unlocked()) ? same : next.list.find((s) => s.date === DEFAULT_DATE && !isLocked(id, s.date, unlocked())) ?? next.list.find((s) => !isLocked(id, s.date, unlocked()));
      state.snapshot = open;
      store.dispatch("SELECT_DATASET", { datasetId: id, variable: next.spec.measure });
      for (const [key, b] of Object.entries(phenButtons)) b.setAttribute("aria-pressed", String(key === id));
      fillDates();
      el.date.value = open.id;
      applyLayer();
      renderTimeline();
      onDataChanged();
      for (const hook of api.phenomenonHooks ?? []) hook();
      for (const hook of state.phenHooks ?? []) hook();
      if (store.state.soundMode === GUIDED) speak(T(m.voice.phenomenon, { name: m.phen[id], measure: m.phen.measure[id], n: next.list.length }));
    } catch (error) {
      console.error(error);
      store.dispatch("DATA_ERROR", { message: String(error.message ?? error) });
      el.sourceStatus.textContent = m.phen.error;
    } finally {
      for (const b of Object.values(phenButtons)) b.disabled = false;
      renderStatus();
    }
  }

  // ---- Assemble
  el.tools = h(document, "aside", { class: "em-tools", id: "em-tools", "aria-label": m.tabs.label }, explorePanel, hunterPanel, echoPanel);
  const stage = h(document, "section", { class: "em-stage", "aria-label": m.title }, el.frame, el.note, el.legend, h(document, "p", { class: "small st-smoothing", text: fill(c.map.smoothing, { cellLat: trimNumber(size.lat), cellLon: trimNumber(size.lon) }) }));
  const infoCol = h(document, "aside", { class: "em-info" }, info, h(document, "section", { class: "panel" }, h(document, "h2", { text: c.help.title }), h(document, "ul", { class: "st-keys small", id: "st-keys" }, ...c.help.items.map((line) => h(document, "li", { text: line })))));
  root.replaceChildren(el.live, topbar, el.bar, h(document, "div", { class: "em-layout" }, el.tools, stage, infoCol), bottom, h(document, "p", { class: "credit", text: m.credit }));
  sheetToggle.addEventListener("click", () => { const open = el.tools.dataset.open !== "true"; el.tools.dataset.open = String(open); sheetToggle.setAttribute("aria-expanded", String(open)); sheetToggle.textContent = open ? m.mobile.closeTools : m.mobile.tools; });
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") speech.cancel(); });

  const api = {
    state, el, grid, bounds, c, T, document, win, audio, speech, store, pkg, language, setSound, setCursor, selectCell, setView, invalidate, toScreen, toGeo, fmt, fmtChange,
    layerValues, layerKind, applyLayer, onDataChanged, renderInfo, readText, tonesFor, slotFor, setTab, requestDate, switchPhenomenon, sampleName, explain, speak, guided,
    get phen() { return phen; }, get catalog() { return catalog(); }, get list() { return phen.list; }, get renderer() { return renderer; }, phenomenonId: () => phen.id,
    getSnapshot: async (id) => phen.snapshot(id),
    difference: (resolution) => pkg.difference(phen, resolution),
    refreshDateInfo: () => { el.dateInfo.textContent = ""; },
    setPins: (pins) => { state.pins = pins; invalidate(); },
    reduced,
    analysis: createAnalysisClient(),
    lockedDates: () => (phen.id === "dust" && !unlocked() ? [...DECODE_LOCKED_DATES] : []),
    refreshLocks: () => { fillDates(); renderTimeline(); for (const hook of state.lockHooks ?? []) hook(); if (state.snapshot && isLocked(phen.id, state.snapshot.date, unlocked())) requestDate(firstOpen().id); },
    playCurrent: () => soundForCursor(true),
    showValues: async (date) => {
      if (state.comparison) api.hideChange();
      const target = phen.byDate(date);
      if (target && state.snapshot.id !== target.id) await requestDate(target.id);
    },
    showChangeFor: async (firstDate, secondDate) => {
      const A = phen.byDate(firstDate)?.id;
      const B = phen.byDate(secondDate)?.id;
      if (!A || !B) return;
      if (state.comparison) {
        if (state.cmpSources?.a.id === A && state.cmpSources?.b.id === B) return;
        api.hideChange();
      }
      el.cmpA.value = A;
      el.cmpB.value = B;
      api.describeComparison();
      await api.showChange();
    },
  };
  makeRenderer(params.get("renderer") === "2d");
  new win.ResizeObserver(resize).observe(el.frame);
  fillDates();
  renderStatus();
  renderModeButton();
  renderTimeline();
  onDataChanged();
  win.addEventListener("resize", resize);
  win.document.addEventListener("visibilitychange", () => { if (!win.document.hidden) invalidate(); });
  mountTools(api);
  mountCompare(api);
  mountShare(api);
  mountHunter(api, hunterPanel);
  mountEcho(api, echoPanel);
  if (params.has("debug")) win.__studio = api;
  if (initialMode === GUIDED) speak(m.voice.welcome.GUIDED_VOICE);
  return api;
}
