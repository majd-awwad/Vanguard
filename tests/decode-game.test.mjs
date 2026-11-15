import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { describeRule, gameCopy } from "../web/cinematic/site/decode-game-copy.js";
import { NAV_ITEMS } from "../web/cinematic/site/nav.js";
import { CERT_SIZE, downloadCanvas, drawCertificate } from "../web/experiences/levels/award.js";
import { LEVELS } from "../web/experiences/levels/levels.js";
import { AVATARS } from "../web/experiences/levels/profiles.js";
import { COMPLETED_KEY } from "../web/cinematic/site/progress.js";

const read = (p) => readFile(new URL("../" + p, import.meta.url), "utf8");

const shape = (value) => (value && typeof value === "object" ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)])) : typeof value);
const tokens = (text) => (String(text).match(/\{\w+\}/g) ?? []).sort().join(",");
function sameTokens(a, b, path = "") {
  if (typeof a === "string") { assert.equal(tokens(a), tokens(b), `tokens differ at ${path}`); return; }
  if (a && typeof a === "object") for (const key of Object.keys(a)) sameTokens(a[key], b[key], path + "." + key);
}

test("the Decode copy has the same structure and the same tokens in English and Arabic", () => {
  assert.deepEqual(shape(gameCopy.en), shape(gameCopy.ar));
  sameTokens(gameCopy.en, gameCopy.ar);
  for (const language of ["en", "ar"]) {
    const c = gameCopy[language];
    for (const level of LEVELS) assert.ok(c.levels.info[level.id].name && c.levels.info[level.id].about, `level ${level.id} text`);
    for (const a of AVATARS) assert.ok(c.avatars[a], "avatar name " + a);
    assert.ok(c.profiles.local && c.profiles.confirm, "profiles are local and deletion is confirmed");
    assert.ok(c.award.disclaimer && c.award.team && c.award.certificate);
  }
  assert.ok(gameCopy.en.profiles.local.includes("Saved only in this browser"));
  assert.ok(gameCopy.en.award.disclaimer.includes("Not an official NASA certificate"));
  assert.ok(gameCopy.en.award.team.includes("Team Vanguard"));
});

test("Decode never mentions humidity or temperature, and never claims causation", () => {
  const text = JSON.stringify(gameCopy);
  assert.ok(!/humidity|temperature|رطوبة|حرارة/i.test(text));
  assert.ok(gameCopy.en.levels.info[4].about.includes("not the same as caused by"));
  assert.ok(gameCopy.en.play.feedback.both.includes("not a proof"));
});

test("mark rules are described from the objective, in both languages", () => {
  const phen = (id) => gameCopy.en.phen[id];
  const l4 = LEVELS[3].objectives.find((o) => o.id === "l4-both");
  assert.equal(describeRule("en", l4, phen), "BOTH high dust and measurable rain (at least 0.1 mm/h)");
  const l5 = LEVELS[4].objectives.find((o) => o.id === "l5-dust-up");
  assert.equal(describeRule("en", { where: l5.where, change: true }, phen), "dust that went up");
  const l5three = LEVELS[4].objectives.find((o) => o.id === "l5-three");
  assert.ok(describeRule("en", l5three, phen).startsWith("ALL of: "));
  assert.ok(describeRule("ar", l4, (id) => gameCopy.ar.phen[id]).includes("غبار مرتفع"));
  for (const level of LEVELS) for (const o of level.objectives.filter((x) => x.type === "mark-set")) for (const language of ["en", "ar"]) assert.ok(describeRule(language, o, (id) => gameCopy[language].phen[id]), `${o.id} ${language}`);
});

test("the Decode page is wired: page, stylesheet, nav link, no spoiler of the answers in the UI", async () => {
  assert.equal(NAV_ITEMS.find((item) => item.id === "decode").path, "pages/decode.html");
  const page = await read("web/pages/decode.html");
  assert.ok(page.includes('id="decode-root"') && page.includes("startDecodeGame") && page.includes("decode-game.css"));
  const ui = await read("web/cinematic/site/decode-game.js");
  assert.ok(ui.includes("exposeTruth: app.debug"), "the truth is exposed only with ?debug=1");
  assert.ok(!/_truth|_pair|_direction/.test(ui.replace(/exposeTruth/g, "")), "the interface never reads the truth");
  assert.ok(ui.includes("markDecodeCompleted()") && ui.includes("result.levelId === 1"), "level 1 completes the Decode flag that unlocks Explore");
  assert.equal(COMPLETED_KEY, "earthpulse.decode.completed.v1");
  assert.ok(ui.includes("playLevel(app, nextLevel.id)"), "Next Level loads the next level");
  assert.ok(ui.includes("store.completeLevel(") && ui.includes("store.saveCurrent("), "progress is saved");
  assert.ok(ui.includes("confirmYes") && ui.includes("alertdialog"), "deleting a profile asks first");
  assert.ok(ui.includes("showAward(app)") && ui.includes("downloadCanvas"), "the final award and the PNG download");
  assert.ok(ui.includes('"M"') || ui.includes("'M'"), "keyboard marking");
});

test("the certificate is drawn locally: Team Vanguard, the score, the disclaimer, five levels, and a PNG download", () => {
  const calls = [];
  const ctx = new Proxy({}, {
    get: (_, key) => {
      if (key === "createLinearGradient") return () => ({ addColorStop() {} });
      if (key === "measureText") return (t) => ({ width: t.length * 20 });
      return (...args) => { calls.push([String(key), ...args]); };
    },
    set: (_, key, value) => { calls.push(["set:" + String(key), value]); return true; },
  });
  const c = gameCopy.en;
  drawCertificate(ctx, {
    name: "Layla", score: 450, language: "en", dateText: "Completed today", levels: LEVELS.map((l) => ({ n: l.id, name: "x", score: 90 })),
    text: { certificate: c.award.certificate, team: c.award.team, congrats: "Congratulations, Layla!", line: "line", scoreLine: "Final score 450 out of 500", disclaimer: c.award.disclaimer, date: "Completed today" },
  });
  const texts = calls.filter((x) => x[0] === "fillText").map((x) => x[1]);
  assert.ok(texts.some((t) => t.includes("EarthPulse Earth Master") && t.includes("Team Vanguard")));
  assert.ok(texts.includes("Congratulations, Layla!") && texts.includes("Layla") && texts.includes("Final score 450 out of 500"));
  assert.ok(texts.includes("Not an official NASA certificate"));
  assert.equal(texts.filter((t) => /^\d · \d+\/100$/.test(t)).length, 5);
  assert.deepEqual([CERT_SIZE.width, CERT_SIZE.height], [1600, 1131]);
  // the Arabic certificate is right to left
  const arCalls = [];
  const arCtx = new Proxy({}, { get: (_, k) => (k === "createLinearGradient" ? () => ({ addColorStop() {} }) : k === "measureText" ? () => ({ width: 10 }) : () => {}), set: (_, k, v) => { arCalls.push([k, v]); return true; } });
  drawCertificate(arCtx, { name: "ليلى", score: 500, language: "ar", dateText: "", levels: [], text: { certificate: "x", team: "y", congrats: "z", line: "l", scoreLine: "s", disclaimer: "d", date: "" } });
  assert.ok(arCalls.some(([k, v]) => k === "direction" && v === "rtl"));
  // download goes through a PNG blob and a temporary link
  const clicks = [];
  const document = { createElement: () => ({ click() { clicks.push(this.download); }, remove() {} }), body: { append() {} } };
  const canvas = { toBlob: (done) => done(new Uint8Array([1])), toDataURL: () => "data:image/png;base64,AA==" };
  assert.equal(downloadCanvas(canvas, "earthpulse-earth-master-layla", { document, url: { createObjectURL: () => "blob:x", revokeObjectURL() {} } }), true);
  assert.deepEqual(clicks, ["earthpulse-earth-master-layla.png"]);
});
