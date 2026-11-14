import { mountDecode } from "../decode.js";
import { decodeMessage } from "../i18n/decode-messages.js";
import { mountDecodeVisual } from "../visual/decode-visual.js";
import { createGlobeMount } from "./globe.js";

// Mirrors startDecode() in web/decode.js (read-only) and swaps only the visual layer: the same session,
// transport, spatial plan and accessible grid run underneath, so the cinematic page cannot drift from them.
const copy = {
  en: {
    title: "Decode the Dust",
    tagline: "Turning NASA dust data into sound",
    unavailable: "The Decode experience needs the spatial audio module, which is not available yet.",
  },
  ar: {
    title: "اسمع خريطة الغبار",
    tagline: "نحوّل بيانات الغبار من ناسا إلى صوت",
    unavailable: "تجربة فك الشيفرة تحتاج وحدة الصوت المكاني، وهي غير متاحة بعد.",
  },
};

/** The 3D mount used by the page. Falls back to the flat SVG visual when WebGL is unavailable or lost. */
export const mountCinematicVisual = createGlobeMount({ fallback: mountDecodeVisual });

export async function startCinematic(root) {
  const document = root.ownerDocument;
  const language = new URL(document.URL).searchParams.get("lang") === "ar" ? "ar" : "en";
  const text = copy[language];
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  document.title = text.title + " · EARTHPULSE";
  root.querySelector("#decode-title").textContent = text.title;
  root.querySelector("#cinematic-tagline").textContent = text.tagline;
  root.querySelector("#decode-home").href = language === "ar" ? "./?lang=ar" : "./";
  const switchLanguage = root.querySelector("#decode-language");
  const alternate = language === "ar" ? "en" : "ar";
  switchLanguage.href = "?lang=" + alternate;
  switchLanguage.hreflang = switchLanguage.lang = alternate;
  switchLanguage.textContent = alternate === "ar" ? "العربية" : "English";
  const state = root.querySelector("#decode-state");
  const retry = root.querySelector("#decode-retry");
  const t = (key) => decodeMessage(language, key);
  retry.textContent = t("general.retry");

  async function start() {
    retry.hidden = true;
    state.textContent = t("general.loading");
    try {
      let sound;
      try {
        sound = await import("../audio/spatial-plan.js");
      } catch (error) {
        if (error instanceof TypeError) {
          state.textContent = text.unavailable;
          return;
        }
        throw error;
      }
      if (typeof sound.makeSpatialPlan !== "function" || typeof sound.heardClass !== "function") {
        throw new Error("Decode spatial plan exports do not conform to v2.");
      }
      await mountDecode(root, {
        language, makePlan: sound.makeSpatialPlan, heardClass: sound.heardClass, mountVisual: mountCinematicVisual,
      });
      switchLanguage.hidden = false;
    } catch (error) {
      console.error(error);
      state.textContent = t("general.error");
      retry.hidden = false;
    }
  }

  retry.addEventListener("click", start);
  await start();
}
