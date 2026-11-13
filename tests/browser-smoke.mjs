import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";

const browserModule = process.env.EARTHPULSE_PLAYWRIGHT;
const { chromium } = browserModule
  ? await import(pathToFileURL(browserModule).href)
  : await import("playwright");
const browser = await chromium.launch({
  executablePath: process.env.EARTHPULSE_BROWSER,
  headless: true,
});
const url = process.env.EARTHPULSE_URL ?? "http://127.0.0.1:4173/";

async function press(page, selector) {
  await page.locator(selector).focus();
  await page.keyboard.press("Enter");
}

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1024 }, reducedMotion: "reduce" });
  const problems = [];
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("response", (response) => { if (!response.ok()) problems.push(`${response.status()} ${response.url()}`); });
  await page.addInitScript(() => {
    const native = AudioScheduledSourceNode.prototype.start;
    window.startedTones = 0;
    AudioScheduledSourceNode.prototype.start = function (...args) {
      window.startedTones++;
      return native.apply(this, args);
    };
  });
  await page.goto(url);
  await page.locator("#experience").waitFor();
  assert.equal(await page.locator("#current-value").textContent(), "0.15%");
  await page.keyboard.press("Tab");
  assert.equal(await page.locator(":focus").textContent(), "Skip to exploration");
  await page.keyboard.press("Enter");
  assert.equal(await page.locator(":focus").getAttribute("id"), "lens");
  await press(page, "#begin");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Playing");
  assert.equal(await page.locator(":focus").getAttribute("id"), "lens");
  await page.waitForFunction(() => window.startedTones === 6);
  await page.waitForFunction(() => {
    const event = document.querySelector("#plot").dataset.event;
    return event.startsWith("19640519500108400") && event === document.querySelector("#current-value").dataset.event;
  });
  await press(page, "#pause");
  assert.equal(await page.locator("#playback-status").textContent(), "Paused");

  await press(page, "#compare-high");
  assert.equal(await page.locator("#current-value").textContent(), "17.32%");
  assert.equal(await page.locator("#plot").getAttribute("data-event"),
    await page.locator("#current-value").getAttribute("data-event"));
  await press(page, "#reveal");
  assert.match(await page.locator(":focus").textContent(), /8.41 percentage points/);
  await press(page, "#open");
  assert.equal(await page.locator(":focus").getAttribute("id"), "horizontal");

  await press(page, "#vertical");
  assert.equal(await page.locator("#vertical").getAttribute("aria-pressed"), "true");
  assert.equal(await page.locator("#footprint").inputValue(), "19640520300108404");
  await page.locator("#height-step").focus();
  await page.keyboard.press("ArrowDown");
  assert.equal(await page.locator("#height-step").inputValue(), "1");
  await press(page, "#next");
  assert.equal(await page.locator("#height-step").inputValue(), "2");
  await press(page, "#inspect");
  assert.equal(await page.locator(":focus").getAttribute("id"), "evidence-content");
  assert.equal(await page.locator("#evidence-content").getAttribute("data-shot"), "19640520300108404");
  const tree = await page.locator("#observation").ariaSnapshot();
  assert.match(tree, /19640520300108404/);
  assert.match(tree, /GEDI01_B_2019108080338_O01964_T05337_02_003_01.h5/);
  assert.match(tree, /GEDI02_A_2019108080338_O01964_T05337_02_001_01.h5/);
  assert.match(tree, /Provenance manifest and checksums/);

  await press(page, "#studio summary");
  await page.locator("#mute").focus();
  await page.keyboard.press("Space");
  assert.equal(await page.locator("#mute").isChecked(), true);
  await page.locator("#speed").selectOption("2");
  await press(page, "#silent");
  assert.equal(await page.locator("#playback-status").textContent(), "Visual playback");
  const priorTones = await page.evaluate(() => window.startedTones);
  await press(page, "#replay");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Scan complete");
  assert.equal(await page.evaluate(() => window.startedTones), priorTones);
  await press(page, "#play");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Visual playback");
  assert.equal(await page.evaluate(() => window.startedTones), priorTones);
  await press(page, "#sound");
  await page.waitForFunction(() => document.querySelector("#playback-status").textContent === "Playing");
  assert.ok(await page.evaluate(() => window.startedTones > priorTones));
  await press(page, "#pause");
  await press(page, "#locale");
  assert.equal(await page.locator("html").getAttribute("lang"), "ar");
  assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
  assert.match(await page.locator("#position-text").textContent(), /البصمة/);
  await press(page, "#horizontal");
  await page.locator("#band-min").selectOption("6");
  assert.match(await page.locator("#plot").getAttribute("data-event"), /:6:10$/);
  assert.equal(await page.locator("#plot").getAttribute("data-event"),
    await page.locator("#current-value").getAttribute("data-event"));
  await page.locator("#science img").scrollIntoViewIfNeeded();
  await page.waitForFunction(() => document.querySelector("#science img").naturalWidth === 1024);

  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `Overflow at ${width}px`);
  }
  assert.deepEqual(problems, []);
  console.log("Browser smoke passed: keyboard route, Web Audio scheduling, guided evidence, silent replay, Arabic RTL, 320/390px.");

  const errorPage = await browser.newPage();
  await errorPage.route("**/assets/gedi/sample.json", (route) => route.fulfill({ status: 500 }));
  await errorPage.goto(url);
  await errorPage.locator("#load-error").waitFor();
  assert.equal(await errorPage.locator("#begin").isDisabled(), true);
  assert.equal(await errorPage.locator("#experience").isVisible(), false);
  console.log("Browser failure case passed: inaccessible input does not enable exploration.");
} finally {
  await browser.close();
}
