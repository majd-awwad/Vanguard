import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir, writeFile } from "node:fs/promises";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href : "playwright");
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER, headless: true });
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";
const out = process.env.EARTHPULSE_AUDIO_OUTPUT ?? "tmp/orchestra-audio";
await mkdir(out, { recursive: true });
const errors = [], requestsFailed = [];
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", message => { if (message.type() === "error") errors.push(`console: ${message.text()}`); });
  page.on("requestfailed", r => requestsFailed.push(r.url()));
  await page.addInitScript(() => {
    window.nativeAudioAudit = { contexts: [], active: new Set(), total: 0 };
    const Context = window.AudioContext;
    window.AudioContext = class extends Context { constructor(...a) { super(...a); window.nativeAudioAudit.contexts.push(this); } };
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...a) {
      const result = start.apply(this, a), ended = this.onended;
      window.nativeAudioAudit.active.add(this); window.nativeAudioAudit.total++;
      this.onended = event => { window.nativeAudioAudit.active.delete(this); ended?.call(this, event); };
      return result;
    };
  });
  await page.goto(`${base}pages/studio.html?entry=skip&mode=pure&debug`);
  await page.locator("#orchestra-toggle").click();
  const ready = () => page.waitForFunction(() => document.querySelector("#orchestra-workspace").getAttribute("aria-busy") === "false");
  await ready();

  const renders = await page.evaluate(async () => {
    const { createTransport } = await import("/audio/transport.js");
    const { orchestraPlan, channelCompatibility, defaultChannels, ORCHESTRA_IDS } = await import("/studio/orchestra-data.js");
    const { soundParams } = await import("/studio/sonify.js");
    const { cellId } = await import("/cinematic/site/cells.js");
    const a = window.__studio, date = "2025-04-15";
    const datasets = Object.fromEntries(await Promise.all(ORCHESTRA_IDS.map(async id => [id, await a.pkg.openPhenomenon(id)])));
    const results = [];
    async function render(label, selected, index, { mute = false, stop = false, day = date } = {}) {
      const primary = datasets[selected === "mix" ? "temperature" : selected].byDate(day);
      const settings = defaultChannels(), obs = {};
      for (const id of ORCHESTRA_IDS) {
        const s = datasets[id].byDate(day);
        obs[id] = { ...channelCompatibility({ primary, anchor: primary, candidate: s, grid: datasets[id].grid, referenceGrid: datasets.temperature.grid, index }), snapshot: s, index };
        settings[id] = { enabled: selected === "mix" || selected === id, muted: mute, solo: false, gain: 1 };
      }
      const plan = orchestraPlan(obs, settings, 2);
      const native = new OfflineAudioContext(2, Math.ceil(2.1 * 48000), 48000);
      // Only the test reports the Offline context as running so the unchanged transport
      // can schedule its graph before startRendering. All nodes and rendering are native.
      const adapter = new Proxy(native, { get(target, key) { if (key === "state") return "running"; const value = Reflect.get(target, key, target); return typeof value === "function" ? value.bind(target) : value; } });
      const transport = createTransport({ createContext: () => adapter, requestFrame: () => 1, cancelFrame: () => {} });
      transport.setVolume(1); transport.load(plan); await transport.play();
      let cancelled;
      if (stop) cancelled = native.suspend(0.5).then(() => { transport.stop(); return native.resume(); });
      const buffer = await native.startRendering(); await cancelled;
      const left = buffer.getChannelData(0), right = buffer.getChannelData(1);
      let peak = 0, energyL = 0, energyR = 0, tailPeak = 0, maxStep = 0, crossings = 0, bursts = 0, lastNonzero = -10000;
      for (let i = 0; i < left.length; i++) {
        const v = Math.max(Math.abs(left[i]), Math.abs(right[i]));
        if (!Number.isFinite(v)) throw Error("Non-finite rendered samples");
        peak = Math.max(peak, v); energyL += left[i] ** 2; energyR += right[i] ** 2;
        if (i > 0) maxStep = Math.max(maxStep, Math.abs(left[i] - left[i - 1]), Math.abs(right[i] - right[i - 1]));
        if (i >= 0.65 * 48000) tailPeak = Math.max(tailPeak, v);
        if (i >= 0.25 * 48000 && i < 1.25 * 48000 && left[i - 1] <= 0 && left[i] > 0) crossings++;
        if (v > 0.00001) { if (i - lastNonzero > 240) bursts++; lastNonzero = i; }
      }
      const bytes = new ArrayBuffer(44 + left.length * 4), view = new DataView(bytes);
      const text = (at, s) => { for (let i = 0; i < s.length; i++) view.setUint8(at + i, s.charCodeAt(i)); };
      text(0, "RIFF"); view.setUint32(4, bytes.byteLength - 8, true); text(8, "WAVE"); text(12, "fmt "); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 2, true); view.setUint32(24, 48000, true); view.setUint32(28, 192000, true); view.setUint16(32, 4, true); view.setUint16(34, 16, true); text(36, "data"); view.setUint32(40, bytes.byteLength - 44, true);
      for (let i = 0; i < left.length; i++) for (let ch = 0; ch < 2; ch++) view.setInt16(44 + i * 4 + ch * 2, Math.round(Math.max(-1, Math.min(1, ch ? right[i] : left[i])) * 32767), true);
      let binary = ""; const raw = new Uint8Array(bytes);
      for (let i = 0; i < raw.length; i += 8192) binary += String.fromCharCode(...raw.subarray(i, i + 8192));
      const evidence = Object.fromEntries(ORCHESTRA_IDS.filter(id => settings[id].enabled && obs[id].ok).map(id => {
        const tone = plan.events.find(e => e.channelId === id)?.tone;
        // A terminal pulse is dropped by the existing scheduler if it cannot fit
        // its safe attack/release envelope before the selected excerpt ends.
        const audiblePulses = tone?.pulses?.filter(at => Math.min(tone.durationS, plan.durationS - at) >= tone.attackS + tone.releaseS).length ?? 0;
        return [id, { value: obs[id].value, snapshot: obs[id].snapshot.id, source: obs[id].snapshot.source.modelSource, unit: id === "rainfall" ? "mm over 1 h" : id === "temperature" ? "degC" : id === "wind" ? "m/s" : "1", params: soundParams(id, obs[id].info), pulses: tone?.pulses?.length ?? 0, audiblePulses }];
      }));
      const cell = datasets.temperature.grid.cells[index];
      results.push({ label, selected, date: day, index, cell: cellId(cell.row, cell.col), lat: cell.lat, lon: cell.lon, evidence, peak, rmsLeft: Math.sqrt(energyL / left.length), rmsRight: Math.sqrt(energyR / right.length), tailPeak, maxStep, estimatedHz: crossings, bursts, wav: btoa(binary) });
      transport.dispose();
    }
    for (const id of ORCHESTRA_IDS) {
      const values = datasets[id].byDate(date).values;
      const candidates = values.map((value, index) => ({ value, index })).filter(v => Number.isFinite(v.value) && (id !== "rainfall" || v.value > 0.05)).sort((a, b) => a.value - b.value);
      await render(`${id}-low`, id, candidates[0].index);
      await render(`${id}-high`, id, candidates.at(-1).index);
    }
    const dry = datasets.rainfall.byDate(date).values.findIndex(v => v === 0);
    await render("rainfall-dry", "rainfall", dry);
    const wet = datasets.rainfall.byDate(date).values.findIndex(v => v > 0.5);
    await render("hourly-mix", "mix", wet);
    await render("hourly-muted", "mix", wet, { mute: true });
    await render("hourly-stop-fade", "mix", wet, { stop: true });
    await render("scenario-F23", "mix", 222, { day: "2025-02-15" });
    await render("scenario-I7", "mix", 326, { day: "2025-11-15" });
    await render("scenario-F15", "mix", 214, { day: "2025-04-15" });
    await render("scenario-H21", "mix", 300, { day: "2025-11-15" });
    return { results, catalogConflicts: a.pkg.integrity.catalogConflicts };
  });
  for (const r of renders.results) {
    const { wav, ...metric } = r;
    await writeFile(`${out}/${r.label}.wav`, Buffer.from(wav, "base64"));
    delete r.wav;
    assert.ok(r.peak < 0.2, `${r.label}: no clipping, peak ${r.peak}`);
    if (["rainfall-dry", "hourly-muted"].includes(r.label)) assert.equal(r.peak, 0);
    else assert.ok(r.peak > 0.001, `${r.label}: audible native output`);
    if (r.selected === "temperature") assert.ok(Math.abs(r.estimatedHz - r.evidence.temperature.params.frequencyHz) < 3, "rendered temperature pitch follows real Celsius");
    if (["rainfall", "dust"].includes(r.selected) && r.label !== "rainfall-dry") assert.equal(r.bursts, r.evidence[r.selected].audiblePulses, "rendered pulse density follows real values within the excerpt envelope");
    if (r.selected === "wind") {
      const pan = r.evidence.wind.params.pan;
      assert.ok(pan >= 0 ? r.rmsRight >= r.rmsLeft : r.rmsLeft >= r.rmsRight, "actual stereo energy follows wind flow");
    }
    if (r.label === "hourly-stop-fade") assert.equal(r.tailPeak, 0, "Stop cancels future and sustained native audio after its fade");
    console.log(`RENDER ${r.label}: value ${JSON.stringify(Object.fromEntries(Object.entries(r.evidence).map(([id, e]) => [id, e.value])))}; peak ${r.peak.toFixed(5)}; ${r.cell} (${r.lat}, ${r.lon})`);
  }
  for (const id of ["rainfall", "wind", "dust", "temperature"]) {
    const low = renders.results.find(r => r.label === `${id}-low`), high = renders.results.find(r => r.label === `${id}-high`);
    const key = id === "temperature" ? "frequencyHz" : "rate";
    assert.ok(high.evidence[id].params[key] > low.evidence[id].params[key], `${id}: actual source range changes its meaningful audio parameter`);
  }
  await writeFile(`${out}/metrics.json`, JSON.stringify(renders, null, 2));

  // Real UI: dust playback and metadata-conflict rejection, with the hourly trio still usable.
  const dustWindow = await page.locator('#orchestra-window option').evaluateAll(options => options.find(o => o.value.includes("18:00:00Z")).value);
  await page.locator("#orchestra-window").selectOption(dustWindow); await ready();
  await page.locator('[data-orchestra="play"]').click();
  await page.waitForFunction(() => window.__studio.audio.transport.snapshot().status === "playing");

  for (let i = 0; i < 5; i++) {
    await page.locator('[data-orchestra="pause"]').click();
    assert.equal(await page.evaluate(() => window.__studio.audio.transport.snapshot().status), "paused");
    await page.locator('[data-orchestra="play"]').click();
    await page.waitForFunction(() => window.__studio.audio.transport.snapshot().status === "playing");
  }
  await page.locator('[data-orchestra="stop"]').click();
  await page.locator("#st-date").selectOption("geos-fp-dust-20250115-1930"); await ready();
  assert.equal(await page.evaluate(() => window.__studio.orchestra.observations.dust.reason), "catalog");
  assert.equal(await page.locator('[data-orchestra="play"]').isDisabled(), true);
  await page.screenshot({ path: `${out}/catalog-conflict.png`, fullPage: true });
  const hourly = await page.locator("#orchestra-window option").evaluateAll(options => options.find(o => o.value.includes("19:00:00Z")).value);
  await page.locator("#orchestra-window").selectOption(hourly); await ready();
  assert.equal(await page.locator('.orchestra-channel[data-available="true"]').count(), 3);
  await page.locator('[data-orchestra="play"]').click();
  await page.waitForFunction(() => window.__studio.audio.transport.snapshot().status === "playing");
  await page.evaluate(() => {
    const before = window.nativeAudioAudit.total;
    const mute = document.querySelector('[data-channel="wind"] button[aria-pressed]');
    const solo = document.querySelectorAll('[data-channel="wind"] button[aria-pressed]')[1];
    const enabled = document.querySelector('[data-channel="wind"] input[type="checkbox"]');
    if (mute.disabled || solo.disabled || enabled.disabled) throw Error("Rapid channel test requires a valid wind observation");
    for (let i = 0; i < 20; i++) { mute.click(); solo.click(); enabled.click(); }
    if (window.nativeAudioAudit.total !== before) throw Error("Channel changes unexpectedly rescheduled voices");
  });

  // Delay the cached adapters to reproduce Stop during an in-flight observation refresh.
  await page.evaluate(() => {
    const a = window.__studio, original = a.pkg.openPhenomenon.bind(a.pkg), waiting = [];
    a.pkg.openPhenomenon = async (...args) => { const result = await original(...args); await new Promise(resolve => waiting.push(resolve)); return result; };
    window.releaseObservation = () => { a.pkg.openPhenomenon = original; waiting.forEach(f => f()); };
    const index = a.state.selected.index + 1; a.selectCell({ index, row: Math.floor(index / a.grid.cols), col: index % a.grid.cols }, { play: false, say: false });
  });
  await page.locator('[data-orchestra="stop"]').click();
  await page.evaluate(() => window.releaseObservation()); await ready();
  await page.waitForTimeout(400);
  assert.notEqual(await page.evaluate(() => window.__studio.audio.transport.snapshot().status), "playing", "Stop revokes asynchronous auto-resume");
  assert.equal(await page.evaluate(() => window.nativeAudioAudit.active.size), 0);
  // Rapid commands and changes must end on only the final real observation.
  await page.locator('[data-orchestra="play"]').click();
  await page.waitForFunction(() => window.__studio.audio.transport.snapshot().status === "playing");
  await page.evaluate(() => {
    const a = window.__studio;
    for (let i = 100; i < 125; i++) a.selectCell({ index: i, row: Math.floor(i / a.grid.cols), col: i % a.grid.cols }, { play: false, say: false });
  }); await ready();
  await page.waitForFunction(() => window.__studio.audio.transport.snapshot().status === "playing");
  assert.equal(await page.evaluate(() => window.__studio.orchestra.observations.wind.index), 124);
  await page.evaluate(async () => {
    const a = window.__studio;
    for (let i = 0; i < 12; i++) await a.requestDate(a.list[2 + i % 4].id);
  }); await ready();
  assert.equal(await page.evaluate(() => window.__studio.orchestra.observations.wind.snapshot.date), await page.evaluate(() => window.__studio.state.snapshot.date));
  await page.evaluate(async () => { const o = window.__studio.orchestra; for (let i = 0; i < 25; i++) { const pending = o.play(); o.stop(); await pending; } });
  await page.waitForTimeout(400);
  assert.equal(await page.evaluate(() => window.nativeAudioAudit.active.size), 0, "no running or future sources after repeated Stop");
  assert.equal(await page.evaluate(() => window.nativeAudioAudit.contexts.length), 1, "the live Studio reuses one AudioContext");

  // Exercise the existing tools with the integrated package, after yielding the mixer.
  await page.evaluate(async () => {
    const a = window.__studio; a.orchestra.setOpen(false);
    await a.switchPhenomenon("rainfall"); await a.requestDate(a.phen.byDate("2025-04-15").id);
    const index = a.state.snapshot.values.findIndex(v => v > 0.5);
    a.selectCell({ index, row: Math.floor(index / a.grid.cols), col: index % a.grid.cols }, { play: false, say: false });
  });
  await page.locator(".st-map").focus(); await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__studio.audio.transport.snapshot().status === "playing");
  await page.locator('[data-id="area"]').click();
  await page.evaluate(() => {
    const a = window.__studio, first = a.grid.cells[12], last = a.grid.cells[53];
    a.playArea({ west: first.bounds.west, east: last.bounds.east, north: first.bounds.north, south: last.bounds.south });
  });
  await page.waitForFunction(() => window.__studio.state.run?.kind === "area" && window.__studio.audio.transport.snapshot().status === "playing");
  await page.locator("#orchestra-toggle").click(); await ready();
  assert.equal(await page.evaluate(() => window.__studio.state.run), null, "Orchestra releases the previous scan controller");
  assert.equal(await page.evaluate(() => window.__studio.state.busy), false, "no stale scan busy state on return");
  await page.evaluate(() => window.__studio.orchestra.setOpen(false));
  await page.locator('[data-id="path"]').click();
  await page.evaluate(() => {
    const a = window.__studio; a.state.path = []; a.addPoint(a.grid.cells[12]); a.addPoint(a.grid.cells[254]);
    a.panels.path.querySelector("button").click();
  });
  await page.waitForFunction(() => window.__studio.state.run?.kind === "path" && window.__studio.audio.transport.snapshot().status === "playing");
  await page.evaluate(() => window.__studio.stopRun(true));
  await page.locator('[data-id="compare"]').click();
  await page.evaluate(() => window.__studio.showChangeFor("2025-04-15", "2025-07-15"));
  assert.equal(await page.evaluate(() => window.__studio.state.comparison.values.length), 1000);
  await page.evaluate(() => window.__studio.hideChange());
  await page.locator('[data-id="hunter"]').click();
  await page.locator("#hunter-date").selectOption("2025-04-15");
  await page.locator("#em-panel-hunter").getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForFunction(() => window.__studio.store.state.findings.length > 0);
  assert.equal(await page.evaluate(() => window.__studio.store.state.findings[0].value), await page.evaluate(() => Math.max(...window.__studio.phen.byDate("2025-04-15").values)));
  await page.locator('[data-id="echo"]').click();
  await page.evaluate(() => {
    const a = window.__studio, index = 12;
    a.selectCell({ index, row: Math.floor(index / a.grid.cols), col: index % a.grid.cols }, { play: false, say: false, user: true });
  });
  await page.locator("#em-panel-echo").getByRole("button", { name: "Search", exact: true }).click();
  await page.waitForFunction(() => window.__studio.store.state.echoMatches.length > 0);
  assert.equal(await page.evaluate(() => window.__studio.store.state.echoDatasetId), "rainfall");
  console.log("PASS ordinary exploration, actual Area/Path scans, real Compare, Hunter rankings and Echo results after Orchestra");
  await page.evaluate(() => window.__studio.orchestra.setOpen(true)); await ready();
  // Native page-exit lifecycle, then actual navigation to Explore.
  await page.locator('[data-orchestra="play"]').click();
  await page.evaluate(() => dispatchEvent(new PageTransitionEvent("pagehide", { persisted: false })));
  await page.waitForFunction(() => window.nativeAudioAudit.contexts.every(c => c.state === "closed"));
  await page.goto(new URL("pages/explore.html", base).href);
  await page.locator("#site-nav").waitFor();
  assert.deepEqual(errors, []); assert.deepEqual(requestsFailed, []);
  console.log("PASS 16 real-data native renders including F23/I7/F15/H21, scientific response, stereo, bounded output, dry/muted silence, stop fade, catalog rejection, rapid transitions, one live context and exit cleanup. Human listening was not performed.");
} finally { await browser.close(); }
