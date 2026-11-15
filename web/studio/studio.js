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
import { copyFor } from "./studio-ui-copy.js";
import { ICON } from "./studio-icons.js";
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
  const m = copyFor(language);
  const overlay = h(document, "div", { class: "em-modal-backdrop" });
  const dialog = h(document, "div", { class: "em-modal", role: "dialog", "aria-modal": "true", "aria-labelledby": "em-mode-title" });
  const choice = (mode, title, text) => {
    const art = h(document, "span", { class: "em-choice-art", "aria-hidden": "true" });
    art.innerHTML = mode === GUIDED ? ICON.voice : ICON.waves;
    const button = h(document, "button", { type: "button", class: "em-choice", "data-mode": mode, "aria-pressed": String(current === mode) }, art, h(document, "strong", { text: title }), h(document, "span", { text }));
    button.addEventListener("click", () => { close(); onChoose(mode); });
    return button;
  };
  const buttons = [choice(GUIDED, m.mode.guided, m.mode.guidedText), choice(PURE, m.mode.pure, m.mode.pureText)];
  const closeButton = dismissable ? h(document, "button", { type: "button", class: "button ghost", text: m.mode.close }) : null;
  dialog.append(h(document, "h2", { id: "em-mode-title", text: m.mode.title }), h(document, "div", { class: "em-choices" }, ...buttons), h(document, "p", { class: "small", text: m.mode.note }), ...(closeButton ? [closeButton] : []));
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
  const language = mountNav(document, document.getElementById("site-nav"), { active: "studio", from: "pages", footer: false });
  const m = copyFor(language);
  document.title = m.title + " · EARTHPULSE";
  const root = document.getElementById("studio-root");
  document.body.classList.add("studio-page");
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
  const m = copyFor(language);
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
  el.frame = h(document, "div", { class: "st-map", dir: "ltr", tabindex: "0", role: "application", "aria-label": c.map.label, "aria-describedby": "st-map-hint" });
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
  function hoverPin(index) {
    if (state.hoverPin === index) return;
    state.hoverPin = index;
    for (const b of document.querySelectorAll(".em-result[data-index]")) b.classList.toggle("linked", index !== null && b.dataset.index === String(index));
    invalidate();
  }
  function pinHoverAt(p) {
    let found = null;
    for (const pin of state.pins) { const centre = cellCenter(grid, Math.floor(pin.index / grid.cols), pin.index % grid.cols); const s = toScreen(centre.lon, centre.lat); if (Math.hypot(s.x - p.x, s.y - p.y) < 16) { found = pin.index; break; } }
    hoverPin(found);
  }
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
      el.overlay.append(svg("circle", { cx: p.x, cy: p.y, r: pin.selected || state.hoverPin === pin.index ? 15 : 11, class: "st-pin st-pin-" + pin.kind + (pin.selected ? " active" : "") + (state.hoverPin === pin.index ? " hover" : "") }));
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
    const part = p.silent ? "" : p.rate ? " ⁦" + trimNumber(p.rate, 1) + "/s⁩" : p.frequencyHz ? " ⁦" + trimNumber(p.frequencyHz, 0) + " Hz⁩" : "";
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
    if (el.inspector) renderInspector();
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

  // ---- Legend (compact: title, gradient bar, ticks)
  el.legend = h(document, "div", { class: "st-legend" });
  function renderLegend() {
    const s = spec();
    const parts = [];
    if (!state.comparison) {
      const norm = normalizer(s);
      const stops = s.stops.map(([t, [r, g, b]]) => `rgb(${r},${g},${b}) ${(t * 100).toFixed(1)}%`).join(",");
      const ticks = s.ticks.map((v) => h(document, "span", { class: "tick ltr", style: `left:${norm(v) * 100}%`, text: String(v) }));
      parts.push(h(document, "p", { class: "st-legend-title", text: m.phen.short[phen.id] + " · " + unitText() }), h(document, "div", { class: "st-bar", style: `background:linear-gradient(90deg,${stops})`, "aria-hidden": "true" }), h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, ...ticks));
    } else {
      parts.push(h(document, "p", { class: "st-legend-title", text: c.legend.changeTitle + " · " + unitText() }), h(document, "div", { class: "st-bar st-bar-diff", "aria-hidden": "true" }),
        h(document, "div", { class: "st-ticks ltr", "aria-hidden": "true" }, h(document, "span", { class: "tick", style: "left:0%", text: "−" + s.change.max }), h(document, "span", { class: "tick", style: "left:50%", text: "0" }), h(document, "span", { class: "tick", style: "left:100%", text: "+" + s.change.max })));
    }
    parts.push(h(document, "span", { class: "st-legend-range ltr", "aria-hidden": "true", text: state.comparison ? "−" + s.change.max + " … +" + s.change.max : s.min + " … " + s.max }));
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
    const soundLabel = on ? m.sound.disable : m.sound.enable;
    el.soundButton.setAttribute("aria-label", soundLabel);
    el.soundButton.setAttribute("data-tip", soundLabel);
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
      if (event.pointerType === "mouse") { const cell = cursorAt(p.x, p.y); setCursor(cell, { outside: !cell }); pinHoverAt(p); }
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
  let trackpadUntil = 0;
  el.frame.addEventListener("wheel", (event) => {
    event.preventDefault();
    const p = local(event);
    const now = event.timeStamp;
    const scroll = !event.ctrlKey && event.deltaMode === 0 && (event.deltaX !== 0 || Math.abs(event.deltaY) < 40 || (Math.abs(event.deltaY) < 100 && now < trackpadUntil));
    if (scroll) { trackpadUntil = now + 120; setView(panBy(state.view, bounds, state.width, state.height, -event.deltaX, -event.deltaY), false); return; }
    zoomBy(Math.exp(-event.deltaY * (event.deltaMode === 1 ? 0.05 : event.ctrlKey ? 0.01 : 0.0016)), p.x, p.y, false);
  }, { passive: false });
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
    if (event.key === "Home") { event.preventDefault(); setView(initialView()); return; }
    if (event.key === "Escape") { speech.cancel(); return; }
    if ((event.key === "r" || event.key === "R") && state.cursor) { event.preventDefault(); explain(); return; }
    state.onKey?.(event);
  });

  // ---- Sound pill (top right over the map): on/off, Guided Voice | Pure Sonification, data volume
  el.soundButton = h(document, "button", { type: "button", class: "icon-btn st-sound-toggle", "aria-pressed": "false", "aria-label": m.sound.enable, "data-tip": m.sound.enable, "data-tip-pos": "below" });
  el.soundButton.innerHTML = ICON.sound;
  el.soundState = h(document, "p", { class: "visually-hidden", role: "status", "aria-live": "polite", text: m.sound.off });
  el.volume = h(document, "input", { type: "range", id: "st-volume", min: 0, max: 100, step: 1, value: Math.round(settings.volume * 100), "aria-label": m.voice.dataVolume });
  el.volume.addEventListener("input", () => { const v = Number(el.volume.value) / 100; audio.setVolume(v); saveSettings({ volume: v }); });
  speech.setSpeechVolume(settings.speechVolume);
  el.soundButton.addEventListener("click", () => setSound(!audio.enabled));
  el.wave = h(document, "canvas", { width: 120, height: 36, role: "img", "aria-label": c.sound.wave });
  el.modeSeg = h(document, "div", { class: "seg", role: "group", "aria-label": m.mode.title });
  const modeButtons = {};
  for (const [mode, label] of [[GUIDED, m.mode.guided], [PURE, m.mode.pure]]) {
    const b = h(document, "button", { type: "button", "aria-pressed": String(mode === store.state.soundMode), text: label });
    b.addEventListener("click", () => setSoundMode(mode));
    modeButtons[mode] = b;
    el.modeSeg.append(b);
  }
  function renderModeButton() { for (const [mode, b] of Object.entries(modeButtons)) b.setAttribute("aria-pressed", String(mode === store.state.soundMode)); }
  el.soundMore = h(document, "div", { class: "st-sound-more" }, el.modeSeg, el.volume);
  const soundPill = h(document, "div", { class: "st-tb-group st-sound", role: "group", "aria-label": c.sound.title }, el.soundButton, el.soundMore, el.soundState);
  el.voiceNote = h(document, "p", { class: "small", hidden: true, text: m.voice.unavailable });
  function setSoundMode(mode) {
    store.dispatch("SET_SOUND_MODE", { mode });
    speech.setMode(mode);
    el.status.setAttribute("aria-live", mode === GUIDED ? "polite" : "off");
    renderModeButton();
    el.live.textContent = m.mode.switched[mode];
    if (mode === GUIDED && state.cursor) speak(m.mode.switched[mode] + " " + readText(state.cursor));
  }

  // ---- Phenomena and date (top left over the map)
  const phenButtons = {};
  el.phenGroup = h(document, "div", { class: "seg", role: "group", "aria-label": m.phen.label });
  for (const id of PHENOMENON_IDS) {
    const b = h(document, "button", { type: "button", "aria-pressed": String(id === phen.id), text: m.phen.short[id], "data-phen": id });
    b.addEventListener("click", () => switchPhenomenon(id));
    phenButtons[id] = b;
    el.phenGroup.append(b);
  }
  const forests = h(document, "button", { type: "button", "aria-disabled": "true", "data-tip": m.phen.forestsReason, "data-tip-pos": "below", "aria-describedby": "st-forests-reason", text: m.phen.short.forests });
  el.forestsNote = h(document, "p", { class: "visually-hidden", id: "st-forests-reason", text: m.phen.forestsReason });
  forests.addEventListener("click", () => toast(m.phen.forestsReason));
  el.phenGroup.append(forests, el.forestsNote);
  el.date = h(document, "select", { id: "st-date", "aria-label": m.date.label });
  el.prev = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.date.prev, text: "‹" });
  el.next = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.date.next, text: "›" });
  el.dateInfo = h(document, "span", { class: "small st-dateinfo" });
  el.lock = h(document, "div", { class: "callout warn st-lock floating", role: "alert", hidden: true });
  function fillDates() {
    const seasonLabel = (season) => m.date.seasons[season.name] + " " + season.seasonYear;
    el.date.replaceChildren(...phen.seasons.map((season) => h(document, "optgroup", { label: seasonLabel(season) }, ...season.snapshotIds.map((id) => { const entry = phen.snapshot(id); return h(document, "option", { value: id, text: entry.date + (isLocked(phen.id, entry.date, unlocked()) ? " 🔒" : ""), selected: id === state.snapshot.id }); }))));
  }
  async function requestDate(id) {
    const entry = phen.snapshot(id);
    if (!entry) return;
    if (isLocked(phen.id, entry.date, unlocked())) {
      stopTime();
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
  el.timeButton = h(document, "button", { type: "button", class: "icon-btn st-time-open", "aria-expanded": "false", "aria-haspopup": "dialog", "aria-label": m.date.timeline, "data-tip": m.date.timeline, "data-tip-pos": "below" });
  el.timeButton.innerHTML = ICON.calendar;
  const topLeft = h(document, "div", { class: "st-tb-group st-tb-left" }, el.phenGroup, h(document, "div", { class: "st-datebox" }, el.prev, el.date, el.next, el.timeButton), el.dateInfo);

  // ---- Toasts and sheets
  let toastTimer = 0;
  function toast(text) {
    document.querySelectorAll(".toast").forEach((n) => n.remove());
    const node = h(document, "div", { class: "toast", role: "status", text });
    document.body.append(node);
    win.clearTimeout(toastTimer);
    toastTimer = win.setTimeout(() => node.remove(), 4200);
  }
  const holder = h(document, "div", { class: "st-holder", hidden: true });
  function openSheet(title, nodes, { onClose = () => {} } = {}) {
    const backdrop = h(document, "div", { class: "em-modal-backdrop" });
    const closeButton = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.mode.close });
    closeButton.innerHTML = ICON.close;
    const dialog = h(document, "div", { class: "em-modal st-sheet", role: "dialog", "aria-modal": "true", "aria-labelledby": "st-sheet-title" }, h(document, "div", { class: "st-sheet-head" }, h(document, "h2", { id: "st-sheet-title", text: title }), closeButton), ...nodes);
    backdrop.append(dialog);
    const previous = document.activeElement;
    const done = () => { for (const n of nodes) if (n.dataset?.park) holder.append(n); backdrop.remove(); document.removeEventListener("keydown", onKey, true); previous?.focus?.(); onClose(); };
    function onKey(event) { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); done(); } }
    closeButton.addEventListener("click", done);
    backdrop.addEventListener("click", (event) => { if (event.target === backdrop) done(); });
    document.addEventListener("keydown", onKey, true);
    document.body.append(backdrop);
    closeButton.focus();
    return { close: done };
  }
  info.dataset.park = "true";
  el.sourceStatus = h(document, "p", { class: "small st-source" });
  function renderStatus() {
    const verified = pkg.integrity.mode === "sha256" ? T(m.status.verified, { n: pkg.integrity.verified }) : m.status.verifyOff;
    el.sourceStatus.textContent = m.status.source + " · " + verified + (pkg.integrity.failed.length ? " · ⚠ " + pkg.integrity.failed.length : "");
  }
  const openComputed = () => openSheet(m.info.how, [el.sourceStatus, info]);
  const openHelp = () => {
    const mapping = h(document, "ul", { class: "st-help-list" }, ...PHENOMENON_IDS.map((id) => h(document, "li", {}, h(document, "strong", { text: m.phen[id] + ": " }), m.phen.soundMeaning[id])));
    const keys = h(document, "ul", { class: "st-help-list" }, ...m.help.shortcuts.map(([key, text]) => h(document, "li", {}, h(document, "span", { class: "kbd", text: key }), " " + text)));
    const notes = h(document, "ul", { class: "st-help-list" }, ...m.help.notes.map((line) => h(document, "li", { text: T(line, { cellLat: trimNumber(size.lat), cellLon: trimNumber(size.lon) }) })));
    const actions = h(document, "div", { class: "st-ins-actions" }, (() => { const b = h(document, "button", { type: "button", class: "button ghost small-button", text: m.voice.explain }); b.addEventListener("click", explain); return b; })(), (() => { const b = h(document, "button", { type: "button", class: "button ghost small-button", text: m.voice.help }); b.addEventListener("click", () => speech.say(m.voice.helpText[store.state.tool])); return b; })());
    return openSheet(m.help.title, [h(document, "h3", { text: m.help.mapping }), mapping, h(document, "h3", { text: m.help.keyboard }), keys, h(document, "h3", { text: m.help.data }), notes, h(document, "p", { class: "small" }, m.credit), h(document, "p", { class: "small" }, h(document, "a", { href: "../atlas.html", text: language === "ar" ? "الأرشيف: أطلس الصوت v1" : "Archive: Sound Atlas v1" })), actions]);
  };

  // ---- Inspector (right): value big, unit, location, time, model badge, one-line sound meaning
  el.insId = h(document, "h2", { class: "st-ins-id", id: "st-ins-title" });
  el.insValue = h(document, "strong", { class: "st-ins-number" });
  el.insUnit = h(document, "span", { class: "st-ins-unit" });
  el.insSub = h(document, "p", { class: "small st-ins-sub" });
  el.insWhere = h(document, "p", { class: "small ltr st-ins-where" });
  el.insWhen = h(document, "p", { class: "small st-ins-when", dir: "auto" });
  el.insSound = h(document, "p", { class: "small st-ins-sound" });
  const insListen = h(document, "button", { type: "button", class: "button small-button", text: m.sound.replay });
  const insHow = h(document, "button", { type: "button", class: "button ghost small-button", text: m.info.how });
  const insShare = h(document, "button", { type: "button", class: "button ghost small-button", text: c.share.copy });
  insListen.addEventListener("click", async () => { if (!state.cursor) return; if (!audio.enabled) await setSound(true); soundForCursor(true); });
  insHow.addEventListener("click", openComputed);
  insShare.addEventListener("click", () => api.copyLink?.());
  el.insCollapse = h(document, "button", { type: "button", class: "icon-btn st-collapse", "aria-expanded": "true", "aria-label": m.info.collapse });
  el.insCollapse.innerHTML = ICON.chevron;
  el.insBody = h(document, "div", { class: "st-ins-body" }, h(document, "div", { class: "st-ins-value" }, el.insValue, el.insUnit), el.insSub, el.insWhere, el.insWhen, el.insSound, h(document, "div", { class: "st-ins-actions" }, insListen, insHow, insShare));
  el.handle = h(document, "button", { type: "button", class: "st-handle", "aria-label": m.mobile.expand, "data-snap-control": "inspector" });
  el.inspector = h(document, "aside", { class: "st-inspector", "aria-labelledby": "st-ins-title", hidden: true, "data-snap": "peek" },
    h(document, "div", { class: "st-ins-head" }, el.insId, h(document, "span", { class: "chip" }, m.info.modelBadge), el.insCollapse), el.insBody);
  el.insCollapse.addEventListener("click", () => { const open = el.insBody.hidden; el.insBody.hidden = !open; el.insCollapse.setAttribute("aria-expanded", String(open)); });
  const snaps = ["peek", "half", "full"];
  const cycleSnap = (panel) => { panel.dataset.snap = snaps[(snaps.indexOf(panel.dataset.snap) + 1) % snaps.length]; };
  function renderInspector() {
    const cell = state.cursor ?? state.selected;
    const d = cell ? describeCell(cell) : null;
    el.inspector.hidden = !d;
    if (!d) return;
    el.insId.textContent = d.id;
    el.insValue.textContent = d.value === null ? "—" : d.kind === "change" ? fmtChange(d.value) : fmt(d.value);
    el.insUnit.textContent = d.value === null ? m.info.missing : unitText();
    const where = T("{lat}, {lon}", { lat: d.lat, lon: d.lon });
    const s = state.snapshot;
    el.insWhere.textContent = where;
    const range = h(document, "bdi", { dir: "ltr", text: formatUtcTime(s.time.start).replace(" UTC", "") + "–" + formatUtcTime(s.time.end) });
    el.insWhen.replaceChildren(dateOf(s) + " · ", range);
    el.insSub.textContent = state.cmpSources ? state.cmpSources.a.date + " → " + state.cmpSources.b.date + ": " + fmt(state.cmpSources.a.values[d.index]) + " → " + fmt(state.cmpSources.b.values[d.index]) : phen.id === "wind" && d.value !== null ? windText(d.index) : "";
    el.insSound.textContent = soundText(d);
    el.handle.setAttribute("aria-label", m.mobile.expand);
  }

  // ---- Tool rail and flyouts
  const toolDefs = [["explore", "tool"], ["area", "tool"], ["path", "tool"], ["compare", "flyout"], ["hunter", "flyout"], ["echo", "flyout"]];
  const railButtons = {};
  el.rail = h(document, "nav", { class: "st-tools-group", "aria-label": m.tabs.label });
  for (const [id] of toolDefs) {
    const b = h(document, "button", { type: "button", class: "icon-btn st-rail-button", "aria-pressed": String(id === "explore"), "aria-label": m.tools[id], "data-tip": m.tools[id], "data-tip-pos": "below", "data-id": id });
    b.innerHTML = ICON[id];
    b.addEventListener("click", () => openTool(id, { focus: true }));
    railButtons[id] = b;
    el.rail.append(b);
  }
  const helpButton = h(document, "button", { type: "button", class: "icon-btn st-rail-button st-rail-help", "aria-label": m.help.title, "data-tip": m.help.title, "data-tip-pos": "below" });
  helpButton.innerHTML = ICON.help;
  helpButton.addEventListener("click", openHelp);
  const hunterBox = h(document, "div", { id: "em-panel-hunter", class: "st-flyout-body" });
  const echoBox = h(document, "div", { id: "em-panel-echo", class: "st-flyout-body" });
  state.left = h(document, "div", { hidden: true }, h(document, "div"), h(document, "div"));
  state.right = h(document, "div", { hidden: true }, h(document, "div"), h(document, "div"));
  const flyoutClose = h(document, "button", { type: "button", class: "icon-btn", "aria-label": m.mode.close });
  flyoutClose.innerHTML = ICON.close;
  el.flyoutTitle = h(document, "h2", { id: "st-flyout-title", tabindex: "-1" });
  el.flyoutBody = h(document, "div", { class: "st-flyout-content" });
  el.flyoutHandle = h(document, "button", { type: "button", class: "st-handle", "aria-label": m.mobile.expand });
  el.flyout = h(document, "section", { class: "st-flyout", "aria-labelledby": "st-flyout-title", hidden: true, "data-snap": "half" }, h(document, "div", { class: "st-flyout-head" }, el.flyoutTitle, flyoutClose), el.flyoutBody);
  const introduced = new Set();
  let currentTool = "explore";
  function flyoutNodes(id) {
    if (id === "area") return [api.panels.area, api.panels.run];
    if (id === "path") return [api.panels.path, api.panels.run];
    if (id === "compare") return [api.panels.compare];
    if (id === "hunter") return [hunterBox];
    if (id === "echo") return [echoBox];
    return [];
  }
  function openTool(id, { focus = false } = {}) {
    currentTool = id;
    state.compareActive = id === "compare";
    el.side.dataset.tool = id;
    speech.cancel();
    for (const [key, b] of Object.entries(railButtons)) b.setAttribute("aria-pressed", String(key === id));
    const mapTool = id === "area" || id === "path" ? id : "explore";
    api.setTool?.(mapTool);
    const storeTool = id === "hunter" ? TOOLS.HUNTER : id === "echo" ? TOOLS.ECHO : TOOLS.EXPLORE;
    store.dispatch("SET_TOOL", { tool: storeTool });
    const nodes = flyoutNodes(id);
    el.flyout.hidden = nodes.length === 0;
    el.frame.dataset.tool = mapTool;
    el.frame.dataset.tab = storeTool;
    if (nodes.length) {
      el.flyoutTitle.textContent = m.tools[id];
      el.flyoutBody.replaceChildren(...nodes);
      el.flyout.dataset.snap = "half";
      if (focus) el.flyoutTitle.focus();
    } else if (focus) railButtons.explore.focus();
    el.rail.dataset.open = "false";
    if (nodes.length) setSide(true);
    if (storeTool !== TOOLS.EXPLORE && !introduced.has(storeTool) && store.state.soundMode === GUIDED) { introduced.add(storeTool); speak(m.voice.toolIntro[storeTool]); }
    state.tabHooks?.[storeTool]?.();
    invalidate();
  }
  const setTab = (tool) => openTool(tool === TOOLS.HUNTER ? "hunter" : tool === TOOLS.ECHO ? "echo" : "explore");
  const closeFlyout = () => { const opener = railButtons[currentTool]; openTool("explore"); opener?.focus(); };
  flyoutClose.addEventListener("click", closeFlyout);
  el.flyout.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeFlyout(); } });

  // ---- Zoom cluster (bottom right) and the timeline (bottom)
  const clusterButton = (label, html, handler) => { const b = h(document, "button", { type: "button", class: "icon-btn", "aria-label": label, "data-tip": label }); b.innerHTML = html; b.addEventListener("click", handler); return b; };
  el.compass.remove();
  el.compassButton = clusterButton(m.compass, ICON.compass, () => setView(initialView()));
  el.cluster = h(document, "div", { class: "st-cluster", role: "group", "aria-label": c.zoom.label }, clusterButton(c.zoom.in, "+", () => zoomBy(1.5)), clusterButton(c.zoom.out, "−", () => zoomBy(1 / 1.5)), el.compassButton);
  el.timeline = h(document, "div", { class: "st-ticks-row", role: "group", "aria-label": m.date.timeline });
  function renderTimeline() {
    el.timeline.replaceChildren(...phen.seasons.map((season) => h(document, "div", { class: "st-season" }, h(document, "span", { class: "st-season-label", text: m.date.seasons[season.name] }),
      h(document, "div", { class: "st-season-dates" }, ...season.snapshotIds.map((id) => {
        const s = phen.snapshot(id);
        const locked = isLocked(phen.id, s.date, unlocked());
        const b = h(document, "button", { type: "button", class: "st-date", "aria-pressed": String(s.id === state.snapshot.id), "aria-label": s.date + (locked ? " (" + m.date.locked + ")" : ""), "data-locked": String(locked), text: s.date.slice(5) });
        b.addEventListener("click", () => { stopTime(); requestDate(s.id); });
        return b;
      })))));
  }
  let timeTimer = 0;
  el.timePlay = h(document, "button", { type: "button", class: "icon-btn st-time-play", "aria-pressed": "false", "aria-label": m.sound.timePlay, "data-tip": m.sound.timePlay });
  el.timePlay.innerHTML = ICON.play;
  function stopTime() { win.clearInterval(timeTimer); timeTimer = 0; el.timePlay.setAttribute("aria-pressed", "false"); el.timePlay.innerHTML = ICON.play; el.timePlay.setAttribute("aria-label", m.sound.timePlay); }
  function startTime() {
    const open = phen.list.filter((s) => !isLocked(phen.id, s.date, unlocked()));
    if (open.length < 2) return;
    let i = open.findIndex((s) => s.id === state.snapshot.id);
    if (i < 0 || i >= open.length - 1) { i = -1; }
    el.timePlay.setAttribute("aria-pressed", "true");
    el.timePlay.innerHTML = ICON.pause;
    el.timePlay.setAttribute("aria-label", m.sound.timePause);
    const advance = () => { i += 1; if (i >= open.length) { stopTime(); return; } requestDate(open[i].id); };
    advance();
    timeTimer = win.setInterval(advance, 1500);
  }
  el.timePlay.addEventListener("click", () => (timeTimer ? stopTime() : startTime()));
  el.timePop = h(document, "div", { class: "st-timepop", role: "dialog", "aria-label": m.date.timeline, hidden: true }, el.timeline, el.timePlay);
  function closeTimePop(focus) { if (el.timePop.hidden) return; el.timePop.hidden = true; el.timeButton.setAttribute("aria-expanded", "false"); if (focus) el.timeButton.focus(); }
  el.timeButton.addEventListener("click", () => { const open = el.timePop.hidden; el.timePop.hidden = !open; el.timeButton.setAttribute("aria-expanded", String(open)); if (open) el.timePop.querySelector('[aria-pressed="true"]')?.focus?.(); });
  el.timePop.addEventListener("keydown", (event) => { if (event.key === "Escape") { event.stopPropagation(); closeTimePop(true); } });
  document.addEventListener("pointerdown", (event) => { if (!el.timePop.hidden && !el.timePop.contains(event.target) && !el.timeButton.contains(event.target)) closeTimePop(false); });
  let waveFrame = win.requestAnimationFrame(function loop() { if (audio.enabled) drawWaveform(el.wave, audio.tap.analyser, { color: "#68e0d0" }); waveFrame = win.requestAnimationFrame(loop); });
  audio.transport.subscribe((snap) => { store.dispatch("SET_AUDIO", { audio: !audio.enabled ? AUDIO.MUTED : snap.status === "playing" ? AUDIO.PLAYING : snap.status === "paused" ? AUDIO.PAUSED : AUDIO.IDLE }); });

  function onDataChanged() {
    renderLegend();
    renderInfo();
    invalidate();
    for (const hook of state.dataHooks) hook();
    if (state.audio) state.onCursor?.(state.cursor);
  }
  const initialView = () => clampView(createView(bounds), bounds, state.width, state.height); // the whole coverage fits (contain)


  // ---- Phenomenon switch (the dataset changes; position, tool, mode and sound settings stay)
  async function switchPhenomenon(id) {
    if (id === phen.id) return;
    speech.cancel();
    stopTime();
    for (const b of Object.values(phenButtons)) b.disabled = true;
    el.sourceStatus.textContent = T(m.phen.loading, { name: m.phen[id] });
    try {
      const next = await pkg.openPhenomenon(id);
      const date = state.snapshot.date;
      const same = next.byDate(date);
      phen = next;
      state.comparison = null;
      state.cmpSources = null;
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
      toast(m.phen.error);
    } finally {
      for (const b of Object.values(phenButtons)) b.disabled = false;
      renderStatus();
    }
  }

  // ---- Assemble: the map is the page; everything else floats over it
  el.hint = h(document, "p", { class: "visually-hidden", id: "st-map-hint", text: m.help.mapHint });
  el.toolsMenuButton = h(document, "button", { type: "button", class: "button ghost small-button st-tools-open", "aria-expanded": "false", "aria-haspopup": "true", text: m.mobile.tools });
  el.toolsMenuButton.addEventListener("click", () => { const open = el.rail.dataset.open !== "true"; el.rail.dataset.open = String(open); el.toolsMenuButton.setAttribute("aria-expanded", String(open)); });
  el.rail.dataset.open = "false";
  const toolsWrap = h(document, "div", { class: "st-tools-wrap" }, el.toolsMenuButton, el.rail);
  const toolbar = h(document, "div", { class: "st-toolbar" }, topLeft, h(document, "div", { class: "st-tb-spacer" }), toolsWrap, soundPill, helpButton);
  const small = win.matchMedia?.("(max-width: 767px)");
  const placeMore = () => { if (small?.matches) el.rail.append(el.soundMore); else el.soundButton.after(el.soundMore); };
  small?.addEventListener?.("change", placeMore);
  placeMore();
  el.sideToggle = h(document, "button", { type: "button", class: "icon-btn st-side-toggle", "aria-controls": "st-side" });
  el.sideToggle.innerHTML = ICON.chevron;
  el.sideHandle = h(document, "button", { type: "button", class: "st-handle", "aria-label": m.mobile.expand });
  el.side = h(document, "aside", { class: "st-side", id: "st-side", "aria-label": m.info.title, "data-snap": "half" }, el.sideHandle, h(document, "div", { class: "st-side-scroll" }, el.inspector, el.flyout));
  const app = h(document, "div", { class: "st-app" }, toolbar,
    h(document, "div", { class: "st-body" }, h(document, "div", { class: "st-mapzone" }, el.frame, el.hint, el.legend, el.cluster, el.sideToggle, el.lock, el.note), el.side), el.timePop);
  function setSide(open) {
    app.dataset.side = open ? "open" : "closed";
    el.side.dataset.open = String(open);
    el.sideToggle.setAttribute("aria-expanded", String(open));
    const label = open ? m.info.panelHide : m.info.panelShow;
    el.sideToggle.setAttribute("aria-label", label);
    el.sideToggle.setAttribute("data-tip", label);
    app.dataset.snap = el.side.dataset.snap;
    invalidate();
  }
  el.sideToggle.addEventListener("click", () => setSide(el.side.dataset.open !== "true"));
  el.sideHandle.addEventListener("click", () => { cycleSnap(el.side); app.dataset.snap = el.side.dataset.snap; });
  setSide(win.innerWidth >= 1280 && win.innerHeight >= 700);
  root.replaceChildren(el.live, app, holder);
  holder.append(info);
  document.addEventListener("keydown", (event) => { if (event.key === "Escape") { speech.cancel(); if (!el.timePop.hidden) closeTimePop(true); else if (el.rail.dataset.open === "true") { el.rail.dataset.open = "false"; el.toolsMenuButton.focus(); } else if (el.side.dataset.open === "true" && el.side.contains(document.activeElement) && el.flyout.hidden) { setSide(false); el.sideToggle.focus(); } } if (event.key === "?" && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName ?? "")) { event.preventDefault(); openHelp(); } });
  win.addEventListener("earthpulse:settings", (event) => { const s = event.detail; audio.setVolume(s.volume); speech.setSpeechVolume(s.speechVolume); el.volume.value = String(Math.round(s.volume * 100)); });


  // First load: a real value is already in the inspector (nearest data cell to the centre of the coverage), sound off.
  function selectDefaultCell() {
    const cr = Math.floor(grid.rows / 2);
    const cc = Math.floor(grid.cols / 2);
    const values = layerValues();
    for (let radius = 0; radius < Math.max(grid.rows, grid.cols); radius++) {
      for (let dr = -radius; dr <= radius; dr++) {
        for (let dc = -radius; dc <= radius; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== radius) continue;
          const row = cr + dr; const col = cc + dc;
          if (row < 0 || col < 0 || row >= grid.rows || col >= grid.cols) continue;
          const index = row * grid.cols + col;
          if (values[index] !== null && values[index] !== undefined && !Number.isNaN(values[index])) { selectCell({ row, col, index }, { play: false, say: false, user: false }); return; }
        }
      }
    }
  }

  const api = {
    panels: {}, toast, hoverPin, unitText, phenName: () => m.phen[phen.id], dateText: () => dateOf(state.snapshot), state, el, grid, bounds, c, T, document, win, audio, speech, store, pkg, language, setSound, setCursor, selectCell, setView, invalidate, toScreen, toGeo, fmt, fmtChange,
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
  setSound(false);
  win.addEventListener("resize", resize);
  win.document.addEventListener("visibilitychange", () => { if (!win.document.hidden) invalidate(); });
  mountTools(api);
  mountCompare(api);
  mountShare(api);
  mountHunter(api, hunterBox);
  mountEcho(api, echoBox);
  setView(initialView(), false);
  openTool("explore");
  selectDefaultCell();
  if (params.has("debug")) win.__studio = api;
  if (initialMode === GUIDED) speak(m.voice.welcome.GUIDED_VOICE);
  return api;
}
