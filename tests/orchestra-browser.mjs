import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { mkdir } from "node:fs/promises";

const { chromium } = await import(process.env.EARTHPULSE_PLAYWRIGHT ? pathToFileURL(process.env.EARTHPULSE_PLAYWRIGHT).href : "playwright");
const browser = await chromium.launch({ executablePath: process.env.EARTHPULSE_BROWSER, headless: true });
const base = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";
const out = process.env.EARTHPULSE_SCREENSHOTS ?? "tmp/orchestra-screenshots";
await mkdir(out, { recursive: true });
const issues = [];
try {
  for (const language of ["en", "ar"]) for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport, reducedMotion: "reduce" });
    page.on("pageerror", e => issues.push(e.message));
    await page.addInitScript(() => {
      window.audioAudit = { oscillators: [], contexts: 0, buffers: 0, speech: [] };
      const Context = window.AudioContext;
      window.AudioContext = class extends Context { constructor(...a) { super(...a); window.audioAudit.contexts++; } };
      const start = OscillatorNode.prototype.start;
      OscillatorNode.prototype.start = function (at) { window.audioAudit.oscillators.push({ at, hz: this.frequency.value, type: this.type }); return start.call(this, at); };
      const bufferStart = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...a) { window.audioAudit.buffers++; return bufferStart.apply(this, a); };
      speechSynthesis.speak = u => { window.audioAudit.speech.push(u.text); u.onstart?.(); setTimeout(() => u.onend?.(), 100); };
      speechSynthesis.getVoices = () => [{ lang: "en-US" }, { lang: "ar" }];
    });
    await page.goto(`${base}pages/studio.html?entry=skip&mode=pure&debug&lang=${language}`);
    await page.locator("#orchestra-toggle").waitFor();
    const studio = f => page.evaluate(f);
    assert.equal(await studio(() => window.audioAudit.contexts), 0, "no autoplay or AudioContext before gesture");
    await page.locator("#orchestra-toggle").click();
    const ready = () => page.waitForFunction(() => document.querySelector("#orchestra-workspace").getAttribute("aria-busy") === "false");
    await ready();
    assert.equal(await page.locator('.orchestra-channel[data-available="true"]').count(), 3, "first opening selects the largest validated group even on a Dust map");
    const hourlyKey = await page.locator('#orchestra-window option').evaluateAll(options => options.find(o => o.value.includes("19:00:00Z")).value);
    await page.locator("#orchestra-window").selectOption(hourlyKey); await ready();
    assert.equal(await page.locator('.orchestra-channel[data-available="true"]').count(), 3);
    assert.equal(await page.locator('[data-channel="dust"] input[type="checkbox"]').isDisabled(), true);
    const readCounts = async () => page.locator("#orchestra-workspace").evaluate(node => [Number(node.dataset.compatible), Number(node.dataset.enabled), Number(node.dataset.audible)]);
    const select = async (date, index) => {
      await page.evaluate(async ({ date, index }) => {
        const a = window.__studio; await a.requestDate(a.phen.byDate(date).id);
        a.selectCell({ index, row: Math.floor(index / a.grid.cols), col: index % a.grid.cols }, { play: false, say: false });
      }, { date, index }); await ready();
    };
    for (const [date, index, sample] of [["2025-02-15", 222, "F23"], ["2025-11-15", 326, "I7"], ["2025-04-15", 214, "F15"]]) {
      await select(date, index);
      assert.deepEqual(await readCounts(), [3, 3, 0], `${sample}: compatible and enabled differ from currently audible`);
      const before = await studio(() => window.audioAudit.oscillators.length);
      await page.locator('[data-orchestra="play"]').click();
      await page.waitForFunction(() => document.querySelector("#orchestra-workspace").dataset.audible === "3");
      assert.deepEqual(await readCounts(), [3, 3, 3], sample);
      const scheduled = await studio(() => window.audioAudit.oscillators);
      const newVoices = scheduled.slice(before);
      assert.equal(new Set(newVoices.map(o => o.hz)).size, 3, `${sample}: three actual native source frequencies`);
      assert.equal(newVoices.filter(o => o.at === newVoices[0].at).length, 3, `${sample}: synchronized source onset`);
      await page.waitForFunction(() => { const a = window.__studio.audio.tap.analyser, samples = new Float32Array(a.fftSize); a.getFloatTimeDomainData(samples); return Math.max(...samples.map(Math.abs)) > 0.001; }, undefined, { timeout: 5000 });
      if (sample === "F23") await page.screenshot({ path: `${out}/orchestra-playing-${language}-${viewport.width}.png`, fullPage: true });
      await page.locator('[data-orchestra="stop"]').click();
      assert.deepEqual(await readCounts(), [3, 3, 0]);
    }
    await select("2025-11-15", 300);
    assert.equal(await page.locator('[data-channel="rainfall"]').getAttribute("data-silent"), "true");
    assert.ok((await page.locator('[data-channel="rainfall"] .orchestra-availability').textContent()).includes("0.002"));
    await page.locator('[data-orchestra="play"]').click();
    await page.waitForFunction(() => document.querySelector("#orchestra-workspace").dataset.audible === "2");
    assert.deepEqual(await readCounts(), [3, 3, 2], "H21 dry rainfall remains scientifically silent");
    await page.locator('[data-orchestra="stop"]').click();
    await select("2025-11-15", 326);
    const selectedHour = await page.locator('#orchestra-window option').evaluateAll(options => options.find(o => o.value.includes("19:00:00Z")).value);
    await page.locator("#orchestra-window").selectOption(selectedHour); await ready();
    await page.locator('[data-orchestra="play"]').click();
    for (const id of ["dust", "rainfall", "temperature", "wind"]) {
      await page.locator(`[data-phen="${id}"]`).click(); await ready();
      await page.waitForFunction(() => document.querySelector("#orchestra-workspace").dataset.audible === "3");
      assert.equal(await studio(() => window.__studio.orchestra.window), selectedHour, "explicit hourly preference survives map changes");
    }
    await page.locator('[data-orchestra="stop"]').click();
    const selectedDust = await page.locator('#orchestra-window option').evaluateAll(options => options.find(o => o.value.includes("18:00:00Z")).value);
    await page.locator("#orchestra-window").selectOption(selectedDust); await ready();
    for (const id of ["rainfall", "temperature", "wind", "dust"]) {
      await page.locator(`[data-phen="${id}"]`).click(); await ready();
      assert.equal(await studio(() => window.__studio.orchestra.window), selectedDust, "explicit smaller dust group is never overridden");
      assert.deepEqual(await readCounts(), [1, 1, 0]);
    }
    await select("2025-01-15", 300);
    assert.equal(await page.locator(".orchestra-window-notice").isVisible(), true);
    assert.equal(await page.locator('[data-orchestra="play"]').isDisabled(), true);
    assert.ok((await studio(() => window.__studio.orchestra.window)).includes("18:00:00Z"), "unavailable explicit choice remains selected");
    await page.locator('[data-orchestra="alternative"]').click(); await ready();
    assert.deepEqual(await readCounts(), [3, 3, 0], "valid alternative requires an explicit user action");
    assert.equal(await page.locator(".orchestra-window-notice").isVisible(), false);
    if (viewport.width < 900) {
      for (const id of ["temperature", "wind", "rainfall"]) {
        await page.locator(`[data-jump="${id}"]`).click();
        const reached = await page.locator(`[data-channel="${id}"]`).evaluate(node => { const r = node.querySelector(".orchestra-channel-controls").getBoundingClientRect(), s = document.querySelector(".orchestra-scroll").getBoundingClientRect(); return r.top >= s.top && r.bottom <= s.bottom; });
        assert.equal(reached, true, `${id}: mobile jump reveals channel controls`);
        assert.equal(await page.locator("#orchestra-window").isVisible(), true, "active window remains visible while channels scroll");
      }
    }
    await select("2025-04-15", 520);
    // Choose a wet real cell so all three compatible channels are audible.
    await studio(async () => {
      const a = window.__studio, p = await a.pkg.openPhenomenon("rainfall");
      const index = p.byDate(a.state.snapshot.date).values.findIndex(v => v > 0.5);
      a.selectCell({ index, row: Math.floor(index / a.grid.cols), col: index % a.grid.cols }, { play: false, say: false });
    }); await ready();
    await page.locator('[data-orchestra="play"]').click();
    await page.waitForFunction(() => window.__studio.audio.transport.snapshot().status === "playing");
    await page.waitForTimeout(100);
    assert.equal(await studio(() => window.audioAudit.contexts), 1);
    assert.equal(await studio(() => window.audioAudit.buffers), 0, "no background recording replaces sonification");
    const starts = await studio(() => window.audioAudit.oscillators);
    assert.ok(starts.some(o => o.hz === 520), "rainfall pulses");
    assert.ok(starts.some(o => o.hz === 180), "wind pulses");
    assert.ok(starts.some(o => o.hz >= 220 && o.hz <= 880 && o.hz !== 520), "temperature pitch");
    assert.equal(starts.filter(o => o.at === starts[0].at).length, 3, "one clock and simultaneous starts");
    await page.waitForFunction(() => { const a = window.__studio.audio.tap.analyser; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); return Math.max(...b.map(Math.abs)) > 0.001; }, undefined, { timeout: 5000 });
    const signal = await studio(() => { const a = window.__studio.audio.tap.analyser; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); return Math.max(...b.map(Math.abs)); });
    assert.ok(signal > 0.001 && signal < 0.2, `real, bounded mixed output: ${signal}`);
    const counts = starts.length;
    await page.locator('[data-channel="temperature"] button[aria-pressed]').first().click();
    assert.equal(await studio(() => window.__studio.orchestra.settings.temperature.muted), true);
    assert.deepEqual(await readCounts(), [3, 3, 2]);
    await page.locator('[data-channel="wind"] button[aria-pressed]').nth(1).click();
    assert.equal(await studio(() => window.__studio.orchestra.settings.wind.solo), true);
    assert.deepEqual(await readCounts(), [3, 3, 1]);
    await page.locator('[data-channel="wind"] input[type="range"]').fill("34");
    assert.equal(await studio(() => window.__studio.orchestra.settings.wind.gain), 0.34);
    assert.equal(await studio(() => window.audioAudit.oscillators.length), counts, "mixer controls do not reschedule audio");
    await page.locator('[data-channel="wind"] input[type="checkbox"]').uncheck();
    assert.equal(await studio(() => window.__studio.orchestra.settings.wind.enabled), false);
    await page.locator('[data-channel="wind"] input[type="checkbox"]').check();
    await page.locator('[data-channel="wind"] button[aria-pressed]').first().click();
    await page.waitForTimeout(400);
    const mutedPeak = await studio(() => { const a = window.__studio.audio.tap.analyser; const b = new Float32Array(a.fftSize); a.getFloatTimeDomainData(b); return Math.max(...b.map(Math.abs)); });
    assert.ok(mutedPeak < 0.001, "mute overrides solo and actually silences the bus");
    assert.deepEqual(await readCounts(), [3, 3, 0]);
    await page.locator('[data-channel="wind"] button[aria-pressed]').first().click();
    await studio(() => { const v = document.querySelector("#st-volume"); v.value = "0"; v.dispatchEvent(new Event("input", { bubbles: true })); });
    assert.deepEqual(await readCounts(), [3, 3, 0], "master silence is not reported as audible");
    await studio(() => { const v = document.querySelector("#st-volume"); v.value = "72"; v.dispatchEvent(new Event("input", { bubbles: true })); });
    assert.deepEqual(await readCounts(), [3, 3, 1]);
    await page.locator('[data-orchestra="pause"]').click();
    const position = await studio(() => window.__studio.audio.transport.snapshot().positionS);
    await page.waitForTimeout(100);
    assert.equal(await studio(() => window.__studio.audio.transport.snapshot().positionS), position);
    await page.locator('[data-orchestra="play"]').click();
    assert.ok(await studio(() => window.__studio.audio.transport.snapshot().positionS) >= position);
    await page.locator('[data-orchestra="replay"]').click();
    assert.ok(await studio(() => window.__studio.audio.transport.snapshot().positionS) < 0.5);
    // Change cell and date while playing: evidence updates, old sources stop.
    await studio(() => { const a = window.__studio; const index = a.state.selected.index + 1; a.selectCell({ index, row: Math.floor(index / a.grid.cols), col: index % a.grid.cols }, { play: false, say: false }); });
    await ready();
    assert.equal(await studio(() => window.__studio.orchestra.observations.wind.index), await studio(() => window.__studio.state.selected.index));
    const beforeDate = await studio(() => window.__studio.state.snapshot.date);
    await page.locator("#st-date").selectOption({ index: 1 }); await ready();
    assert.notEqual(await studio(() => window.__studio.state.snapshot.date), beforeDate);
    assert.equal(await studio(() => window.__studio.orchestra.observations.wind.snapshot.date), await studio(() => window.__studio.state.snapshot.date));
    assert.equal(await page.locator('.orchestra-channel[data-available="true"]').count(), 3, "hourly window persists across dates");
    assert.equal(await studio(() => window.__studio.orchestra.settings.wind.gain), 0.34);
    assert.equal(await studio(() => window.audioAudit.speech.length), 0, "Pure mode has no automatic speech");
    const selected = await studio(() => window.__studio.state.selected.index);
    await page.locator('.st-sound .seg button').first().click();
    assert.equal(await studio(() => window.__studio.store.state.soundMode), "GUIDED_VOICE");
    assert.equal(await studio(() => window.__studio.state.selected.index), selected);
    assert.equal(await studio(() => window.__studio.orchestra.settings.wind.solo), true);
    await page.locator('[data-channel="wind"] summary').click();
    await page.locator('[data-channel="wind"] details button').click();
    await page.waitForTimeout(150);
    assert.ok(await studio(() => window.audioAudit.speech.length) >= 1);
    await page.locator('.st-sound .seg button').nth(1).click();
    assert.equal(await studio(() => window.__studio.speech.ducked), false);
    await page.locator('[data-orchestra="stop"]').click();
    await page.waitForTimeout(400);
    assert.equal(await studio(() => window.__studio.audio.transport.snapshot().positionS), 0);
    const peak = await studio(() => { const analyser = window.__studio.audio.tap.analyser; const samples = new Float32Array(analyser.fftSize); analyser.getFloatTimeDomainData(samples); return Math.max(...samples.map(Math.abs)); });
    assert.ok(peak < 0.001, `Stop leaves silence: ${peak}`);
    assert.equal(await studio(() => document.documentElement.scrollWidth <= innerWidth), true, "no horizontal overflow");
    assert.equal(await page.locator("html").getAttribute("dir"), language === "ar" ? "rtl" : "ltr");
    const layout = await studio(() => { const r = s => { const b = document.querySelector(s).getBoundingClientRect(); return { top: b.top, bottom: b.bottom, height: b.height }; }; return { map: r(".st-stage"), workspace: r("#orchestra-workspace") }; });
    assert.ok(layout.map.height >= 380, "map keeps a usable region");
    assert.ok(layout.workspace.top >= layout.map.bottom - 1, "workspace does not cover the map");
    await page.screenshot({ path: `${out}/orchestra-${language}-${viewport.width}.png`, fullPage: true });
    await page.locator('[data-channel="dust"] summary').focus();
    const reached = await studio(() => { const r = document.querySelector('[data-channel="dust"] summary').getBoundingClientRect(), s = document.querySelector('.orchestra-scroll').getBoundingClientRect(); return { top: r.top, bottom: r.bottom, viewportTop: s.top, viewportBottom: s.bottom }; });
    assert.ok(reached.top >= reached.viewportTop - 1 && reached.bottom <= reached.viewportBottom + 1, `keyboard reaches all channel content: ${JSON.stringify(reached)}`);
    // Escape returns focus; the existing tools still open after Orchestra.
    await page.locator('[data-channel="wind"] summary').focus(); await page.keyboard.press("Escape");
    assert.equal(await page.locator("#orchestra-toggle").getAttribute("aria-expanded"), "false");
    assert.equal(await page.locator(":focus").getAttribute("id"), "orchestra-toggle");
    for (const id of ["area", "path", "compare", "hunter", "echo", "explore"]) {
      await page.locator(`[data-id="${id}"]`).click();
      assert.equal(await page.locator(`[data-id="${id}"]`).getAttribute("aria-pressed"), "true");
    }
    console.log(`PASS Orchestra real audio, controls, transitions, modes, layout and tool regression: ${language} ${viewport.width}×${viewport.height}`);
    await page.close();
  }
  // A dataset failure leaves the remaining scientifically compatible pair usable.
  const partial = await browser.newPage();
  await partial.route("**/earthpulse-json/wind/**", route => route.fulfill({ status: 503, body: "unavailable" }));
  await partial.goto(`${base}pages/studio.html?entry=skip&mode=pure&debug`);
  await partial.locator("#orchestra-toggle").click();
  await partial.waitForFunction(() => document.querySelector("#orchestra-workspace").getAttribute("aria-busy") === "false");
  const key = await partial.locator('#orchestra-window option').evaluateAll(options => options.find(o => o.value.includes("19:00:00Z")).value);
  await partial.locator("#orchestra-window").selectOption(key);
  await partial.waitForFunction(() => document.querySelector("#orchestra-workspace").getAttribute("aria-busy") === "false");
  assert.equal(await partial.locator('.orchestra-channel[data-available="true"]').count(), 2);
  assert.equal(await partial.evaluate(() => window.__studio.orchestra.observations.wind.reason), "load");
  await partial.close();

  const unavailable = await browser.newPage();
  await unavailable.addInitScript(() => { Object.defineProperty(crypto, "subtle", { value: undefined }); });
  await unavailable.goto(`${base}pages/studio.html?entry=skip&mode=pure&debug`);
  await unavailable.locator("#orchestra-toggle").click();
  await unavailable.waitForFunction(() => document.querySelector("#orchestra-workspace").getAttribute("aria-busy") === "false");
  assert.equal(await unavailable.locator('.orchestra-channel[data-available="true"]').count(), 0);
  assert.equal(await unavailable.locator('[data-orchestra="play"]').isDisabled(), true);
  await unavailable.close();

  const noAudio = await browser.newPage();
  await noAudio.addInitScript(() => { window.AudioContext = class { constructor() { throw Error("Audio unavailable in this test"); } }; });
  await noAudio.goto(`${base}pages/studio.html?entry=skip&mode=pure&debug`);
  await noAudio.locator("#orchestra-toggle").click();
  await noAudio.waitForFunction(() => document.querySelector("#orchestra-workspace").getAttribute("aria-busy") === "false");
  await noAudio.locator('[data-orchestra="play"]').click();
  await noAudio.waitForFunction(() => window.__studio.audio.unavailable);
  assert.match(await noAudio.locator(".orchestra-status").textContent(), /Audio unavailable/);
  await noAudio.close();
  console.log("PASS Orchestra partial dataset, unavailable integrity and audio refusal recovery");

  const smoke = await browser.newPage(); smoke.on("pageerror", e => issues.push(e.message));
  for (const path of ["index.html", "pages/explore.html", "pages/science.html", "pages/about.html"]) {
    const response = await smoke.goto(new URL(path, base).href);
    assert.equal(response.status(), 200); await smoke.locator("#site-nav").waitFor();
    assert.equal(await smoke.locator("main").count(), 1);
  }
  await smoke.close();
  console.log("PASS Home, Explore, Science and About navigation smoke");
  assert.deepEqual(issues, []);
} finally { await browser.close(); }
