import { h } from "./dom.js";
import { mapCopy } from "../../studio/earthmap-copy.js";
import { PHENOMENON_IDS, openPackage } from "../../studio/datasets.js";
import { createStudioAudio } from "../../studio/audio.js";
import { cellCenter } from "../../studio/field.js";
import { hoverPlan } from "../../studio/sonify.js";
import { loadSettings } from "./settings.js";

const words = {
  en: { title: "How it sounds", lede: "Every Studio sound follows one rule per phenomenon. Press a button to hear the real engine play the lowest and the highest value found on the sampled date {date}. Nothing here is a recording.", low: "Hear low", high: "Hear high", loading: "Loading the data…", playing: "Playing {name}, {which} value.", error: "Could not load this example.", lowName: "lowest", highName: "highest", rows: "Rule" },
  ar: { title: "كيف يبدو الصوت", lede: "كل صوت في الاستوديو يتبع قاعدة واحدة لكل ظاهرة. اضغط زرًا لتسمع المحرك الحقيقي يعزف أدنى قيمة وأعلى قيمة في التاريخ المأخوذ {date}. لا شيء هنا تسجيل.", low: "اسمع الأدنى", high: "اسمع الأعلى", loading: "جارٍ تحميل البيانات…", playing: "يُعزف {name}، القيمة {which}.", error: "تعذّر تحميل هذا المثال.", lowName: "الدنيا", highName: "العليا", rows: "القاعدة" },
};
const DATE = "2025-04-15";

export function howItSounds(document, language) {
  const w = words[language];
  const m = mapCopy[language];
  const status = h(document, "p", { class: "small", role: "status", "aria-live": "polite" });
  let audio = null;
  let pkg = null;
  const cache = new Map();
  async function play(id, which, button) {
    button.setAttribute("aria-busy", "true");
    status.textContent = w.loading;
    try {
      pkg ??= await openPackage();
      if (!cache.has(id)) cache.set(id, await pkg.openPhenomenon(id));
      const phen = cache.get(id);
      const snap = phen.byDate(DATE) ?? phen.list[0];
      let best = -1;
      snap.values.forEach((v, i) => { if (v === null || Number.isNaN(v)) return; if (best < 0 || (which === "low" ? v < snap.values[best] : v > snap.values[best])) best = i; });
      const grid = phen.grid;
      const cell = { row: Math.floor(best / grid.cols), col: best % grid.cols, index: best };
      audio ??= createStudioAudio({ volume: loadSettings().volume });
      await audio.enable();
      audio.play(hoverPlan(id, snap, cell, grid, cellCenter(grid, cell.row, cell.col).lon));
      status.textContent = w.playing.replace("{name}", m.phen[id]).replace("{which}", which === "low" ? w.lowName : w.highName);
    } catch (error) {
      console.error(error);
      status.textContent = w.error;
    } finally {
      button.removeAttribute("aria-busy");
    }
  }
  const rows = PHENOMENON_IDS.map((id) => {
    const low = h(document, "button", { type: "button", class: "button ghost small-button", text: w.low, "aria-label": w.low + " · " + m.phen[id] });
    const high = h(document, "button", { type: "button", class: "button small-button", text: w.high, "aria-label": w.high + " · " + m.phen[id] });
    low.addEventListener("click", () => play(id, "low", low));
    high.addEventListener("click", () => play(id, "high", high));
    return h(document, "div", { class: "sound-row" }, h(document, "h3", { text: m.phen[id] }), h(document, "p", { text: m.phen.soundMeaning[id] }), h(document, "div", { class: "sound-row-actions" }, low, high));
  });
  return h(document, "section", { class: "panel sound-how", id: "sound", "aria-labelledby": "sound-how-title" },
    h(document, "h2", { id: "sound-how-title", text: w.title }), h(document, "p", { text: w.lede.replace("{date}", DATE) }), ...rows, status);
}
