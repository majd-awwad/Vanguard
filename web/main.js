import { loadGediCase } from "./data/gedi-case.js";
import { createTransport } from "./audio/transport.js";
import { createSession } from "./experiences/invisible-forest/session.js";
import { mountVisual } from "./visual/plot.js";
import { mountAccessible } from "./accessibility/controls.js";
import { localizePage, messages } from "./i18n/messages.js";

let language = "en";
let controls, plot;
const text = (key) => messages(language)(key);
const errorMessage = document.querySelector("#load-error");
const begin = document.querySelector("#begin");

document.querySelector("#locale").addEventListener("click", () => {
  language = language === "en" ? "ar" : "en";
  localizePage(language);
  controls?.refresh();
  plot?.refresh();
  if (!errorMessage.hidden) errorMessage.textContent = text("error");
});
localizePage(language);

try {
  const data = await loadGediCase({
    sampleUrl: new URL("./assets/gedi/sample.json", import.meta.url),
    provenanceUrl: new URL("./assets/gedi/provenance.json", import.meta.url),
  });
  const session = createSession(data, createTransport());
  controls = mountAccessible(session, () => language, text);
  plot = mountVisual(document.querySelector("#plot"), session, text);
  document.querySelector("#experience").hidden = false;
  begin.disabled = false;
} catch (error) {
  console.error(error);
  errorMessage.textContent = text("error");
  errorMessage.hidden = false;
}
