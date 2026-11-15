// "Has this person finished Decode once?" A stored flag that gates pages which reveal Decode's answers (Explore Earth,
// the numeric parts of Sound Lab). The flag is set by web/cinematic/main.js when a Decode session reaches its
// reveal phase. "Show anyway" unlocks for the current browser tab only (sessionStorage) and is never remembered.
// Every storage access is wrapped in try/catch.

export const COMPLETED_KEY = "earthpulse.decode.completed.v1";
export const OVERRIDE_KEY = "earthpulse.spoilers.override.v1";
/** Set when a profile has completed all five Decode levels: only then do the dust dates of the original challenge (2025-08-15 and 2025-08-19) open in Explore Earth. */
export const FINISHED_KEY = "earthpulse.decode.finished.v1";

const local = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
const session = () => { try { return globalThis.sessionStorage ?? null; } catch { return null; } };

export function isDecodeCompleted(storage = local()) {
  try { return storage?.getItem(COMPLETED_KEY) === "1"; } catch { return false; }
}

export function markDecodeCompleted(storage = local()) {
  try { storage?.setItem(COMPLETED_KEY, "1"); return true; } catch { return false; }
}

let memoryOverride = false;

export function isDecodeFinished(storage = local()) {
  try { return storage?.getItem(FINISHED_KEY) === "1"; } catch { return false; }
}

export function markDecodeFinished(storage = local()) {
  try { storage?.setItem(FINISHED_KEY, "1"); return true; } catch { return false; }
}

export function allowSpoilersThisVisit(storage = session()) {
  memoryOverride = true;
  try { storage?.setItem(OVERRIDE_KEY, "1"); } catch { /* the in-memory flag still applies to this page view */ }
}

/** True when the answers may be shown: Decode finished once, or the person chose "Show anyway" in this tab. */
export function spoilersUnlocked({ completedStorage = local(), overrideStorage = session() } = {}) {
  if (isDecodeCompleted(completedStorage) || memoryOverride) return true;
  try { return overrideStorage?.getItem(OVERRIDE_KEY) === "1"; } catch { return false; }
}

export function resetOverrideForTests() { memoryOverride = false; }
