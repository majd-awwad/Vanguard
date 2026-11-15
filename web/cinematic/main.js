import { createTransport } from "../audio/transport.js";
import { mountDecode } from "../decode.js";
import { decodeMessage } from "../i18n/decode-messages.js";
import { loadDecodeCase } from "../sources/decode/index.js";
import { mountDecodeVisual } from "../visual/decode-visual.js";
import { createAudioTap } from "./audio-tap.js";
import { copy } from "./copy.js";
import { createGlobeMount } from "./globe.js";
import { createHero } from "./hero.js";
import { createScene } from "./scene.js";
import { mountNav } from "./site/nav.js";
import { markDecodeCompleted } from "./site/progress.js";
import { loadSettings } from "./site/settings.js";

// Mirrors startDecode() in web/decode.js (read-only): the same session, transport, spatial plan and accessible
// grid run underneath, with a cinematic scene, hero and dock around them. The only interactive grid is still the
// shared HTML one; the 3D layer draws what the session snapshot allows and nothing else.

export async function startCinematic(root) {
  const document = root.ownerDocument;
  // One shell for every page: the shared header, settings drawer and footer. It also applies the stored settings.
  const settings = loadSettings();
  const language = mountNav(document, document.getElementById("site-nav"), { active: "decode", from: "root", variant: "overlay", skipTo: "#decode-page" });
  const text = copy[language];
  const body = document.body;
  document.title = text.pageTitle + " · EARTHPULSE";
  body.classList.add("cine");
  body.dataset.view = "hero";
  // The hero's guide-sound mute toggle lives in the shared header tools.
  const soundButton = document.createElement("button");
  soundButton.type = "button";
  soundButton.id = "cine-sound";
  soundButton.className = "icon-btn cine-icon-button";
  soundButton.setAttribute("aria-pressed", "false");
  soundButton.setAttribute("aria-label", "Sound");
  soundButton.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false"><path d="M4 14v-2a8 8 0 0 1 16 0v2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><rect x="3" y="13" width="4" height="7" rx="1.6" fill="currentColor"/><rect x="17" y="13" width="4" height="7" rx="1.6" fill="currentColor"/></svg>';
  document.querySelector("#site-nav .site-tools").prepend(soundButton);

  // The scene is one fixed canvas behind the page, so the hero Earth shows while the case is still loading.
  let scene = null;
  try {
    scene = createScene({ document });
    scene.setDirection(language === "ar");
    body.prepend(scene.canvas);
    body.dataset.renderer = "webgl";
    body.dataset.flight = "hero";
    // The registered map fades in only once the camera has finished flying (see cinematic.css).
    scene.onFrame(({ progress, target }) => {
      const flight = progress !== target ? "flying" : target === 1 ? "done" : "hero";
      if (body.dataset.flight !== flight) body.dataset.flight = flight;
    });
    scene.onLost(() => { body.dataset.renderer = "svg"; });
  } catch (error) {
    console.warn("WebGL is unavailable; using the flat map.", error);
    body.dataset.renderer = "svg";
  }

  const tap = createAudioTap();
  const transport = createTransport({ createContext: () => tap.createContext() });
  transport.setVolume(settings.volume);
  transport.setSpeed(settings.speed);
  const hero = createHero({ root, language, scene, transport, analyser: () => tap.analyser });
  let caseInfo = null;

  const state = root.querySelector("#decode-state");
  const retry = root.querySelector("#decode-retry");
  const t = (key) => decodeMessage(language, key);
  retry.textContent = t("general.retry");

  const mountVisual = createGlobeMount({
    scene,
    fallback: mountDecodeVisual,
    captionFor: () => text.caption[caseInfo?.phenomenon === "dust" ? "dust" : "generic"],
    onLost: () => { body.dataset.renderer = "svg"; },
  });

  async function loadCase(id) {
    caseInfo = await loadDecodeCase(id);
    hero.setCase(caseInfo);
    return caseInfo;
  }

  async function start() {
    retry.hidden = true;
    state.textContent = t("general.loading");
    try {
      let sound;
      try {
        sound = await import("../audio/spatial-plan.js");
      } catch (error) {
        if (error instanceof TypeError) {
          state.textContent = decodeMessage(language, "general.error");
          return;
        }
        throw error;
      }
      if (typeof sound.makeSpatialPlan !== "function" || typeof sound.heardClass !== "function") {
        throw new Error("Decode spatial plan exports do not conform to v2.");
      }
      const mounted = await mountDecode(root, {
        language, makePlan: sound.makeSpatialPlan, heardClass: sound.heardClass, mountVisual, transport, loadCase,
      });
      hero.bind(mounted.session);
      // Remember that Decode was finished once, so Explore Earth and Sound Lab may show the answers.
      mounted.session.subscribe((snapshot) => { if (snapshot.phase === "reveal" && snapshot.mode === "discovery") markDecodeCompleted(); });
      // Test and inspection hook, off unless the URL asks for it.
      if (new URL(document.URL).searchParams.has("cine-debug")) window.__cineDebug = { session: mounted.session, transport, scene };
      state.textContent = "";
    } catch (error) {
      console.error(error);
      state.textContent = t("general.error");
      retry.hidden = false;
    }
  }

  retry.addEventListener("click", start);
  await start();
}
