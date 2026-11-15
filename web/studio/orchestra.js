import { h } from "../cinematic/site/dom.js";
import { isLocked, formatValue, PHENOMENA } from "./datasets.js";
import { spoilersUnlocked } from "../cinematic/site/progress.js";
import { ORCHESTRA_IDS, channelCompatibility, defaultChannels, orchestraPlan, timeKey } from "./orchestra-data.js";
import { orchestraCopy } from "./orchestra-copy.js";
import { channelPresentation, chooseListeningWindow, windowIdentity } from "./orchestra-state.js";

/** A bottom workspace using the Studio's one transport, analyser and speech manager. */
export function mountOrchestra(api, app) {
  const { document, audio, speech, state, language, pkg } = api;
  const c = orchestraCopy[language];
  const settings = defaultChannels();
  const datasets = {};
  let observations = {}, open = false, loading = false, revision = 0, action = 0, loadedKey = null, currentWindow = null, windowPreference = null, lastContext = null, wantsPlay = false, playback = "idle";
  let alternative = null, windowUnavailable = false, lastTransportRender = null;
  const controls = {};
  let audioError = false;
  const button = (text, action, props = {}) => {
    const b = h(document, "button", { type: "button", class: "button ghost small-button", text, ...props });
    b.addEventListener("click", action); return b;
  };
  const title = h(document, "h2", { id: "orchestra-title", text: c.title });
  const status = h(document, "span", { class: "orchestra-status", role: "status", "aria-live": "polite" });
  const counts = h(document, "p", { class: "orchestra-counts", role: "status", "aria-live": "polite" });
  const metrics = [c.compatibleCount, c.enabledCount, c.audibleCount].map(text => h(document, "span", {}, h(document, "strong"), " " + text));
  counts.append(...metrics);
  const location = h(document, "p", { class: "orchestra-context", dir: "auto" });
  const mapContext = h(document, "p", { class: "orchestra-map-context" });
  const windowSelect = h(document, "select", { id: "orchestra-window", "aria-label": c.window });
  const play = button(c.play, () => start(), { "data-orchestra": "play" });
  const pause = button(c.pause, () => { action++; wantsPlay = false; speech.cancel(); audio.transport.pause(); playback = "paused"; render(); }, { "data-orchestra": "pause" });
  const stop = button(c.stop, () => stopPlayback(), { "data-orchestra": "stop" });
  const replay = button(c.replay, () => start(true), { "data-orchestra": "replay" });
  const close = button(c.close, () => setOpen(false), { "aria-controls": "orchestra-workspace" });
  const channels = h(document, "div", { class: "orchestra-channels" });
  const jumps = h(document, "div", { class: "orchestra-jumps", role: "group", "aria-label": c.jumpLabel });
  const explanation = h(document, "p", { class: "orchestra-explanation", role: "status", hidden: true });
  const windowMessage = h(document, "span");
  const useAlternative = button(c.useAlternative, () => {
    if (!alternative || loading) return;
    windowPreference = windowIdentity(alternative.key);
    refresh({ resume: false });
  }, { "data-orchestra": "alternative" });
  const windowNotice = h(document, "p", { class: "orchestra-window-notice", role: "status", hidden: true }, windowMessage, " ", useAlternative);
  const scroll = h(document, "div", { class: "orchestra-scroll", role: "region", tabindex: "0", "aria-label": c.channels }, channels, explanation, h(document, "p", { class: "orchestra-note", text: c.note }));
  const workspace = h(document, "section", { id: "orchestra-workspace", class: "orchestra-workspace", hidden: true, "aria-labelledby": "orchestra-title" },
    h(document, "div", { class: "orchestra-heading" }, h(document, "div", {}, h(document, "p", { class: "eyebrow", text: c.eyebrow }), title), status, close),
    counts, h(document, "div", { class: "orchestra-transport" }, location, h(document, "label", { class: "orchestra-window-label" }, c.window, windowSelect), h(document, "div", { class: "orchestra-actions", role: "group", "aria-label": c.title }, play, pause, stop, replay)),
    mapContext, windowNotice, jumps, scroll);
  const opener = button(c.open, () => setOpen(!open), { id: "orchestra-toggle", "aria-expanded": "false", "aria-controls": "orchestra-workspace" });
  api.el.bottom.append(opener);
  app.append(workspace);

  for (const id of ORCHESTRA_IDS) {
    const name = c.names[id];
    const active = h(document, "input", { type: "checkbox", checked: true, "aria-label": `${name} · ${c.enabled}` });
    const value = h(document, "strong", { class: "orchestra-value", dir: "auto" });
    const availability = h(document, "p", { class: "orchestra-availability" });
    const meta = h(document, "p", { class: "orchestra-meta", dir: "ltr" });
    const mute = button(c.mute, () => change(id, "muted", !settings[id].muted), { "aria-label": `${name} · ${c.mute}`, "aria-pressed": "false" });
    const solo = button(c.solo, () => change(id, "solo", !settings[id].solo), { "aria-label": `${name} · ${c.solo}`, "aria-pressed": "false" });
    const gain = h(document, "input", { type: "range", min: 0, max: 100, step: 1, value: 70, "aria-label": `${name} · ${c.gain}` });
    const gainValue = h(document, "output", { text: "70%" });
    const reasonId = `orchestra-${id}-reason`;
    availability.id = reasonId;
    for (const control of [active, mute, solo, gain]) control.setAttribute("aria-describedby", reasonId);
    active.addEventListener("change", () => change(id, "enabled", active.checked));
    gain.addEventListener("input", () => { gainValue.textContent = gain.value + "%"; change(id, "gain", Number(gain.value) / 100); });
    const explain = button(c.explain, () => {
      const item = observations[id];
      const text = `${name}. ${value.textContent}. ${meta.textContent}. ${item?.ok ? c.mapping[id] : c.reasons[item?.reason] ?? c.reasons.missing}`;
      explanation.hidden = false; explanation.textContent = text; speech.say(text);
    }, { "aria-label": `${name} · ${c.explain}` });
    const evidence = h(document, "p", { class: "orchestra-evidence", dir: "auto" });
    const mapping = h(document, "details", { class: "orchestra-mapping" }, h(document, "summary", { text: c.explain }), h(document, "p", { text: c.mapping[id] }), evidence, explain);
    const row = h(document, "article", { id: `orchestra-channel-${id}`, class: "orchestra-channel", tabindex: "-1", "data-channel": id, "aria-label": name },
      h(document, "div", { class: "orchestra-channel-head" }, h(document, "label", {}, active, h(document, "span", { text: name })), value),
      meta, availability, h(document, "div", { class: "orchestra-channel-controls" }, mute, solo, h(document, "label", { class: "orchestra-gain" }, h(document, "span", { class: "visually-hidden", text: c.gain }), gain, gainValue)), mapping);
    const jump = button(name, () => {
      const top = scroll.scrollTop + row.getBoundingClientRect().top - scroll.getBoundingClientRect().top;
      scroll.scrollTo({ top, behavior: api.reduced() ? "instant" : "smooth" });
      row.focus({ preventScroll: true });
    }, { "aria-controls": row.id, "aria-label": `${c.jumpLabel} · ${name}`, "data-jump": id });
    jumps.append(jump);
    channels.append(row); controls[id] = { active, value, availability, meta, mute, solo, gain, row, evidence, jump };
  }

  function effective() {
    return Object.fromEntries(ORCHESTRA_IDS.map(id => [id, { ...settings[id], enabled: Boolean(observations[id]?.ok && settings[id].enabled) }]));
  }
  function render() {
    const snap = audio.transport.snapshot();
    const outputOn = audio.enabled && snap.volume > 0 && !snap.muted;
    const playing = playback === "playing" && snap.playback === "audio" && !snap.audioUnavailable && !snap.awaitingOnset;
    const summary = channelPresentation(loading ? {} : observations, settings, { playing, outputOn });
    status.textContent = loading ? c.loading : audioError ? c.error : !summary.compatible ? c.unavailable : c[playback] ?? c.ready;
    workspace.dataset.state = loading ? "loading" : !summary.compatible ? "unavailable" : playback;
    for (const [i, key] of ["compatible", "enabled", "audible"].entries()) {
      workspace.dataset[key] = String(summary[key]);
      const number = summary[key].toLocaleString(language);
      if (metrics[i].firstChild.textContent !== number) metrics[i].firstChild.textContent = number;
    }
    workspace.setAttribute("aria-busy", String(loading));
    play.disabled = loading || !summary.canSound || playback === "playing" || playback === "starting";
    replay.disabled = loading || !summary.canSound;
    pause.disabled = !["playing", "starting"].includes(playback);
    play.title = summary.canSound ? "" : c.mutedAll;
    windowNotice.hidden = loading || !windowUnavailable;
    windowMessage.textContent = c.windowUnavailable + " " + (alternative ? c.alternativeAvailable + " " + (alternative.anchor.time.kind === "one-hour mean" ? c.hour : c.dustWindow) : c.noAlternative);
    useAlternative.hidden = !alternative;
    useAlternative.disabled = loading;
    windowSelect.disabled = loading;
    const cell = state.selected ?? state.cursor;
    const physical = api.grid.cells?.[cell?.index];
    location.textContent = physical ? `${c.source} · ${physical.lat.toFixed(2)}°, ${physical.lon.toFixed(2)}° · ${state.snapshot.date}` : c.select;
    mapContext.textContent = `${c.mapLayer}: ${c.names[api.phen.id]} · \u2066${state.snapshot.time.start.slice(11, 16)}–${state.snapshot.time.end.slice(11, 16)} UTC\u2069. ${c.windowIndependent}`;
    for (const id of ORCHESTRA_IDS) {
      const ui = controls[id], item = observations[id], s = settings[id];
      const layer = summary.channels[id], ok = layer.compatible;
      for (const input of [ui.active, ui.mute, ui.solo, ui.gain]) input.disabled = !ok;
      ui.active.checked = s.enabled && ok;
      ui.mute.setAttribute("aria-pressed", String(s.muted)); ui.solo.setAttribute("aria-pressed", String(s.solo));
      ui.row.dataset.available = String(ok);
      ui.row.dataset.enabled = String(layer.enabled);
      ui.row.dataset.audible = String(layer.audible);
      ui.row.dataset.silent = String(layer.silent);
      ui.jump.dataset.available = String(ok);
      const unit = id === "dust" ? "1" : id === "rainfall" ? "mm / 1 h" : PHENOMENA[id].unitLabel;
      ui.value.textContent = Number.isFinite(item?.value) ? `${formatValue(PHENOMENA[id], item.value)} ${unit}` : "—";
      const snap = item?.snapshot;
      ui.meta.textContent = snap ? `${PHENOMENA[id].variable} · ${snap.time.start.slice(11, 16)}–${snap.time.end.slice(11, 16)} UTC · ${snap.source.shortName}` : PHENOMENA[id].variable;
      ui.meta.title = snap ? `${snap.id}\n${snap.source.modelSource}\n${snap.source.granule}\n${snap.warnings.join("\n")}` : "";
      ui.evidence.textContent = snap ? `${snap.time.start} — ${snap.time.end}\n${snap.source.product}\n${snap.source.modelSource}\n${snap.source.granule}\n${snap.warnings.join("\n")}\n${snap.catalogValidation?.ok === false ? c.reasons.catalog : ""}` : "";
      ui.availability.textContent = loading ? c.loading : !ok ? item?.reason === "comparison" ? c.comparison : c.reasons[item?.reason] ?? c.reasons.missing : layer.silent ? c.dryExplanation : !s.enabled ? c.off : s.muted ? c.muted : layer.excluded ? c.excluded : s.gain === 0 ? c.zeroGain : !outputOn ? c.masterOff : layer.audible ? (s.solo ? c.isolated + " · " : "") + c.sounding : c.ready;
      ui.jump.title = ui.availability.textContent;
      ui.jump.setAttribute("aria-label", `${c.jumpLabel} · ${c.names[id]} · ${ui.availability.textContent}`);
    }
  }
  function change(id, key, value) { settings[id][key] = value; audio.transport.setChannels(effective()); render(); }
  function stopPlayback() { action++; wantsPlay = false; speech.cancel(); audio.stop(); audio.transport.stop(); playback = "stopped"; render(); }

  async function refresh({ resume = wantsPlay } = {}) {
    if (!open) return;
    const mine = ++revision;
    action++;
    const contextKey = `${api.phen.id}|${state.snapshot.id}`;
    lastContext = contextKey;
    // Clear stale sound and speech BEFORE asynchronous data access.
    speech.cancel(); loadedKey = null; audio.stop(); wantsPlay = resume; playback = "idle"; loading = true;
    explanation.hidden = true; render();
    await Promise.all(ORCHESTRA_IDS.map(async id => {
      try { datasets[id] = await pkg.openPhenomenon(id); } catch { datasets[id] = null; }
    }));
    if (mine !== revision || !open) return;
    const date = state.snapshot.date;
    const cell = state.selected ?? state.cursor;
    const observe = anchor => Object.fromEntries(ORCHESTRA_IDS.map(id => {
      const phen = datasets[id], snap = phen?.byDate(date);
      const result = state.comparison ? { ok: false, reason: "comparison" } : !phen ? { ok: false, reason: "load" } : channelCompatibility({ primary: state.snapshot, anchor, candidate: snap, grid: phen.grid, referenceGrid: api.grid, index: cell?.index, integrity: pkg.integrity.mode === "sha256", locked: isLocked(id, date, spoilersUnlocked()) });
      return [id, { ...result, snapshot: snap, index: cell?.index }];
    }));
    // Every candidate goes through the same existing scientific checks. A bad anchor
    // must not hide another valid subgroup sharing its actual averaging window.
    const windows = new Map();
    for (const id of ORCHESTRA_IDS) {
      const anchor = datasets[id]?.byDate(date);
      if (!anchor) continue;
      const key = timeKey(anchor), observations = observe(anchor);
      const compatible = Object.values(observations).filter(o => o.ok).length;
      if (!windows.has(key) || compatible > windows.get(key).compatible) windows.set(key, { key, anchor, observations, compatible });
    }
    const choices = [...windows.values()].sort((a, b) => a.key.localeCompare(b.key));
    const choice = chooseListeningWindow(choices, windowPreference);
    currentWindow = choice.selected?.key ?? null;
    if (!windowPreference && choice.selected?.compatible) windowPreference = windowIdentity(currentWindow);
    observations = choice.selected?.observations ?? observe(null);
    alternative = choice.alternative; windowUnavailable = choice.unavailable;
    if (windowUnavailable) wantsPlay = false;
    const options = choices.map(w => h(document, "option", { value: w.key, disabled: !w.compatible, selected: w.key === currentWindow, text: w.anchor.time.kind === "one-hour mean" ? c.hour : c.dustWindow }));
    if (!currentWindow) options.unshift(h(document, "option", { value: "", disabled: true, selected: true, text: c.selectedWindowUnavailable }));
    windowSelect.replaceChildren(...options);
    loading = false;
    if (state.comparison) { for (const item of Object.values(observations)) item.reason = "comparison"; }
    render();
    // Stop/Pause during an asynchronous refresh must revoke its earlier resume intent.
    if (resume && wantsPlay) await start();
  }
  async function start(restart = false) {
    if (!open || loading || !ORCHESTRA_IDS.some(id => observations[id]?.ok && settings[id].enabled)) return;
    // No confirmation note: Orchestra itself is the explicit audio gesture.
    const mine = ++action;
    audioError = false;
    await api.setSound(true);
    if (mine !== action || !open || loading) return;
    wantsPlay = true;
    const key = `${lastContext}|${currentWindow}|${(state.selected ?? state.cursor)?.index}`;
    if (loadedKey !== key) { audio.stop(); audio.transport.setSpeed(1); audio.transport.load(orchestraPlan(observations, settings)); loadedKey = key; }
    audio.transport.setChannels(effective());
    if (restart) audio.transport.seek(0);
    await audio.transport.play();
    if (audio.unavailable) { audioError = true; wantsPlay = false; audio.transport.stop(); playback = "idle"; render(); }
  }
  windowSelect.addEventListener("change", () => { windowPreference = windowIdentity(windowSelect.value); refresh(); });
  function setOpen(on) {
    if (open === on) return;
    open = on; workspace.hidden = !on; opener.setAttribute("aria-expanded", String(on)); app.classList.toggle("orchestra-open", on);
    if (on) { api.stopRun?.(true); api.setTab("explore"); audio.stop(); refresh({ resume: false }); }
    else { revision++; stopPlayback(); observations = {}; opener.focus(); }
    api.win.requestAnimationFrame(() => api.win.dispatchEvent(new Event("resize")));
  }
  workspace.addEventListener("keydown", event => { if (event.key === "Escape") { event.stopPropagation(); setOpen(false); } });
  const unsubscribe = audio.transport.subscribe(snap => {
    if (!open || loadedKey === null) return;
    if (!(snap.status === "paused" && playback === "stopped")) playback = snap.status;
    if (snap.status === "ended") wantsPlay = false;
    // Transport emits every animation frame; update the UI only on state transitions.
    const key = [playback, snap.awaitingOnset, snap.playback, snap.audioUnavailable, snap.volume > 0, snap.muted, audio.enabled].join("|");
    if (lastTransportRender !== key) { lastTransportRender = key; render(); }
  });
  state.selectHooks ??= [];
  state.selectHooks.push(() => { if (open) refresh(); });
  state.dataHooks.push(() => { if (open) refresh(); });
  api.win.addEventListener("pagehide", event => {
    revision++; action++; wantsPlay = false; speech.cancel(); audio.disable();
    // A cached Back/Forward page keeps its controller and subscriptions for return.
    if (!event.persisted) { unsubscribe(); audio.transport.dispose(); }
  });
  const controller = { get open() { return open; }, get settings() { return settings; }, get observations() { return observations; }, get window() { return currentWindow; }, setOpen, play: start, stop: stopPlayback, refresh };
  api.orchestra = controller;
  return controller;
}
