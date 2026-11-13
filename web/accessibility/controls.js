import { formatEvidence, renderEvidence } from "./evidence.js";

const labelFor = (index) => String(index + 1).padStart(2, "0");

export function mountAccessible(session, getLanguage, text) {
  const { data } = session;
  const byId = (id) => document.getElementById(id);
  const controls = Object.fromEntries([
    "horizontal", "vertical", "footprint", "band-min", "band-max", "band-controls", "vertical-controls",
    "height-step", "play", "pause", "replay", "previous", "next", "speed", "volume", "mute", "sound", "silent",
    "instruction", "plot-key", "position-text", "playback-status", "compare-low", "compare-high", "reveal",
    "guide-result", "open", "current-value", "current-label", "inspect", "observation", "evidence-content",
    "announcer", "begin", "begin-silent", "lens",
  ].map((id) => [id, byId(id)]));
  const send = session.dispatch;
  let current, voiceKey, inspected, language, rendered;
  let playbackKey;
  const bandName = (band, number) => `${number(band[0])}–${number(band[1])} ${text("meters")}`;
  const footprintName = (row) => `${text("footprint")} ${labelFor(row.index)}`;
  const selectOptions = (name, options) => controls[name].replaceChildren(
    ...options.map(([value, label]) => new Option(label, value)),
  );
  const on = (id, event, fn) => controls[id].addEventListener(event, fn);
  const activate = (id, action) => on(id, "click", (event) => {
    if (controls[id].getAttribute("aria-disabled") === "true") return;
    action(event);
  });

  function announce(message) {
    controls.announcer.textContent = message;
  }

  function placeFocus(element) {
    element.focus({ preventScroll: true });
    element.scrollIntoView({ block: "nearest" });
  }

  function optionsForBand(band, number) {
    const key = `${getLanguage()}:${band.join(":")}`;
    if (key === voiceKey) return;
    voiceKey = key;
    selectOptions("band-min", data.edges.slice(0, -1).map((edge) => [edge, number(edge)]));
    selectOptions("band-max", data.edges.slice(1).map((edge) => [edge, number(edge)]));
    controls["band-min"].value = band[0];
    controls["band-max"].value = band[1];
  }

  function renderGuide({ revealed, exploration }, number, percent) {
    controls.reveal.setAttribute("aria-expanded", String(revealed));
    controls["guide-result"].hidden = !revealed;
    controls.open.hidden = !revealed || exploration;
    if (!revealed || controls["guide-result"].dataset.locale === getLanguage()) return;
    const [low, high] = session.comparison;
    const result = controls["guide-result"];
    const comparison = document.createElement("strong");
    comparison.textContent = `${footprintName(low.observation)} · ${percent(low.evidence.value)} / ${footprintName(high.observation)} · ${percent(high.evidence.value)}`;
    const detail = document.createElement("p");
    const margin = number(data.guide.margin * 100);
    detail.textContent = getLanguage() === "ar"
      ? `بقيت البصمة ${labelFor(high.observation.index)} أعلى بفارق لا يقل عن ${margin} نقاط مئوية في اختبارات تغيّر المرجع الأرضي ومعالجة الضجيج.`
      : `Footprint ${labelFor(high.observation.index)} remained at least ${margin} percentage points higher across the ground-reference and noise-processing tests.`;
    result.replaceChildren(comparison, detail);
    result.dataset.locale = getLanguage();
  }

  function render(state) {
    current = state;
    const lang = getLanguage();
    const { transport } = state;
    const renderKey = [lang, state.event.id, state.selection.axis, transport.status, transport.playback,
      transport.audioUnavailable, transport.speed, transport.volume, transport.muted, state.revealed,
      state.exploration, controls.observation.open].join("|");
    if (renderKey === rendered && inspected === state.inspected) return;
    rendered = renderKey;
    const { number, percent } = formatEvidence(lang);
    const horizontal = state.selection.axis === "horizontal";
    const index = state.plan.events.indexOf(state.event);
    const reading = state.event.evidence;
    const active = state.transport.status;
    const activated = active === "playing" || active === "starting";
    controls.horizontal.setAttribute("aria-pressed", String(horizontal));
    controls.vertical.setAttribute("aria-pressed", String(!horizontal));
    controls["band-controls"].hidden = !horizontal;
    controls["vertical-controls"].hidden = horizontal;
    controls.footprint.value = state.observation.id;
    if (horizontal) optionsForBand(state.selection.bandM, number);
    else controls["height-step"].value = index;
    controls.instruction.textContent = text(horizontal ? "axisHorizontal" : "axisVertical");
    controls["plot-key"].textContent = text(horizontal ? "keyHorizontal" : "keyVertical");
    const where = `${footprintName(state.observation)} · ${bandName(reading.band, number)}`;
    controls["position-text"].textContent = `${where} · ${number(index + 1)} ${text("of")} ${number(state.plan.events.length)}`;
    const value = reading.value === null ? "—" : percent(reading.value);
    controls["current-value"].textContent = value;
    controls["current-value"].dataset.event = state.event.id;
    const qualifier = reading.observationStatus === "below_threshold" ? text("below") : reading.value === null ? text("missing") : "";
    controls["current-label"].textContent = qualifier ? `${where} · ${qualifier}` : where;
    controls.play.setAttribute("aria-disabled", String(activated));
    controls.pause.setAttribute("aria-disabled", String(!activated));
    controls.previous.setAttribute("aria-disabled", String(index === 0));
    controls.next.setAttribute("aria-disabled", String(index === state.plan.events.length - 1));
    controls.speed.value = state.transport.speed;
    controls.volume.value = Math.round(state.transport.volume * 100);
    controls.mute.checked = state.transport.muted;
    for (const [i, id] of ["compare-low", "compare-high"].entries()) {
      const { observation } = session.comparison[i];
      controls[id].textContent = footprintName(observation);
      controls[id].setAttribute("aria-pressed", String(horizontal && state.observation.id === observation.id
        && reading.band[0] === data.guide.band[0] && reading.band[1] === data.guide.band[1]));
    }
    const status = state.transport.audioUnavailable && active === "playing" ? "fallback"
      : active === "playing" && state.transport.playback === "silent" ? "playingSilent"
      : active === "idle" ? "ready" : active;
    controls["playback-status"].textContent = text(status);
    const key = `${lang}:${status}:${activated ? "" : state.event.id}`;
    if (key !== playbackKey) {
      playbackKey = key;
      announce(activated ? text(status) : `${text(status)}. ${where}. ${qualifier || value}`);
    }
    renderGuide(state, number, percent);
    if (controls.observation.open && (inspected !== state.inspected || language !== lang)) {
      renderEvidence(controls["evidence-content"], state.inspected ?? { ...reading, observation: state.observation },
        data, lang, text);
      inspected = state.inspected;
      language = lang;
    }
    inspected = state.inspected;
  }

  function refresh() {
    const { number } = formatEvidence(getLanguage());
    selectOptions("footprint", data.footprints.map((row) => [row.id, footprintName(row)]));
    selectOptions("height-step", data.edges.slice(0, -1).map((edge, index) => [index, bandName([edge, data.edges[index + 1]], number)]));
    render(session.snapshot());
  }

  const start = (mode) => {
    send({ type: "play", mode, fromStart: true });
    placeFocus(controls.lens);
  };
  activate("begin", () => start("audio"));
  activate("begin-silent", (event) => { event.preventDefault(); start("silent"); });
  activate("horizontal", () => send({ type: "axis", axis: "horizontal" }));
  activate("vertical", () => send({ type: "axis", axis: "vertical" }));
  on("footprint", "change", () => send({ type: "footprint", shotId: controls.footprint.value }));
  on("height-step", "change", () => send({ type: "height", index: +controls["height-step"].value }));
  for (const id of ["band-min", "band-max"]) {
    on(id, "change", () => {
      let low = +controls["band-min"].value;
      let high = +controls["band-max"].value;
      if (low >= high && id === "band-min") high = low + 1;
      else if (low >= high) low = high - 1;
      send({ type: "band", band: [low, high] });
    });
  }
  activate("play", () => send({ type: "play", mode: current.transport.playback }));
  activate("pause", () => send({ type: "pause" }));
  activate("replay", () => send({ type: "replay", mode: current.transport.playback }));
  activate("previous", () => send({ type: "step", direction: -1 }));
  activate("next", () => send({ type: "step", direction: 1 }));
  for (const [id, mode] of [["silent", "silent"], ["sound", "audio"]]) {
    activate(id, () => {
      send({ type: "pause" });
      send({ type: "play", mode });
    });
  }
  on("speed", "change", () => send({ type: "speed", value: +controls.speed.value }));
  on("volume", "input", () => send({ type: "volume", value: +controls.volume.value / 100 }));
  on("mute", "change", () => send({ type: "mute", value: controls.mute.checked }));
  activate("compare-low", () => send({ type: "compare", shotId: data.guide.low }));
  activate("compare-high", () => send({ type: "compare", shotId: data.guide.high }));
  activate("reveal", () => {
    send({ type: "reveal" });
    placeFocus(controls["guide-result"]);
  });
  activate("open", () => {
    send({ type: "explore" });
    placeFocus(controls.horizontal);
  });
  activate("inspect", () => {
    controls.observation.open = true;
    send({ type: "inspect" });
    placeFocus(controls["evidence-content"]);
  });
  on("observation", "toggle", () => {
    if (controls.observation.open && !controls["evidence-content"].firstChild) send({ type: "inspect" });
    else render(session.snapshot());
  });
  refresh();
  const dispose = session.subscribe(render);
  return { refresh, dispose };
}
