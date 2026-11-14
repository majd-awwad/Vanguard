import { mountDecodeGrid } from "./accessibility/decode-grid.js";
import { decodeMessage } from "./i18n/decode-messages.js";

// Mount after the session has published its initial case snapshot.
export function mountDecodeAccessibility(gridRoot, session, { language = "en" } = {}) {
  return mountDecodeGrid(gridRoot, session, {
    t: (key, params) => decodeMessage(language, key, params),
  });
}
