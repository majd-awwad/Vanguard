// Explore Earth: the learning page. Dust, Rainfall and Wind from the verified package (the same loaders, scales, sound engine and
// meaning phrases as the Sound Studio). No levels, no scores, no profiles: when you are ready, Decode is one button away.
import { drawWaveform } from "../audio-tap.js";
import { DOCUMENTED_BREAKPOINTS, levelFor } from "../../studio/ambience-core.js";
import { DECODE_LOCKED_DATES, PHENOMENA, isLocked, normalizer, openPackage, rampFromStops } from "../../studio/datasets.js";
import { lonPan } from "../../studio/mapping.js";
import { meaningLevel, meaningPhrase } from "../../studio/meaning.js";
import { createRecordings } from "../../studio/recordings.js";
import { dryNotice, isDryValue } from "../../studio/signal-core.js";
import { directionFrom } from "../../experiences/levels/aggregate.js";
import { cellBounds, cellId, formatLat, formatLon, formatUtcDate, textureCrop, trimNumber } from "./cells.js";
import { h } from "./dom.js";
import { exploreCopy } from "./explore-copy.js";
import { mountNav } from "./nav.js";
import { allowSpoilersThisVisit, isDecodeFinished, spoilersUnlocked } from "./progress.js";
import { loadSettings, saveSettings } from "./settings.js";

export const PHENOMENA_ORDER = Object.freeze(["dust", "rainfall", "wind"]);
const TEXTURE = "../assets/earth/blue-marble-4096.jpg";
const BOUNDS = Object.freeze({ north: 45, south: 15, west: -20, east: 50 });
const ROWS = 25;
const COLS = 40;
const DEFAULT_DATE = { dust: "2025-04-15", rainfall: "2025-08-15", wind: "2025-04-15" };
const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
const COMPASS_EN = { N: "north", NE: "north-east", E: "east", SE: "south-east", S: "south", SW: "south-west", W: "west", NW: "north-west" };
const COMPASS_AR = { N: "الشمال", NE: "الشمال الشرقي", E: "الشرق", SE: "الجنوب الشرقي", S: "الجنوب", SW: "الجنوب الغربي", W: "الغرب", NW: "الشمال الغربي" };
const fill = (text, tokens = {}) => String(text).replace(/\{(\w+)\}/g, (m, key) => (key in tokens ? tokens[key] : m));

/** Numerical difference and which place is higher; pure so it can be tested. */
export function compareValues(a, b) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return { difference: Math.abs(a - b), higher: a === b ? null : a > b ? "a" : "b" };
}

export function startExplore(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "explore", from: "pages" });
  const c = exploreCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("explore-root");
  if (spoilersUnlocked()) return mountExplore(document, root, language);
  const show = h(document, "button", { type: "button", class: "button ghost", text: c.lock.show });
  show.addEventListener("click", () => { allowSpoilersThisVisit(); mountExplore(document, root, language); });
  root.replaceChildren(h(document, "section", { class: "panel lock", "aria-labelledby": "lock-title" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", { id: "lock-title", text: c.lock.title }), h(document, "p", { class: "lede", text: c.lock.text }),
    h(document, "div", { class: "actions" }, h(document, "a", { class: "button", href: "./decode.html", text: c.lock.decode }), show)));
  return Promise.resolve();
}

async function mountExplore(document, root, language) {
  const c = exploreCopy[language];
  const settings = loadSettings();
  const compassName = language === "ar" ? COMPASS_AR : COMPASS_EN;
  root.replaceChildren(h(document, "p", { class: "status", role: "status", text: c.loading }));
  let pkg;
  const phens = {};
  try {
    pkg = await openPackage();
    for (const id of PHENOMENA_ORDER) phens[id] = await pkg.openPhenomenon(id);
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: c.retry });
    retry.addEventListener("click", () => location.reload());
    root.replaceChildren(h(document, "p", { class: "status", role: "alert", text: c.error }), retry);
    return;
  }
  const rec = createRecordings({ baseUrl: new URL("../../assets/ambient/", import.meta.url), reduced: () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true });
  rec.setVolume(settings.volume);
  const state = { id: new URL(document.URL).searchParams.get("phen"), snapshot: null, a: null, b: null, pickingB: false };
  if (!PHENOMENA_ORDER.includes(state.id)) state.id = "dust";
  const finished = isDecodeFinished();
  const phen = () => phens[state.id];
  const spec = () => PHENOMENA[state.id];
  const unit = () => c.phen[state.id].unit;
  const values = () => state.snapshot.values;
  const fmt = (v) => (v === null || !Number.isFinite(v) ? "—" : String(Number(v.toFixed(spec().decimals))));
  const locked = (date) => isLocked(state.id, date, finished);
  const firstOpen = (id) => { const list = phens[id].list; return list.find((s) => s.date === DEFAULT_DATE[id] && !isLocked(id, s.date, finished)) ?? list.find((s) => !isLocked(id, s.date, finished)); };
  state.snapshot = firstOpen(state.id);
  const el = {};
  const centreOf = (index) => ({ lat: BOUNDS.north - ((Math.floor(index / COLS) + 0.5) * 30) / ROWS, lon: BOUNDS.west + (((index % COLS) + 0.5) * 70) / COLS });
  const idOf = (index) => cellId(Math.floor(index / COLS), index % COLS);
  const grid = phens.dust.grid;
  const levelOfValue = (v) => levelFor({ phenomenon: state.id, value: Number.isFinite(v) ? v : null, breakpoints: DOCUMENTED_BREAKPOINTS[state.id] });

  // ---- left: phenomenon, date, what it is
  const tabs = h(document, "div", { class: "seg xp-tabs", role: "group", "aria-label": c.tabs.label });
  const tabButtons = {};
  for (const id of PHENOMENA_ORDER) { const b = h(document, "button", { type: "button", "aria-pressed": id === state.id, "data-phen": id, text: c.tabs[id] }); b.addEventListener("click", () => switchTo(id)); tabButtons[id] = b; tabs.append(b); }
  el.date = h(document, "select", { id: "xp-date", "aria-label": c.date.label });
  el.dry = h(document, "div", { class: "callout", role: "status", hidden: true });
  el.about = h(document, "section", { class: "panel xp-dataset", "aria-labelledby": "xp-about-title" });
  el.learn = h(document, "section", { class: "panel xp-learn", "aria-labelledby": "xp-learn-title" });
  const left = h(document, "div", { class: "xp-left" }, h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", {}, c.titleLead + " ", h(document, "em", { text: c.titleAccent })), h(document, "p", { class: "lede", text: c.lede }),
    tabs, h(document, "label", { class: "xp-pick", for: "xp-date" }, h(document, "span", { text: c.date.label }), el.date), h(document, "p", { class: "small", text: c.date.note }), el.dry, el.about, el.learn);

  // ---- centre: the map with the data colours
  el.stage = h(document, "div", { class: "xp-stage xp-live-stage", dir: "ltr", "data-renderer": "svg" });
  const crop = textureCrop(BOUNDS);
  Object.assign(el.stage.style, { aspectRatio: String(crop.aspect), backgroundImage: `url("${TEXTURE}")`, backgroundSize: `${crop.sizeX}% ${crop.sizeY}%`, backgroundPosition: `${crop.posX}% ${crop.posY}%` });
  el.canvas = h(document, "canvas", { class: "xp-map-canvas", tabindex: 0, role: "application", "aria-roledescription": "map", "aria-label": c.map.label, "aria-describedby": "xp-help" });
  el.stage.append(el.canvas);
  el.hover = h(document, "p", { class: "xp-hover small", "aria-hidden": "true" });
  el.legend = h(document, "div", { class: "xp-legend panel" });
  el.reading = h(document, "p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  const compass = h(document, "div", { class: "xp-compass", role: "img", "aria-label": c.map.compass }, h(document, "span", { "aria-hidden": "true", text: c.map.north }), h(document, "span", { class: "needle", "aria-hidden": "true", text: "↑" }));
  const centre = h(document, "section", { class: "xp-centre", "aria-label": c.title }, h(document, "div", { class: "xp-stage-box" }, el.stage, compass), el.hover, h(document, "p", { class: "small", id: "xp-help", text: c.map.help }), el.legend, el.reading);

  // ---- right: selected place, listen, compare, call to action
  el.selected = h(document, "section", { class: "xp-part", "aria-labelledby": "xp-sel-title" });
  el.listen = h(document, "section", { class: "xp-part", "aria-labelledby": "xp-listen-title" });
  el.compare = h(document, "section", { class: "xp-part", "aria-labelledby": "xp-compare-title" });
  const cta = h(document, "section", { class: "panel xp-cta", "aria-labelledby": "xp-cta-title" }, h(document, "h2", { id: "xp-cta-title", text: c.cta.title }), h(document, "p", { text: c.cta.text }), h(document, "a", { class: "button", href: "./decode.html", text: c.cta.button }));
  const right = h(document, "div", { class: "xp-right" }, h(document, "section", { class: "panel xp-card" }, el.selected, el.listen, el.compare), cta);
  root.replaceChildren(h(document, "div", { class: "xp-layout" }, left, centre, right), h(document, "p", { class: "credit", text: c.credit }));

  // ---- colours
  let ramp = null;
  let norm = null;
  const rgbOf = (value) => { const t = Math.round(norm(value) * 255); return [ramp[t * 4], ramp[t * 4 + 1], ramp[t * 4 + 2]]; };
  function draw() {
    const w = el.stage.clientWidth || 640;
    const hgt = el.stage.clientHeight || Math.round(w / crop.aspect);
    const dpr = Math.min(2, globalThis.devicePixelRatio || 1);
    el.canvas.width = Math.round(w * dpr); el.canvas.height = Math.round(hgt * dpr);
    const ctx = el.canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const cw = w / COLS, ch = hgt / ROWS;
    const v = values();
    for (let i = 0; i < ROWS * COLS; i++) {
      const value = v[i];
      const x = (i % COLS) * cw, y = Math.floor(i / COLS) * ch;
      if (!Number.isFinite(value)) { ctx.fillStyle = "rgba(0,0,0,.55)"; ctx.fillRect(x, y, cw + 0.5, ch + 0.5); continue; }
      const dry = isDryValue(state.id, value);
      const [r, g, b] = rgbOf(value);
      ctx.fillStyle = `rgba(${r},${g},${b},${dry ? 0.18 : 0.8})`;
      ctx.fillRect(x, y, cw + 0.5, ch + 0.5);
    }
    const outline = (index, colour) => { if (index === null) return; ctx.lineWidth = 3; ctx.strokeStyle = colour; ctx.strokeRect((index % COLS) * cw + 1.5, Math.floor(index / COLS) * ch + 1.5, cw - 3, ch - 3); };
    outline(state.b, "#ffcb86"); outline(state.a, "#68e0d0");
  }

  // ---- renderers
  function renderLegend() {
    const s = spec();
    const stops = s.stops.map(([t, rgb]) => `rgb(${rgb.join(",")}) ${(t * 100).toFixed(1)}%`).join(",");
    const ticks = s.ticks.map((v) => h(document, "span", { class: "tick ltr", style: `left:${norm(v) * 100}%`, text: String(v) }));
    el.legend.replaceChildren(h(document, "p", { class: "st-legend-title", text: fill(c.map.legend, { unit: unit() }) }), h(document, "div", { class: "xp-bar-scale", style: `background:linear-gradient(90deg,${stops})`, "aria-hidden": "true" }), h(document, "div", { class: "xp-ticks ltr", "aria-hidden": "true" }, ...ticks),
      h(document, "p", { class: "small ltr", "aria-hidden": "true", text: `${s.min} … ${s.max} ${unit()}` }));
  }
  function renderAbout() {
    const p = c.phen[state.id];
    const s = state.snapshot;
    el.about.replaceChildren(h(document, "h2", { id: "xp-about-title", text: c.dataset.title }), h(document, "dl", { class: "kv" },
      h(document, "dt", { text: c.dataset.source }), h(document, "dd", { class: "ltr", text: c.dataset.sourceValue }), h(document, "dt", { text: c.dataset.region }), h(document, "dd", { text: c.dataset.regionValue }),
      h(document, "dt", { text: c.dataset.cells }), h(document, "dd", { text: c.dataset.cellsValue }), h(document, "dt", { text: c.dataset.variable }), h(document, "dd", { class: "ltr", text: p.variable }),
      h(document, "dt", { text: c.dataset.unit }), h(document, "dd", { text: p.unit }), h(document, "dt", { text: c.dataset.window }), h(document, "dd", { text: p.window + " · " + formatUtcDate(s.time.start, language) })));
    el.learn.replaceChildren(h(document, "h2", { id: "xp-learn-title", text: p.name }),
      h(document, "h3", { text: language === "ar" ? "ما هو؟" : "What it is" }), h(document, "p", { text: p.what }),
      h(document, "h3", { text: language === "ar" ? "ماذا تعني القيم العالية والمنخفضة؟" : "What high and low mean" }), h(document, "p", { text: p.highLow }),
      h(document, "h3", { text: language === "ar" ? "لماذا تختلف المناطق؟" : "Why regions differ" }), h(document, "p", { text: p.why }),
      h(document, "h3", { text: language === "ar" ? "كيف يُحوَّل إلى صوت؟" : "How it sounds" }), h(document, "p", { text: p.sound }));
  }
  function renderDates() {
    el.date.replaceChildren();
    for (const s of phen().list) {
      const lock = locked(s.date);
      el.date.append(h(document, "option", { value: s.id, disabled: lock, selected: s.id === state.snapshot.id, text: formatUtcDate(s.time.start, language) + (lock ? " — " + c.date.locked : "") }));
    }
  }
  function renderDry() {
    const notice = dryNotice({ phenomenon: state.id, list: phen().list, currentId: state.snapshot.id, exclude: finished ? [] : DECODE_LOCKED_DATES.filter(() => state.id === "dust") });
    el.dry.hidden = !notice;
    if (!notice) return;
    const words = c.dry[state.id];
    const buttons = notice.suggestions.map((s) => { const b = h(document, "button", { type: "button", class: "button ghost small-button", text: fill(words.pick, { date: formatUtcDate(phen().snapshot(s.id).time.start, language), n: Math.round(s.share * 100) }) }); b.addEventListener("click", () => setDate(s.id)); return b; });
    el.dry.replaceChildren(h(document, "p", { text: words.notice }), h(document, "div", { class: "actions" }, ...buttons));
  }
  const readingOf = (index) => {
    const v = values()[index];
    const mean = meaningPhrase({ phenomenon: state.id, value: Number.isFinite(v) ? v : null, language });
    const center = centreOf(index);
    return [mean, Number.isFinite(v) ? fmt(v) + " " + unit() : null, `${formatLat(Math.round(center.lat * 10) / 10)}, ${formatLon(Math.round(center.lon * 10) / 10)}`].filter(Boolean).join(". ") + ".";
  };
  function windFrom(index) {
    const s = state.snapshot;
    return directionFrom(s.measures.uMps[index], s.measures.vMps[index]);
  }
  function badge(index) {
    const v = values()[index];
    const level = meaningLevel({ phenomenon: state.id, value: Number.isFinite(v) ? v : null });
    return h(document, "p", { class: "xp-badge", dir: "auto", "data-level": level, "data-kind": state.id, text: meaningPhrase({ phenomenon: state.id, value: Number.isFinite(v) ? v : null, language }) });
  }
  function renderSelected() {
    const parts = [h(document, "h2", { id: "xp-sel-title", text: c.selected.title })];
    if (state.a === null) parts.push(h(document, "p", { text: c.selected.none }));
    else {
      const i = state.a;
      const v = values()[i];
      const b = cellBounds(BOUNDS, { rows: ROWS, cols: COLS }, Math.floor(i / COLS), i % COLS);
      const level = levelOfValue(v);
      const dir = state.id === "wind" && Number.isFinite(v) ? windFrom(i) : undefined;
      parts.push(h(document, "div", { class: "xp-cell-head" }, h(document, "span", { class: "xp-cell-id", text: idOf(i) }), badge(i)),
        h(document, "dl", { class: "kv" }, h(document, "dt", { text: c.selected.value }), h(document, "dd", { class: "ltr xp-value", text: Number.isFinite(v) ? fmt(v) + " " + unit() : c.selected.missing }),
          h(document, "dt", { text: c.selected.where }), h(document, "dd", { class: "ltr", text: `${formatLat(b.south)} – ${formatLat(b.north)}, ${formatLon(b.west)} – ${formatLon(b.east)}` }),
          h(document, "dt", { text: c.selected.when }), h(document, "dd", { text: formatUtcDate(state.snapshot.time.start, language) })),
        h(document, "p", { class: "small", text: !Number.isFinite(v) ? "" : level ? fill(c.selected.sound, { level: c.levelWord[level] }) : c.selected.silent }),
        dir !== undefined ? h(document, "p", { class: "small", text: dir === null ? c.selected.calm : fill(c.selected.dir, { dir: compassName[COMPASS[Math.round(dir / 45) % 8]], deg: Math.round(dir) }) }) : null);
    }
    el.selected.replaceChildren(...parts.filter(Boolean));
  }
  function renderCompare() {
    const parts = [h(document, "h2", { id: "xp-compare-title", text: c.compare.title })];
    const pick = h(document, "button", { type: "button", class: "button ghost", "aria-pressed": state.pickingB, text: state.pickingB ? c.compare.picking : c.compare.pick });
    pick.disabled = state.a === null;
    pick.addEventListener("click", () => { state.pickingB = !state.pickingB; renderCompare(); });
    const clear = h(document, "button", { type: "button", class: "button ghost", text: c.compare.clear });
    clear.hidden = state.b === null;
    clear.addEventListener("click", () => { state.b = null; state.pickingB = false; renderCompare(); draw(); });
    const hear = h(document, "button", { type: "button", class: "button", text: c.compare.hear });
    hear.disabled = state.a === null || state.b === null;
    hear.addEventListener("click", () => { hearCell(state.a, 1.4); clearTimeout(second); second = setTimeout(() => hearCell(state.b, 1.4), 1900); });
    parts.push(h(document, "div", { class: "player-buttons" }, pick, clear, hear));
    if (state.a !== null && state.b !== null) {
      const va = values()[state.a], vb = values()[state.b];
      const result = compareValues(va, vb);
      const max = Math.max(...[va, vb].filter(Number.isFinite), 1e-9);
      const bar = (index, value, tag) => h(document, "div", { class: "xp-bar-row" }, h(document, "span", { class: "ltr", text: tag + " · " + idOf(index) }), h(document, "div", { class: "xp-bar-track", "aria-hidden": "true" }, h(document, "div", { class: "xp-bar", style: `width:${Number.isFinite(value) ? Math.max(2, (value / max) * 100) : 0}%` })), h(document, "span", { class: "ltr", text: fmt(value) }));
      parts.push(h(document, "div", { class: "xp-chart", role: "img", "aria-label": `${c.compare.chart}: ${idOf(state.a)} ${fmt(va)}, ${idOf(state.b)} ${fmt(vb)}` }, bar(state.a, va, c.compare.a), bar(state.b, vb, c.compare.b)));
      if (result) parts.push(h(document, "p", { class: "xp-diff" }, h(document, "span", { text: c.compare.diff + ": " }), h(document, "strong", { class: "ltr", text: trimNumber(result.difference, spec().decimals) + " " + unit() }), " · " + (result.higher ? fill(c.compare.higher, { id: idOf(result.higher === "a" ? state.a : state.b) }) : c.compare.equal)));
      else parts.push(h(document, "p", { class: "small", text: c.selected.missing }));
      parts.push(h(document, "p", { class: "small", text: fill(c.compare.unit, { unit: unit() }) }));
    } else parts.push(h(document, "p", { class: "small", text: c.compare.needBoth }));
    el.compare.replaceChildren(...parts);
  }
  let second = 0;
  function hearCell(index, seconds = 1.8) {
    const v = values()[index];
    const level = levelOfValue(v);
    const center = centreOf(index);
    rec.unlock().then(() => rec.preview(phen().id, level, lonPan(grid, center.lon), seconds)).catch(() => {});
    el.state.textContent = level ? c.listen.playing : c.listen.ready;
    return level;
  }
  // ---- listen panel (built once)
  el.state = h(document, "span", { class: "player-state", role: "status" });
  const play = h(document, "button", { type: "button", class: "button", text: c.listen.play });
  const stop = h(document, "button", { type: "button", class: "button ghost", text: c.listen.stop });
  el.volume = h(document, "input", { type: "range", min: 0, max: 100, step: 1, id: "xp-volume", value: Math.round(settings.volume * 100) });
  el.wave = h(document, "canvas", { width: 480, height: 80, role: "img", "aria-label": c.listen.wave });
  el.listen.append(h(document, "h2", { id: "xp-listen-title", text: c.listen.title }), h(document, "div", { class: "player-line" }, el.state), h(document, "div", { class: "player-buttons" }, play, stop),
    h(document, "label", { class: "volume", for: "xp-volume" }, h(document, "span", { text: c.listen.volume }), el.volume), el.wave, h(document, "p", { class: "small", text: c.listen.note + " " + c.listen.pan }));
  play.addEventListener("click", () => { if (state.a === null) { el.state.textContent = c.listen.needCell; return; } hearCell(state.a); });
  stop.addEventListener("click", () => { rec.stop(); clearTimeout(second); el.state.textContent = c.listen.stopped; });
  el.volume.addEventListener("input", () => { const value = Number(el.volume.value) / 100; rec.setVolume(value); saveSettings({ volume: value }); });

  // ---- interaction
  function select(index, { hear = true } = {}) {
    if (state.pickingB && state.a !== null && index !== state.a) { state.b = index; state.pickingB = false; } else { state.a = index; if (state.b === index) state.b = null; }
    el.reading.textContent = readingOf(index);
    if (hear) hearCell(index);
    renderSelected(); renderCompare(); draw();
  }
  const cellAtEvent = (event) => {
    const r = el.canvas.getBoundingClientRect();
    const col = Math.min(COLS - 1, Math.max(0, Math.floor(((event.clientX - r.left) / r.width) * COLS)));
    const row = Math.min(ROWS - 1, Math.max(0, Math.floor(((event.clientY - r.top) / r.height) * ROWS)));
    return row * COLS + col;
  };
  el.canvas.addEventListener("click", (event) => { el.canvas.focus({ preventScroll: true }); select(cellAtEvent(event)); });
  el.canvas.addEventListener("pointermove", (event) => { if (event.pointerType !== "mouse") return; const i = cellAtEvent(event); el.hover.textContent = fill(c.map.hover, { id: idOf(i), value: Number.isFinite(values()[i]) ? fmt(values()[i]) + " " + unit() : c.map.noValue }); });
  el.canvas.addEventListener("pointerleave", () => { el.hover.textContent = ""; });
  el.canvas.addEventListener("keydown", (event) => {
    const steps = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };
    if (steps[event.key]) {
      event.preventDefault();
      const cur = state.pickingB && state.b !== null ? state.b : state.a ?? Math.floor(ROWS / 2) * COLS + Math.floor(COLS / 2);
      const row = Math.max(0, Math.min(ROWS - 1, Math.floor(cur / COLS) + steps[event.key][0]));
      const col = Math.max(0, Math.min(COLS - 1, (cur % COLS) + steps[event.key][1]));
      select(row * COLS + col, { hear: false });
    } else if ((event.key === "Enter" || event.key === " ") && state.a !== null) { event.preventDefault(); hearCell(state.a); }
    else if ((event.key === "b" || event.key === "B") && state.a !== null) { event.preventDefault(); state.pickingB = !state.pickingB; renderCompare(); }
    else if (event.key === "Escape") { state.pickingB = false; renderCompare(); }
  });
  function setDate(id) { state.snapshot = phen().snapshot(id); renderAll(); }
  el.date.addEventListener("change", () => setDate(el.date.value));
  function switchTo(id) {
    if (id === state.id) return;
    rec.stop();
    state.id = id; state.snapshot = firstOpen(id); state.b = null; state.pickingB = false;
    for (const [key, b] of Object.entries(tabButtons)) b.setAttribute("aria-pressed", String(key === id));
    renderAll();
  }
  function renderAll() {
    norm = normalizer(spec());
    ramp = rampFromStops(spec().stops);
    renderDates(); renderDry(); renderAbout(); renderLegend(); renderSelected(); renderCompare();
    if (state.a !== null) el.reading.textContent = readingOf(state.a);
    draw();
  }
  renderAll();
  new ResizeObserver(() => draw()).observe(el.stage);
  let frame = requestAnimationFrame(function loop() { drawWaveform(el.wave, rec.analyser, { color: "#68e0d0" }); frame = requestAnimationFrame(loop); });
  document.addEventListener("visibilitychange", () => { if (document.hidden) { cancelAnimationFrame(frame); frame = undefined; } else if (frame === undefined) frame = requestAnimationFrame(function loop() { drawWaveform(el.wave, rec.analyser, { color: "#68e0d0" }); frame = requestAnimationFrame(loop); }); });
  if (new URL(document.URL).searchParams.has("debug")) window.__explore = { state, phens, rec, select, switchTo, setDate };
}
