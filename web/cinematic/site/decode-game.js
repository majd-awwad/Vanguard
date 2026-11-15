// Decode: the five-level game (web/pages/decode.html). Screens: profiles, levels, play, result, award.
// The data, the missions and the scoring live in web/experiences/levels/*; this file is the interface.
import { cellBounds, cellId, formatLat, formatLon, textureCrop } from "./cells.js";
import { mountCellGrid } from "./cell-grid.js";
import { h } from "./dom.js";
import { mountNav } from "./nav.js";
import { markDecodeCompleted, markDecodeFinished, spoilersUnlocked } from "./progress.js";
import { loadSettings, saveSettings } from "./settings.js";
import { describeRule, gameCopy } from "./decode-game-copy.js";
import { CERT_SIZE, downloadCanvas, drawCertificate } from "../../experiences/levels/award.js";
import { createRun } from "../../experiences/levels/engine.js";
import { LEVELS, LEVEL_COUNT, PACKAGE_ID, buildLevelData, levelOf } from "../../experiences/levels/levels.js";
import { AVATARS, createProfileStore } from "../../experiences/levels/profiles.js";
import { PHENOMENA, colorAt, formatValue, openPackage } from "../../studio/datasets.js";
import { createRecordings } from "../../studio/recordings.js";

const TEXTURE = "../assets/earth/blue-marble-4096.jpg";
const SOURCE_BOUNDS = Object.freeze({ north: 45, south: 15, west: -20, east: 50 });
const AVATAR_GLYPH = Object.freeze({ globe: "🌍", dune: "🏜️", cloud: "☁️", wave: "🌊", wind: "💨", sun: "☀️", rocket: "🚀", satellite: "🛰️" });
const fill = (text, tokens = {}) => String(text).replace(/\{(\w+)\}/g, (m, key) => (key in tokens ? tokens[key] : m));
const reducedMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;

export function startDecodeGame(document = globalThis.document) {
  const language = mountNav(document, document.getElementById("site-nav"), { active: "decode", from: "pages" });
  const c = gameCopy[language];
  document.title = c.title + " · EARTHPULSE";
  const root = document.getElementById("decode-root");
  const app = { document, root, language, c, store: createProfileStore(), phens: null, rec: null, settings: loadSettings(), sound: true, cues: false, debug: new URL(document.URL).searchParams.has("debug") };
  if (app.debug) globalThis.__decode = app;
  const active = app.store.active();
  return active ? showLevels(app) : showProfiles(app);
}

/** Loads the three phenomena of the verified package once. */
async function ensureData(app) {
  if (app.phens) return app.phens;
  const pkg = await openPackage();
  const [dust, rainfall, wind] = await Promise.all([pkg.openPhenomenon("dust"), pkg.openPhenomenon("rainfall"), pkg.openPhenomenon("wind")]);
  app.phens = { dust, rainfall, wind };
  return app.phens;
}

function setScreen(app, name, ...nodes) {
  app.root.dataset.screen = name;
  app.root.replaceChildren(...nodes.filter(Boolean), h(app.document, "p", { class: "credit", text: app.c.credit }));
  app.root.querySelector("h1, h2")?.setAttribute("tabindex", "-1");
  app.root.querySelector("h1, h2")?.focus({ preventScroll: true });
  globalThis.scrollTo?.(0, 0);
}

function profileChip(app) {
  const { document, c, store } = app;
  const p = store.active();
  if (!p) return null;
  const switcher = h(document, "button", { type: "button", class: "button ghost small-button", text: c.profiles.switch });
  switcher.addEventListener("click", () => { app.rec?.stop(); store.signOut(); showProfiles(app); });
  return h(document, "div", { class: "dg-chip" }, h(document, "span", { class: "dg-avatar", "aria-hidden": "true", text: AVATAR_GLYPH[p.avatar] }), h(document, "strong", { text: p.name }),
    h(document, "span", { class: "dg-chip-score", text: fill(c.profiles.summary, { total: p.progress.total, done: p.progress.completed.length }) }), switcher);
}

// ---------------------------------------------------------------------------------------------------------- profiles
function showProfiles(app) {
  const { document, c, store } = app;
  const list = h(document, "ul", { class: "dg-profiles" });
  const live = h(document, "p", { class: "small", role: "status", "aria-live": "polite" });
  const confirm = h(document, "div", { class: "dg-confirm", role: "alertdialog", "aria-modal": "false", "aria-labelledby": "dg-confirm-text", hidden: true });
  function renderList() {
    list.replaceChildren();
    const profiles = store.list();
    if (!profiles.length) list.append(h(document, "li", { class: "small", text: c.profiles.empty }));
    for (const p of profiles) {
      const play = h(document, "button", { type: "button", class: "button", "aria-label": fill(c.profiles.play, { name: p.name }) }, h(document, "span", { "aria-hidden": "true", text: AVATAR_GLYPH[p.avatar] + " " }), document.createTextNode(p.name));
      play.addEventListener("click", () => { store.select(p.id); showLevels(app); });
      const remove = h(document, "button", { type: "button", class: "button ghost small-button", "aria-label": fill(c.profiles.remove, { name: p.name }), text: c.profiles.removeShort });
      remove.addEventListener("click", () => {
        confirm.hidden = false;
        const yes = h(document, "button", { type: "button", class: "button", text: c.profiles.confirmYes });
        const no = h(document, "button", { type: "button", class: "button ghost", text: c.profiles.confirmNo });
        confirm.replaceChildren(h(document, "p", { id: "dg-confirm-text", text: fill(c.profiles.confirm, { name: p.name }) }), h(document, "div", { class: "actions" }, yes, no));
        yes.addEventListener("click", () => { store.remove(p.id); confirm.hidden = true; renderList(); });
        no.addEventListener("click", () => { confirm.hidden = true; remove.focus(); });
        no.focus();
      });
      list.append(h(document, "li", { class: "dg-profile" }, h(document, "div", { class: "dg-profile-main" }, play, h(document, "span", { class: "small", text: fill(c.profiles.summary, { total: p.progress.total, done: p.progress.completed.length }) })), remove));
    }
  }
  const name = h(document, "input", { type: "text", id: "dg-name", maxlength: 24, autocomplete: "off", placeholder: c.profiles.namePlaceholder, required: true });
  let avatar = AVATARS[0];
  const avatars = h(document, "div", { class: "dg-avatars", role: "radiogroup", "aria-label": c.profiles.avatar });
  for (const a of AVATARS) {
    const b = h(document, "button", { type: "button", role: "radio", class: "dg-avatar-option", "aria-checked": a === avatar, "aria-label": c.avatars[a], "data-avatar": a }, h(document, "span", { "aria-hidden": "true", text: AVATAR_GLYPH[a] }));
    b.addEventListener("click", () => { avatar = a; for (const o of avatars.children) o.setAttribute("aria-checked", String(o.dataset.avatar === a)); });
    avatars.append(b);
  }
  const create = h(document, "button", { type: "submit", class: "button", text: c.profiles.create });
  const form = h(document, "form", { class: "dg-form", novalidate: true }, h(document, "label", { for: "dg-name", text: c.profiles.name }), name, h(document, "p", { class: "small", id: "dg-avatar-legend", text: c.profiles.avatar }), avatars, create);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const made = store.create({ name: name.value, avatar });
    if (!made.ok) { live.textContent = c.profiles.errors[made.error] ?? c.profiles.errors.name; name.focus(); return; }
    showLevels(app);
  });
  renderList();
  const stored = h(document, "p", { class: "callout" }, c.profiles.local);
  const warn = store.persisted ? null : h(document, "p", { class: "callout", role: "note", text: c.profiles.notSaved });
  setScreen(app, "profiles", h(document, "section", { class: "dg-section", "aria-labelledby": "dg-profiles-title" },
    h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", { id: "dg-profiles-title", text: c.profiles.title }), h(document, "p", { class: "lede", text: c.profiles.lede }), stored, warn,
    h(document, "div", { class: "dg-profile-grid" },
      h(document, "div", { class: "panel" }, h(document, "h2", { text: c.profiles.existing }), list, confirm),
      h(document, "div", { class: "panel" }, h(document, "h2", { text: c.profiles.newTitle }), form, live))));
}

// ---------------------------------------------------------------------------------------------------------- levels
function levelCard(app, profile, level) {
  const { document, c, store } = app;
  const info = c.levels.info[level.id];
  const unlocked = store.unlockedLevels(profile.id).includes(level.id);
  const done = profile.progress.completed.includes(level.id);
  const current = profile.progress.current?.levelId === level.id && !done;
  const dates = level.dates.from ? fill(c.levels.dates, level.dates) : level.dates.main;
  const state = done ? "done" : unlocked ? "open" : "locked";
  const button = h(document, "button", { type: "button", class: unlocked ? "button" : "button ghost", disabled: !unlocked, "aria-describedby": "dg-level-" + level.id + "-why", text: done ? c.levels.replay : current ? c.levels.resume : c.levels.play });
  if (unlocked) button.addEventListener("click", () => playLevel(app, level.id));
  return h(document, "li", { class: "dg-level panel", "data-level": level.id, "data-state": state },
    h(document, "div", { class: "dg-level-head" }, h(document, "span", { class: "dg-level-no", "aria-hidden": "true", text: level.id }), h(document, "div", {}, h(document, "h3", { text: fill(c.play.levelOf, { n: level.id, name: info.name }) }), h(document, "p", { class: "small", text: c.levels.difficulty[level.difficulty] + " · " + fill(c.levels.grid, { rows: level.grid.rows, cols: level.grid.cols, cells: level.grid.rows * level.grid.cols }) }))),
    h(document, "p", { text: info.about }),
    h(document, "dl", { class: "kv" }, h(document, "dt", { text: c.levels.data }), h(document, "dd", { text: info.data }), h(document, "dt", { text: c.levels.date }), h(document, "dd", { class: "ltr", text: dates }), h(document, "dt", { text: "·" }), h(document, "dd", { text: fill(c.levels.objectives, { n: level.objectives.length }) })),
    h(document, "p", { class: "dg-state", id: "dg-level-" + level.id + "-why", text: !unlocked ? fill(c.levels.lockedWhy, { n: level.id - 1 }) : done ? c.levels.state.done + " · " + fill(c.levels.best, { score: profile.progress.best[level.id] ?? 0 }) : c.levels.state.open }), button);
}

function showLevels(app) {
  const { document, c, store } = app;
  const profile = store.active();
  if (!profile) return showProfiles(app);
  const exploreOpen = spoilersUnlocked();
  const cards = h(document, "ol", { class: "dg-levels" }, ...LEVELS.map((level) => levelCard(app, profile, level)));
  const explore = exploreOpen
    ? h(document, "a", { class: "button ghost", href: "./explore.html", text: c.levels.explore })
    : h(document, "span", { class: "small dg-locked-note", text: c.levels.exploreLocked });
  const award = profile.progress.finishedAt ? (() => { const b = h(document, "button", { type: "button", class: "button", text: c.levels.award }); b.addEventListener("click", () => showAward(app)); return b; })() : null;
  const badges = profile.progress.achievements.length ? h(document, "div", { class: "panel" }, h(document, "h2", { text: c.levels.achievements }), h(document, "ul", { class: "dg-ach" }, ...profile.progress.achievements.map((a) => h(document, "li", { text: "★ " + c.ach[a] })))) : null;
  setScreen(app, "levels", h(document, "section", { class: "dg-section", "aria-labelledby": "dg-levels-title" },
    h(document, "div", { class: "dg-topbar" }, h(document, "div", {}, h(document, "p", { class: "eyebrow", text: c.eyebrow }), h(document, "h1", { id: "dg-levels-title", text: fill(c.levels.hello, { name: profile.name }) })), profileChip(app)),
    h(document, "p", { class: "lede" }, fill(c.levels.total, {}) + ": ", h(document, "strong", { class: "ltr", text: profile.progress.total }), " " + c.levels.of),
    h(document, "p", { class: "small", text: store.persisted ? c.profiles.local : c.profiles.notSaved }),
    h(document, "h2", { class: "dg-h2", text: c.levels.choose }), cards,
    h(document, "div", { class: "actions" }, award, explore, h(document, "a", { class: "button ghost", href: "../", text: c.levels.original })), badges));
}

// ---------------------------------------------------------------------------------------------------------- play
async function playLevel(app, levelId) {
  const { document, c, store } = app;
  const profile = store.active();
  const level = LEVELS[levelId - 1];
  setScreen(app, "loading", h(document, "p", { class: "status", role: "status", text: c.errors.loading }));
  let run;
  try {
    const phens = await ensureData(app);
    const data = buildLevelData(level, phens);
    const saved = profile.progress.current?.levelId === levelId && !profile.progress.completed.includes(levelId) ? profile.progress.current : null;
    run = createRun({ level, data, restore: saved, exposeTruth: app.debug }); // the truth is exposed only with ?debug=1 (used by the browser tests)
  } catch (error) {
    console.error(error);
    const retry = h(document, "button", { type: "button", class: "button", text: c.errors.retry });
    retry.addEventListener("click", () => playLevel(app, levelId));
    setScreen(app, "error", h(document, "p", { class: "status", role: "alert", text: c.errors.load }), retry);
    return;
  }
  if (app.debug) app.run = run;
  store.saveCurrent(profile.id, run.snapshot());
  mountPlay(app, level, run);
}

function mountPlay(app, level, run) {
  const { document, c, store, language } = app;
  const p = c.play;
  const profile = store.active();
  const { rows, cols } = level.grid;
  const phenLabel = (id) => c.phen[id];
  const st = { sel: null, marks: new Set(), listenPhen: null, hit: new Set(), awaiting: null, feedback: "", cue: "", hints: [] };
  const el = {};
  app.rec ??= createRecordings({ baseUrl: new URL("../../assets/ambient/", import.meta.url), reduced: reducedMotion });
  app.rec.setVolume(app.settings.volume);
  let timer = 0;

  // ---- map
  const stage = h(document, "div", { class: "xp-stage dg-stage", dir: "ltr", "data-renderer": "svg" });
  const grid = h(document, "div", { class: "xp-grid" });
  stage.append(grid);
  const crop = textureCrop(SOURCE_BOUNDS);
  Object.assign(stage.style, { aspectRatio: String(crop.aspect), backgroundImage: `url("${TEXTURE}")`, backgroundSize: `${crop.sizeX}% ${crop.sizeY}%`, backgroundPosition: `${crop.posX}% ${crop.posY}%` });
  const label = (r, col) => fill(p.cellLabel, { id: cellId(r, col), lat: formatLat(cellBounds(SOURCE_BOUNDS, level.grid, r, col).north) + "–" + formatLat(cellBounds(SOURCE_BOUNDS, level.grid, r, col).south), lon: formatLon(cellBounds(SOURCE_BOUNDS, level.grid, r, col).west) + "–" + formatLon(cellBounds(SOURCE_BOUNDS, level.grid, r, col).east) });
  const api = mountCellGrid(document, grid, { rows, cols, label: p.gridLabel, describe: label, onChoose: (r, col) => choose(r * cols + col), helpId: "dg-help" });
  grid.addEventListener("keydown", (event) => { if (event.key === "m" || event.key === "M") { const b = event.target.closest(".xp-cell"); if (b) { event.preventDefault(); toggleMark(Number(b.dataset.row) * cols + Number(b.dataset.col)); } } });
  const idx = (r, col) => r * cols + col;

  function paint() {
    const v = run.view();
    const cur = v.current;
    const candidates = new Set((cur?.candidates ?? []).map((x) => x.index));
    api.buttons.forEach((line, r) => line.forEach((b, col) => {
      const i = idx(r, col);
      b.dataset.mark = st.marks.has(i) ? "1" : "";
      b.dataset.hit = st.hit.has(i) ? "1" : "";
      b.dataset.cand = candidates.has(i) ? "1" : "";
      b.dataset.dim = cur?.candidates && !candidates.has(i) ? "1" : "";
      b.dataset.pair = cur?.pair ? (cur.pair.A.index === i ? "A" : cur.pair.B.index === i ? "B" : "") : "";
      b.dataset.rev = v.finished ? "1" : "";
      b.setAttribute("aria-label", label(r, col) + (st.marks.has(i) ? ", ✓" : "") + (b.dataset.pair ? ", " + b.dataset.pair : ""));
      b.querySelector(".dg-arrow")?.remove();
      if (cur?.arrow && cur.arrow.cell.index === i) b.append(h(document, "span", { class: "dg-arrow", "aria-hidden": "true", style: `transform:rotate(${Math.round(cur.arrow.toDegrees)}deg)`, text: "↑" }));
    }));
    api.setSelected({ a: st.sel === null ? null : [Math.floor(st.sel / cols), st.sel % cols], b: null });
  }

  // ---- sound
  function playCue(cue) {
    if (!app.sound || !cue.level) return;
    app.rec.unlock().then(() => app.rec.slice(cue.phenomenon, cue.level, { pan: cue.pan, rate: cue.rate, durationS: 1.3, fadeS: 0.1 })).catch(() => { el.soundNote.textContent = p.sound.unavailable; });
  }
  const cueText = (cue) => (cue.missing ? p.cueMissing : cue.level ? fill(p.cue, { level: c.levelWord[cue.level] }) : cue.phenomenon === "rainfall" ? p.cueSilent : p.cueNone);
  function hear(phen, index, which = "main") {
    const cue = run.cue(phen, index, which);
    playCue(cue);
    return cue;
  }
  function hearAndShow(index) {
    const cur = run.view().current;
    const phen = st.listenPhen ?? cur?.phen ?? level.phenomena[0];
    const cue = hear(phen, index);
    const parts = [fill(p.selected, { id: cellId(Math.floor(index / cols), index % cols) }) + " · " + phenLabel(phen)];
    if (cur?.change) { const first = run.cue(phen, index, "from"); parts.push(fill(p.cueTwo, { a: cueText(first), b: cueText(cue) })); } else parts.push(cueText(cue));
    st.cue = parts.join(" · ");
    el.cue.textContent = app.cues || !app.sound ? st.cue : parts[0];
  }

  // ---- interaction
  function choose(index) {
    app.rec.unlock().catch(() => {});
    st.sel = index;
    if (st.awaiting) { paint(); renderSide(); return; }
    hearAndShow(index);
    paint();
    renderSide();
    api.focusCell(Math.floor(index / cols), index % cols);
  }
  function toggleMark(index) {
    const cur = run.view().current;
    if (!cur || cur.type !== "mark-set" || st.awaiting) return;
    if (st.marks.has(index)) st.marks.delete(index); else st.marks.add(index);
    paint(); renderSide();
  }
  const cellsText = (cells) => cells.map((x) => cellId(x.row, x.col)).join(", ");
  function afterCompletion(result, kind) {
    st.hit = new Set((result.truth ?? []).map((x) => x.index));
    st.awaiting = true;
    st.marks.clear();
    store.saveCurrent(profile.id, run.snapshot());
    const lines = [kind === "shown" ? fill(p.feedback.shown, { cells: cellsText(result.truth) }) : fill(p.feedback.correct, { points: result.earned }), kind === "shown" ? "" : fill(p.feedback.truth, { cells: cellsText(result.truth) })];
    const cur = result.objective;
    if (cur?.together) lines.push(p.feedback.both);
    if (cur?.change) lines.push(p.feedback.change);
    st.feedback = lines.filter(Boolean).join(" ");
    paint(); renderSide();
    el.live.textContent = st.feedback;
  }
  function submit(answer) {
    const before = run.view().current;
    const result = run.submit(answer);
    if (result.ok) { afterCompletion({ ...result, id: before.id, objective: before }, "ok"); return; }
    let text = p.feedback.pickWrong;
    if (before.type === "mark-set") text = fill(p.feedback.marks, { hits: result.hits, extra: result.extra, missing: result.missing });
    else if (before.type === "find-max") text = p.feedback.maxWrong;
    else if (before.type === "direction") text = p.feedback.dirWrong;
    st.feedback = text;
    renderSide();
    el.live.textContent = text;
  }
  function next() {
    st.awaiting = null; st.hit.clear(); st.sel = null; st.marks.clear(); st.feedback = ""; st.hints = []; st.listenPhen = null;
    const v = run.view();
    if (v.finished) return finishLevel();
    paint(); renderSide();
  }
  function finishLevel() {
    app.rec.stop();
    const result = run.result();
    const outcome = store.completeLevel(profile.id, result);
    if (result.levelId === 1) markDecodeCompleted();
    if (outcome?.allDone) markDecodeFinished();
    showResult(app, level, run, result, outcome);
  }

  // ---- side panel
  el.live = h(document, "p", { class: "visually-hidden", role: "status", "aria-live": "polite" });
  el.cue = h(document, "p", { class: "dg-cue", role: "status", "aria-live": "polite" });
  el.soundNote = h(document, "p", { class: "small", text: p.soundNote });
  const side = h(document, "div", { class: "dg-side" });
  function layerButtons(cur) {
    const layers = cur.layers.length > 1 || level.phenomena.length > 1 ? (level.phenomena.length > 1 ? level.phenomena : cur.layers) : [];
    if (layers.length < 2) return null;
    const wrap = h(document, "div", { class: "seg", role: "group", "aria-label": p.listenLayer });
    for (const id of layers) {
      const b = h(document, "button", { type: "button", "aria-pressed": (st.listenPhen ?? cur.phen) === id, text: c.phenTitle[id] });
      b.addEventListener("click", () => { st.listenPhen = id; if (st.sel !== null) hearAndShow(st.sel); renderSide(); });
      wrap.append(b);
    }
    return h(document, "div", {}, h(document, "p", { class: "small", text: p.listenLayer + ":" }), wrap);
  }
  function hintText(hint) {
    const hs = p.hints;
    if (hint.level === 1) return hs[1][hint.type];
    const parts = [];
    if (hint.region) parts.push(fill(hs[2].region, { ns: p.ns[hint.region.ns], ew: p.ew[hint.region.ew] }));
    if (hint.higher) parts.push(fill(hs[2].higher, { which: language === "ar" ? (hint.higher === "A" ? "أ" : "ب") : hint.higher }));
    if (hint.from) parts.push(fill(hs[2].from, { from: c.compass[hint.from] }));
    if (hint.cell) parts.push(fill(hs[3].cell, { id: cellId(hint.cell.row, hint.cell.col) }));
    return parts.join(" ");
  }
  function promptFor(cur) {
    const phen = phenLabel(cur.phen);
    if (cur.type === "pick-higher") return fill(p.prompt["pick-higher"], { phen });
    if (cur.type === "find-max") return fill(cur.restricted ? p.prompt["find-max-restrict"] : p.prompt["find-max"], { phen });
    if (cur.type === "direction") return fill(p.prompt.direction, { id: cellId(cur.arrow.cell.row, cur.arrow.cell.col) });
    const rule = describeRule(language, { where: cur.where, change: cur.change }, phenLabel);
    return fill(p.prompt["mark-set"], { rule: rule + (!cur.change && level.dates.from ? p.rules.dateSuffix : "") });
  }
  function actionButton(text, onClick, cls = "button", disabled = false) {
    const b = h(document, "button", { type: "button", class: cls, disabled, text });
    b.addEventListener("click", onClick);
    return b;
  }
  function renderSide() {
    const v = run.view();
    const cur = v.current;
    const parts = [];
    const showStage = level.id >= 4 && cur;
    parts.push(h(document, "div", { class: "dg-progress" },
      h(document, "div", { class: "dg-progress-head" }, h(document, "span", { text: p.progress }), h(document, "strong", { class: "ltr", text: `${v.done}/${v.total}` })),
      h(document, "div", { class: "dg-bar", role: "progressbar", "aria-label": p.progress, "aria-valuemin": 0, "aria-valuemax": v.total, "aria-valuenow": v.done }, h(document, "div", { class: "dg-bar-fill", style: `width:${(100 * v.done) / v.total}%` })),
      h(document, "ol", { class: "dg-steps", "aria-hidden": "true" }, ...v.objectives.map((o) => h(document, "li", { "data-done": o.done ? "1" : "", "data-now": cur && cur.id === o.id ? "1" : "" })))));
    parts.push(h(document, "p", { class: "dg-score ltr", text: fill(p.score, { score: v.score }) }));
    if (st.awaiting) {
      parts.push(h(document, "p", { class: "callout dg-feedback", text: st.feedback }));
      parts.push(actionButton(v.finished ? p.finish : p.next, next));
    } else if (cur) {
      parts.push(h(document, "p", { class: "eyebrow", text: fill(p.objective, { k: cur.index + 1, n: cur.total }) + (showStage ? " · " + fill(p.stage, { s: cur.stage }) : "") }));
      parts.push(h(document, "h2", { class: "dg-prompt", text: promptFor(cur) }));
      const layerRow = layerButtons(cur);
      if (layerRow) parts.push(layerRow);
      const selLabel = st.sel === null ? p.none : fill(p.selected, { id: cellId(Math.floor(st.sel / cols), st.sel % cols) });
      if (cur.type === "mark-set") {
        const marked = st.sel !== null && st.marks.has(st.sel);
        parts.push(h(document, "p", { class: "small", text: selLabel }),
          h(document, "div", { class: "dg-actions" },
            actionButton(p.listen, () => st.sel !== null && hearAndShow(st.sel), "button ghost", st.sel === null),
            actionButton(marked ? p.unmark : p.mark, () => toggleMark(st.sel), "button", st.sel === null),
            actionButton(p.clear, () => { st.marks.clear(); paint(); renderSide(); }, "button ghost", st.marks.size === 0)),
          h(document, "p", { class: "ltr dg-count", text: fill(p.marked, { n: st.marks.size }) }),
          actionButton(p.check, () => submit({ cells: [...st.marks] }), "button", st.marks.size === 0));
      } else if (cur.type === "find-max") {
        parts.push(h(document, "p", { class: "small", text: selLabel }),
          h(document, "div", { class: "dg-actions" }, actionButton(p.listen, () => st.sel !== null && hearAndShow(st.sel), "button ghost", st.sel === null), actionButton(p.answerCell, () => submit({ cell: st.sel }), "button", st.sel === null)));
      } else if (cur.type === "pick-higher") {
        const A = cur.pair.A, B = cur.pair.B;
        const phen = st.listenPhen ?? cur.phen;
        const aLabel = language === "ar" ? "أ" : "A", bLabel = language === "ar" ? "ب" : "B";
        parts.push(h(document, "p", { class: "small", text: `${aLabel}: ${cellId(A.row, A.col)} · ${bLabel}: ${cellId(B.row, B.col)}` }),
          h(document, "div", { class: "dg-actions" }, actionButton(p.hearA, () => { st.sel = A.index; el.cue.textContent = cueText(hear(phen, A.index)); paint(); }, "button ghost"), actionButton(p.hearB, () => { st.sel = B.index; el.cue.textContent = cueText(hear(phen, B.index)); paint(); }, "button ghost")),
          h(document, "div", { class: "dg-actions" }, actionButton(p.higherA, () => submit({ pick: "A" })), actionButton(p.higherB, () => submit({ pick: "B" }))));
      } else if (cur.type === "direction") {
        const choice = { value: null };
        const radios = h(document, "div", { class: "seg dg-compass", role: "radiogroup", "aria-label": fill(p.directionLegend, { id: cellId(cur.arrow.cell.row, cur.arrow.cell.col) }) });
        for (const opt of cur.options) {
          const b = h(document, "button", { type: "button", role: "radio", "aria-checked": false, "data-option": opt, text: c.compass[opt] });
          b.addEventListener("click", () => { choice.value = opt; for (const o of radios.children) o.setAttribute("aria-checked", String(o.dataset.option === opt)); go.disabled = false; });
          radios.append(b);
        }
        const go = actionButton(p.checkAnswer, () => submit({ option: choice.value }), "button", true);
        parts.push(radios, go);
      }
      if (cur.change) parts.push(actionButton(p.hearBoth, () => { if (st.sel !== null) hearBoth(st.sel); }, "button ghost", st.sel === null));
      if (st.feedback) parts.push(h(document, "p", { class: "callout dg-feedback", text: st.feedback }));
      // hints and fair play
      const hint = actionButton(cur.hintsLeft ? p.hint : p.noHints, () => { const hn = run.hint(); if (hn) { st.hints.push(hintText(hn)); store.saveCurrent(profile.id, run.snapshot()); renderSide(); } }, "button ghost small-button", cur.hintsLeft === 0);
      parts.push(h(document, "div", { class: "dg-hints" }, hint, h(document, "p", { class: "small", text: cur.hintsLeft ? fill(p.hintCost, { n: cur.hintsLeft }) : "" }), ...st.hints.map((t) => h(document, "p", { class: "dg-hint", text: "💡 " + t }))));
      if (cur.canShowAnswer) parts.push(actionButton(p.showAnswer, () => { const shown = run.showAnswer(); if (shown) afterCompletion({ ...shown, id: cur.id, objective: cur }, "shown"); }, "button ghost small-button"), h(document, "p", { class: "small", text: p.showNote }));
    }
    // sound
    const soundToggle = actionButton(app.sound ? p.soundOn : p.soundOff, () => { app.sound = !app.sound; if (!app.sound) app.rec.stop(); renderSide(); }, "button ghost small-button");
    soundToggle.setAttribute("aria-pressed", String(app.sound));
    const cues = h(document, "label", { class: "dg-check" }, h(document, "input", { type: "checkbox", checked: app.cues || !app.sound, disabled: !app.sound }), h(document, "span", { text: p.cueOff }));
    cues.querySelector("input").addEventListener("change", (event) => { app.cues = event.target.checked; if (st.sel !== null) hearAndShowSilent(); renderSide(); });
    const volume = h(document, "input", { type: "range", min: 0, max: 100, step: 1, id: "dg-volume", value: Math.round(app.settings.volume * 100), "aria-label": p.volume });
    volume.addEventListener("input", () => { const value = Number(volume.value) / 100; app.rec.setVolume(value); app.settings.volume = value; saveSettings({ volume: value }); });
    parts.push(h(document, "div", { class: "dg-sound" }, h(document, "h3", { text: p.cueTitle }), h(document, "div", { class: "dg-actions" }, soundToggle, volume), cues, el.cue, el.soundNote));
    side.replaceChildren(...parts.filter(Boolean));
  }
  function hearAndShowSilent() { el.cue.textContent = app.cues || !app.sound ? st.cue : (st.cue.split(" · ")[0] ?? ""); }
  function hearBoth(index) {
    const cur = run.view().current;
    const phen = st.listenPhen ?? cur.phen;
    const a = hear(phen, index, "from");
    clearTimeout(timer);
    timer = setTimeout(() => hear(phen, index, "main"), 1700);
    const b = run.cue(phen, index, "main");
    st.cue = fill(p.cueTwo, { a: cueText(a), b: cueText(b) });
    el.cue.textContent = app.cues || !app.sound ? st.cue : "";
  }

  // ---- frame
  const info = c.levels.info[level.id];
  const dates = level.dates.from ? fill(p.datesChange, { phen: info.data, from: level.dates.from, to: level.dates.main }) : fill(p.dates, { phen: info.data, date: level.dates.main });
  const back = h(document, "button", { type: "button", class: "button ghost small-button", text: p.back });
  back.addEventListener("click", () => { app.rec.stop(); clearTimeout(timer); showLevels(app); });
  setScreen(app, "play", h(document, "section", { class: "dg-play", "aria-labelledby": "dg-play-title" },
    h(document, "div", { class: "dg-topbar" }, h(document, "div", {}, h(document, "p", { class: "eyebrow ltr", text: c.levels.difficulty[level.difficulty] + " · " + fill(c.levels.grid, { rows, cols, cells: rows * cols }) }), h(document, "h1", { id: "dg-play-title", text: fill(p.levelOf, { n: level.id, name: info.name }) }), h(document, "p", { class: "small ltr", text: dates })), h(document, "div", { class: "dg-top-actions" }, profileChip(app), back)),
    h(document, "div", { class: "dg-layout" },
      h(document, "div", { class: "dg-mapcol" }, h(document, "div", { class: "dg-stage-box" }, stage), h(document, "p", { class: "small", id: "dg-help", text: p.help }), h(document, "p", { class: "small", text: p.mapNote })),
      h(document, "div", { class: "panel dg-panel" }, side)), el.live));
  paint();
  renderSide();
}

// ---------------------------------------------------------------------------------------------------------- result
function showResult(app, level, run, result, outcome) {
  const { document, c, language, store } = app;
  const r = c.result;
  const profile = store.active();
  const info = c.levels.info[level.id];
  const view = run.view();
  const { rows, cols } = level.grid;
  const nextLevel = level.id < LEVEL_COUNT ? LEVELS[level.id] : null;
  const rows2 = result.objectives.map((o) => h(document, "li", {}, h(document, "span", { text: r.types[o.type] + ": " }), h(document, "span", { class: "ltr", text: fill(r.points, { earned: o.earned, points: o.points }) }), " ", o.wrong ? h(document, "span", { class: "small", text: fill(r.wrong, { n: o.wrong }) }) : null, " ", o.hints ? h(document, "span", { class: "small", text: fill(r.hints, { n: o.hints }) }) : null, o.shown ? h(document, "span", { class: "small", text: " " + r.shown }) : null));
  // ---- review map with the real values (the final reveal)
  const stage = h(document, "div", { class: "xp-stage dg-stage dg-review", dir: "ltr", "data-renderer": "svg" });
  const grid = h(document, "div", { class: "xp-grid" });
  stage.append(grid);
  const crop = textureCrop(SOURCE_BOUNDS);
  Object.assign(stage.style, { aspectRatio: String(crop.aspect), backgroundImage: `url("${TEXTURE}")`, backgroundSize: `${crop.sizeX}% ${crop.sizeY}%`, backgroundPosition: `${crop.posX}% ${crop.posY}%` });
  const readout = h(document, "p", { class: "dg-cue", role: "status", "aria-live": "polite", text: r.reviewNote });
  const state = { phen: level.phenomena[0], which: "main" };
  const spec = () => PHENOMENA[PACKAGE_ID[state.phen]];
  const valueOf = (i) => view.revealed[state.phen]?.[state.which]?.[i] ?? null;
  const legend = h(document, "div", { class: "dg-legend", "aria-hidden": "true" });
  function describeCell(i) {
    const value = valueOf(i);
    const id = cellId(Math.floor(i / cols), i % cols);
    if (value === null) return `${id}: ${r.missing}`;
    const text = `${id} · ${c.phenTitle[state.phen]}: ${formatValue(spec(), value)} ${r.unit[state.phen]}` + (levelOf(state.phen, value) ? " · " + fill(c.play.cue, { level: c.levelWord[levelOf(state.phen, value)] }) : "");
    const dir = state.phen === "wind" && state.which === "main" ? view.revealed.wind.direction?.[i] : null;
    return dir !== null && dir !== undefined ? text + " · " + fill(r.direction, { dir: c.compass[["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(dir / 45) % 8]] }) : text;
  }
  const api = mountCellGrid(document, grid, { rows, cols, label: c.play.gridLabel, describe: (row, col) => describeCell(row * cols + col), onChoose: (row, col) => { readout.textContent = describeCell(row * cols + col); api.setSelected({ a: [row, col], b: null }); }, helpId: "dg-help" });
  function paintReview() {
    api.buttons.forEach((line, row) => line.forEach((b, col) => {
      const value = valueOf(row * cols + col);
      b.style.background = value === null ? "rgb(0 0 0 / .45)" : `rgb(${colorAt(spec(), value).join(",")} / .72)`;
      b.setAttribute("aria-label", describeCell(row * cols + col));
    }));
    const s = spec();
    legend.replaceChildren(h(document, "span", { text: r.legendLow }), h(document, "span", { class: "dg-ramp", style: `background:linear-gradient(90deg,${s.stops.map(([t, rgb]) => `rgb(${rgb.join(",")}) ${t * 100}%`).join(",")})` }), h(document, "span", { text: r.legendHigh }), h(document, "span", { class: "ltr small", text: `${s.min}–${s.max} ${r.unit[state.phen]}` }));
  }
  const layers = h(document, "div", { class: "seg", role: "group", "aria-label": r.layer });
  const redrawLayers = () => {
    layers.replaceChildren();
    for (const id of level.phenomena) { const b = h(document, "button", { type: "button", "aria-pressed": state.phen === id, text: c.phenTitle[id] }); b.addEventListener("click", () => { state.phen = id; redrawLayers(); paintReview(); }); layers.append(b); }
    if (level.dates.from) for (const which of ["from", "main"]) { const b = h(document, "button", { type: "button", "aria-pressed": state.which === which, text: level.dates[which] }); b.addEventListener("click", () => { state.which = which; redrawLayers(); paintReview(); }); layers.append(b); }
  };
  redrawLayers();
  paintReview();
  const nextButton = nextLevel ? h(document, "button", { type: "button", class: "button", text: r.next }) : h(document, "button", { type: "button", class: "button", text: r.finish });
  nextButton.addEventListener("click", () => (nextLevel ? playLevel(app, nextLevel.id) : showAward(app)));
  const replay = h(document, "button", { type: "button", class: "button ghost", text: r.replay });
  replay.addEventListener("click", () => { store.saveCurrent(profile.id, { levelId: level.id, objectives: {} }); playLevel(app, level.id); });
  const all = h(document, "button", { type: "button", class: "button ghost", text: r.levels });
  all.addEventListener("click", () => showLevels(app));
  setScreen(app, "result", h(document, "section", { class: "dg-section dg-result", "aria-labelledby": "dg-result-title" },
    h(document, "p", { class: "eyebrow", text: fill(c.play.levelOf, { n: level.id, name: info.name }) }), h(document, "h1", { id: "dg-result-title", text: fill(r.title, { n: level.id }) }),
    h(document, "div", { class: "dg-result-score" }, h(document, "span", { class: "dg-big ltr", text: result.score }), h(document, "span", { class: "small", text: "/100 · " + r.best + " " + (outcome?.best ?? result.score) + " · " + r.total + " " + (outcome?.total ?? 0) + "/500" })),
    result.perfect ? h(document, "p", { class: "callout", text: r.perfect }) : null, outcome?.improved && !outcome.first ? h(document, "p", { class: "callout", text: r.improved }) : null,
    nextLevel ? h(document, "p", { class: "small", text: fill(r.unlocked, { n: nextLevel.id }) }) : null,
    h(document, "h2", { class: "dg-h2", text: r.objectives }), h(document, "ol", { class: "dg-breakdown" }, ...rows2),
    h(document, "div", { class: "actions" }, nextButton, replay, all),
    h(document, "h2", { class: "dg-h2", text: r.review }), h(document, "p", { class: "small", text: r.reviewNote }), layers, h(document, "div", { class: "dg-review-box" }, stage), legend, readout));
}

// ---------------------------------------------------------------------------------------------------------- final award
function showAward(app) {
  const { document, c, language, store } = app;
  const a = c.award;
  const profile = store.active();
  const total = profile.progress.total;
  const canvas = h(document, "canvas", { class: "dg-cert", width: CERT_SIZE.width, height: CERT_SIZE.height, role: "img" });
  const dateText = fill(a.date, { date: new Intl.DateTimeFormat(language === "ar" ? "ar-u-nu-latn" : "en-US", { dateStyle: "long" }).format(new Date(profile.progress.finishedAt ?? Date.now())) });
  const details = {
    name: profile.name, score: total, language, dateText,
    levels: LEVELS.map((l) => ({ n: l.id, name: c.levels.info[l.id].name, score: profile.progress.best[l.id] ?? 0 })),
    text: { certificate: a.certificate, team: a.team, congrats: fill(a.congrats, { name: profile.name }), line: fill(a.certText, { name: profile.name, score: total }), scoreLine: fill(a.score, { score: total }), disclaimer: a.disclaimer, date: dateText },
  };
  canvas.setAttribute("aria-label", fill(a.certText, { name: profile.name, score: total }) + " " + a.disclaimer);
  const draw = () => { const ctx = canvas.getContext("2d"); if (ctx) drawCertificate(ctx, details); };
  draw();
  document.fonts?.ready?.then(draw).catch(() => {});
  const download = h(document, "button", { type: "button", class: "button", text: a.download });
  download.addEventListener("click", () => { draw(); downloadCanvas(canvas, a.fileName + "-" + profile.name.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase(), { document }); });
  const replay = h(document, "button", { type: "button", class: "button ghost", text: a.replay });
  replay.addEventListener("click", () => showLevels(app));
  const explore = h(document, "a", { class: "button ghost", href: "./explore.html", text: a.explore });
  const bars = h(document, "ul", { class: "dg-summary" }, ...LEVELS.map((l) => h(document, "li", {}, h(document, "span", { text: fill(a.levelLine, { n: l.id, name: c.levels.info[l.id].name, score: profile.progress.best[l.id] ?? 0 }) }), h(document, "span", { class: "dg-bar", "aria-hidden": "true" }, h(document, "span", { class: "dg-bar-fill", style: `width:${profile.progress.best[l.id] ?? 0}%` })))));
  setScreen(app, "award", h(document, "section", { class: "dg-section dg-award" + (reducedMotion() ? " still" : ""), "aria-labelledby": "dg-award-title" },
    h(document, "div", { class: "dg-trophy", "aria-hidden": "true", text: "🏆" }), h(document, "p", { class: "eyebrow", text: a.title }), h(document, "h1", { id: "dg-award-title", text: fill(a.congrats, { name: profile.name }) }),
    h(document, "p", { class: "lede", text: a.text }), h(document, "p", { class: "dg-big ltr", text: fill(a.score, { score: total }) }), bars, canvas, h(document, "p", { class: "small", text: a.disclaimer }),
    h(document, "div", { class: "actions" }, download, replay, explore)));
}

export { fill as _fill };
