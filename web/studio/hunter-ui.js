import { cellId, fill, fillIso, trimNumber } from "../cinematic/site/cells.js";
import { h } from "../cinematic/site/dom.js";
import { formatChange, formatValue } from "./datasets.js";
import { cellCenter } from "./field.js";
import { QUERY, toHunterData } from "./hunter-core.js";
import { analysisCopy } from "./analysis-copy.js";
import { mapCopy } from "./earthmap-copy.js";

// Find signals (Feature 02): the form, the worker call, the ranked results pinned on the same map, and the
// "How was this found?" evidence. Nothing here computes science: hunter-core.js does, off the main thread.

const ORDER = [QUERY.HIGHEST, QUERY.THRESHOLD, QUERY.INCREASE, QUERY.DECREASE, QUERY.ANOMALY];

export function mountHunter(api, container) {
  const { document, store, language, state } = api;
  const a = analysisCopy[language].hunter;
  const m = mapCopy[language];
  const T = (template, values) => fillIso(template, values, language);
  const el = {};
  let controller = null;

  const spec = () => api.phen.spec;
  const unitName = () => m.phen.unitName[api.phen.id];
  const dates = () => api.phen.list.filter((s) => !api.lockedDates().includes(s.date));

  // ---- Form
  el.radios = h(document, "div", { class: "em-radios", role: "radiogroup", "aria-label": a.question });
  const radioFor = {};
  for (const type of ORDER) {
    const disabled = type === QUERY.ANOMALY;
    const input = h(document, "input", { type: "radio", name: "hunter-q", id: "hq-" + type, value: type, checked: type === QUERY.HIGHEST, disabled });
    const label = h(document, "label", { for: input.id, class: "em-radio" }, input, h(document, "span", { text: a.q[type] }));
    radioFor[type] = input;
    el.radios.append(label);
    input.addEventListener("change", syncForm);
  }
  el.anomalyNote = h(document, "p", { class: "small callout", text: a.anomalyNo });
  el.date = h(document, "select", { id: "hunter-date", "aria-label": a.date });
  el.from = h(document, "select", { id: "hunter-from", "aria-label": a.from });
  el.to = h(document, "select", { id: "hunter-to", "aria-label": a.to });
  el.threshold = h(document, "input", { type: "number", id: "hunter-threshold", step: "any", inputmode: "decimal", "aria-label": "threshold" });
  el.thresholdLabel = h(document, "label", { for: "hunter-threshold", class: "st-pick" });
  el.preset = h(document, "button", { type: "button", class: "button ghost small-button" });
  el.limit = h(document, "select", { id: "hunter-limit", "aria-label": a.limit }, ...[5, 10, 20].map((n) => h(document, "option", { value: n, text: String(n), selected: n === 10 })));
  el.search = h(document, "button", { type: "button", class: "button", text: a.search });
  el.cancel = h(document, "button", { type: "button", class: "button ghost", text: a.cancel, hidden: true });
  el.status = h(document, "p", { class: "callout", role: "status", "aria-live": "polite", text: a.idle });
  el.lockNote = h(document, "p", { class: "small", hidden: true, text: a.lockedDates });
  const pick = (id, label, node) => h(document, "label", { class: "st-pick", for: id }, h(document, "span", { text: label }), node);
  el.dateRow = pick("hunter-date", a.date, el.date);
  el.fromRow = pick("hunter-from", a.from, el.from);
  el.toRow = pick("hunter-to", a.to, el.to);
  el.thresholdRow = h(document, "div", { class: "em-threshold" }, el.thresholdLabel, el.threshold, el.preset);
  el.list = h(document, "ol", { class: "em-results", "aria-label": a.resultsLabel });
  el.how = h(document, "details", { class: "em-how", hidden: true });
  el.listen = h(document, "button", { type: "button", class: "button ghost small-button", text: a.listen, hidden: true });
  container.append(h(document, "section", { class: "panel", "aria-labelledby": "hunter-title" }, h(document, "h2", { id: "hunter-title", text: a.title }), h(document, "p", { class: "small", text: a.intro }),
    el.radios, el.anomalyNote, el.lockNote, el.dateRow, el.fromRow, el.toRow, el.thresholdRow, pick("hunter-limit", a.limit, el.limit),
    h(document, "div", { class: "st-tools-row" }, el.search, el.cancel), el.status),
    h(document, "section", { class: "panel", "aria-live": "off" }, el.list, el.listen, el.how));

  function fillDates() {
    const options = (selected) => dates().map((s) => h(document, "option", { value: s.date, text: s.date, selected: s.date === selected }));
    const list = dates();
    const dflt = list.find((s) => s.date === state.snapshot.date)?.date ?? list[0]?.date;
    el.date.replaceChildren(...options(dflt));
    el.from.replaceChildren(...options(list.find((s) => s.date === "2025-04-15")?.date ?? list[0]?.date));
    el.to.replaceChildren(...options(list.find((s) => s.date === "2025-07-15")?.date ?? list.at(-1)?.date));
    el.lockNote.hidden = api.lockedDates().length === 0;
  }
  function syncForm() {
    const type = selectedType();
    el.dateRow.hidden = !(type === QUERY.HIGHEST || type === QUERY.THRESHOLD);
    el.fromRow.hidden = el.toRow.hidden = !(type === QUERY.INCREASE || type === QUERY.DECREASE);
    el.thresholdRow.hidden = type !== QUERY.THRESHOLD;
    el.thresholdLabel.textContent = T(a.threshold, { unit: unitName() });
    const s = spec();
    if (document.activeElement !== el.threshold && (el.threshold.value === "" || el.threshold.dataset.phen !== api.phen.id)) { el.threshold.value = String(s.defaultThreshold); el.threshold.dataset.phen = api.phen.id; }
    el.preset.hidden = api.phen.id !== "dust";
    el.preset.textContent = T(a.preset, { value: s.decodeThreshold ?? "" });
    el.anomalyNote.hidden = false;
  }
  const selectedType = () => ORDER.find((type) => radioFor[type].checked) ?? QUERY.HIGHEST;
  el.preset.addEventListener("click", () => { el.threshold.value = String(spec().decodeThreshold); });

  // ---- Rendering of results
  const unitText = () => unitName();
  const valueText = (v) => formatValue(spec(), v);
  function describeFinding(f) {
    const id = cellId(f.row, f.col);
    if (f.delta !== null) return T(a.deltaRow, { id, delta: formatChange(spec(), f.delta), unit: unitText(), first: f.firstDate, second: f.secondDate });
    return T(a.valueRow, { id, value: valueText(f.value), unit: unitText(), date: f.date });
  }
  function linkPin(button, index) {
    for (const type of ["mouseenter", "focus"]) button.addEventListener(type, () => api.hoverPin?.(index));
    for (const type of ["mouseleave", "blur"]) button.addEventListener(type, () => api.hoverPin?.(null));
  }
  function renderPins() {
    const selected = store.state.selectedFindingId;
    api.setPins(store.state.findings.map((f) => ({ index: f.sampleId, label: f.rank, kind: "finding", selected: f.id === selected })));
  }
  function renderResults() {
    const findings = store.state.findings;
    el.list.replaceChildren(...findings.map((f) => {
      const b = h(document, "button", { type: "button", class: "em-result", "aria-pressed": String(f.id === store.state.selectedFindingId), "data-id": f.id, "data-index": f.sampleId },
        h(document, "span", { class: "em-rank", text: String(f.rank) }), h(document, "span", { text: describeFinding(f) }),
        f.delta !== null ? h(document, "span", { class: "small", text: f.percent !== null ? T(a.percent, { p: trimNumber(f.percent, 1) }) : a.percentNo }) : null);
      b.addEventListener("click", () => openFinding(f.id));
      linkPin(b, f.sampleId);
      return h(document, "li", {}, b);
    }));
    renderPins();
    if (findings.length) el.list.scrollIntoView?.({ block: "nearest" });
  }
  function renderHow(result, f) {
    if (!f) { el.how.hidden = true; return; }
    const rows = a.rows;
    const cells = [
      [rows.question, a.method[f.evidence.method === "largest increase" ? "largest_increase" : f.evidence.method === "largest decrease" ? "largest_decrease" : f.evidence.method.startsWith("value >=") ? "threshold" : "highest"] + (f.evidence.method.startsWith("value >=") ? ` (${f.evidence.method})` : "")],
      [rows.dataset, `${m.phen[api.phen.id]} · ${m.phen.measure[api.phen.id]} · ${unitText()}`],
      [rows.dates, f.evidence.dates.join(" → ")],
      [rows.calculation, f.evidence.formula],
      [rows.samples, String(f.evidence.inputCount) + " · " + T(a.total, { total: result.totalMatches, n: result.findings.length })],
      [rows.missing, String(result.missingExcluded)],
      [rows.build, f.evidence.build],
      [rows.source, f.evidence.granules.join(", ")],
      [rows.scope, result.scopeLabel],
      [rows.quality, f.quality.status + (f.quality.notes.length ? ": " + f.quality.notes.join(" ") : "")],
    ];
    const dl = h(document, "dl", { class: "kv" });
    for (const [k, v] of cells) dl.append(h(document, "dt", { text: k }), h(document, "dd", { class: "ltr mono", text: v }));
    el.how.replaceChildren(h(document, "summary", { text: a.how }), dl);
    el.how.hidden = false;
  }
  let lastResult = null;
  function setStatus(text, kind) { el.status.textContent = text; el.status.className = "callout" + (kind === "warn" ? " warn" : ""); }

  // ---- Search
  async function search() {
    controller?.abort();
    const type = selectedType();
    const query = { type, limit: Number(el.limit.value), date: el.date.value, startDate: el.from.value, endDate: el.to.value, threshold: el.threshold.value === "" ? Number.NaN : Number(el.threshold.value) };
    store.dispatch("RUN_HUNTER", { filters: query });
    const requestId = store.state.hunterRequestId;
    const datasetId = api.phen.id;
    controller = new AbortController();
    const mine = controller;
    el.search.disabled = true;
    el.cancel.hidden = false;
    setStatus(a.running);
    api.setPins([]);
    el.list.replaceChildren();
    el.how.hidden = true;
    try {
      const result = await api.analysis.request("hunter", query, toHunterData(api.phen, { excludeDates: api.lockedDates() }), mine.signal);
      store.dispatch("HUNTER_RESULT", { requestId, datasetId, findings: result.findings, status: result.status });
      if (store.state.hunterRequestId !== requestId || store.state.datasetId !== datasetId) return;
      lastResult = result;
      show(result);
    } catch (error) {
      if (error.name === "AbortError") { if (store.state.hunterStatus === "running") store.dispatch("CANCEL_SEARCH"); setStatus(a.cancelled); }
      else { store.dispatch("DATA_ERROR", { message: error.message }); setStatus(T(a.error, { reason: error.message }), "warn"); }
    } finally {
      if (controller === mine) { el.search.disabled = false; el.cancel.hidden = true; }
    }
  }
  function show(result) {
    renderResults();
    const reason = result.reason ?? "";
    const text = {
      results: T(a.results, { n: result.findings.length }) + ". " + T(a.total, { total: result.totalMatches, n: result.findings.length }) + " " + result.scopeLabel + ".",
      no_results: a.noResults + " " + result.scopeLabel + ".", insufficient_data: T(a.insufficient, { reason }), unsupported_period: T(a.unsupported, { reason }), error: T(a.error, { reason }), not_available: T(a.notAvailable, { reason }), cancelled: a.cancelled,
    }[result.status] ?? result.status;
    setStatus(text, ["results", "no_results"].includes(result.status) ? "ok" : "warn");
    if (result.status === "results") api.guided(T(a.found, { n: result.findings.length, id: cellId(result.findings[0].row, result.findings[0].col) }));
    renderHow(result, null);
  }
  el.search.addEventListener("click", search);
  el.cancel.addEventListener("click", () => { controller?.abort(); });

  // ---- Opening a finding: the same map moves, highlights, shows the evidence and can be heard.
  async function openFinding(id) {
    const f = store.state.findings.find((x) => x.id === id);
    if (!f) return;
    store.dispatch("OPEN_FINDING", { id });
    const cell = { row: f.row, col: f.col, index: f.sampleId };
    if (f.delta !== null) await api.showChangeFor(f.firstDate, f.secondDate); else await api.showValues(f.date);
    api.selectCell(cell, { play: false, say: false, user: false });
    const centre = cellCenter(api.grid, f.row, f.col);
    api.setView({ lon: centre.lon, lat: centre.lat, zoom: Math.max(api.state.view.zoom, 4) });
    renderResults();
    renderHow(lastResult, f);
    el.listen.hidden = false;
    if (api.audio.enabled) api.playCurrent();
    api.guided(T(a.opened, { rank: f.rank, id: cellId(f.row, f.col) }) + " " + describeFinding(f));
  }
  el.listen.addEventListener("click", async () => { if (!api.audio.enabled) await api.setSound(true); api.playCurrent(); });

  // ---- Keep the panel in step with the dataset and the locked dates.
  api.state.phenHooks = [...(api.state.phenHooks ?? []), () => { controller?.abort(); lastResult = null; el.list.replaceChildren(); el.how.hidden = true; el.listen.hidden = true; fillDates(); syncForm(); setStatus(a.idle); }];
  api.state.lockHooks = [...(api.state.lockHooks ?? []), () => { fillDates(); }];
  api.state.tabHooks = { ...(api.state.tabHooks ?? {}), HUNTER: () => { fillDates(); syncForm(); } };
  fillDates();
  syncForm();
  return { search, openFinding, render: renderResults, get result() { return lastResult; }, el };
}
