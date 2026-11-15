// Earth Map application state (spec section 11): one pure reducer, so the "must never happen" cases are testable.
// Effects (audio, speech, map movement) are performed by the page when it observes the state change.

export const TOOLS = Object.freeze({ EXPLORE: "EXPLORE", HUNTER: "HUNTER", ECHO: "ECHO" });
export const SOUND_MODES = Object.freeze({ GUIDED_VOICE: "GUIDED_VOICE", PURE_SONIFICATION: "PURE_SONIFICATION" });
export const AUDIO = Object.freeze({ IDLE: "IDLE", PLAYING: "PLAYING", PAUSED: "PAUSED", MUTED: "MUTED" });
export const SPEECH = Object.freeze({ IDLE: "IDLE", SPEAKING: "SPEAKING", UNAVAILABLE: "UNAVAILABLE" });
export const EVENTS = Object.freeze([
  "SELECT_DATASET", "SELECT_SAMPLE", "MOVE_FOCUS", "START_SCAN", "STOP_SCAN", "SET_SOUND_MODE", "RUN_HUNTER", "OPEN_FINDING",
  "SEARCH_ECHO", "OPEN_ECHO_MATCH", "DATA_ERROR", "SPEECH_UNAVAILABLE",
  // supporting events
  "SET_TOOL", "SET_TIME_RANGE", "SET_CAMERA", "SET_AUDIO", "SET_SPEECH", "SET_LANGUAGE", "HUNTER_RESULT", "ECHO_RESULT", "CANCEL_SEARCH",
]);

export function createAppState(overrides = {}) {
  return {
    datasetId: "dust", variable: "values", timeRange: { start: null, end: null }, selectedSampleId: null, focusSampleId: null,
    cameraBounds: null, tool: TOOLS.EXPLORE, soundMode: null,
    audio: AUDIO.IDLE, speech: SPEECH.IDLE,
    queryFilters: null, findings: [], selectedFindingId: null, hunterRequestId: 0, hunterStatus: "idle",
    echoSourceId: null, echoMatches: [], echoRequestId: 0, echoStatus: "idle", echoDatasetId: null,
    uiLanguage: "en", error: null,
    ...overrides,
  };
}

const sameSample = (id) => (typeof id === "string" || typeof id === "number" ? id : null);

/** Returns the next state. Unknown events and stale results are ignored (the same state object is returned). */
export function reduce(state, event) {
  const p = event.payload ?? {};
  switch (event.type) {
    case "SELECT_DATASET": {
      if (p.datasetId === state.datasetId && (!p.variable || p.variable === state.variable)) return state;
      // The position, tool, date range and sound mode survive; results that belong to the old dataset must not.
      return { ...state, datasetId: p.datasetId, variable: p.variable ?? state.variable, findings: [], selectedFindingId: null, queryFilters: null,
        hunterStatus: "idle", hunterRequestId: state.hunterRequestId + 1, echoSourceId: null, echoMatches: [], echoStatus: "idle",
        echoRequestId: state.echoRequestId + 1, echoDatasetId: null, audio: state.audio === AUDIO.PLAYING ? AUDIO.IDLE : state.audio, error: null };
    }
    case "SELECT_SAMPLE": return { ...state, selectedSampleId: sameSample(p.sampleId), focusSampleId: sameSample(p.sampleId) };
    case "MOVE_FOCUS": return { ...state, focusSampleId: sameSample(p.sampleId) };
    case "START_SCAN": return { ...state, audio: AUDIO.PLAYING };
    case "STOP_SCAN": return { ...state, audio: AUDIO.IDLE };
    case "SET_AUDIO": return { ...state, audio: p.audio };
    case "SET_SPEECH": return { ...state, speech: p.speech };
    case "SET_SOUND_MODE": {
      if (!SOUND_MODES[p.mode]) return state;
      // Switching never touches the data, position, tool, findings or matches. Speech is cancelled when leaving Guided.
      return { ...state, soundMode: p.mode, speech: state.speech === SPEECH.UNAVAILABLE ? SPEECH.UNAVAILABLE : SPEECH.IDLE };
    }
    case "SET_TOOL": return TOOLS[p.tool] ? { ...state, tool: p.tool } : state;
    case "SET_TIME_RANGE": return { ...state, timeRange: { start: p.start ?? null, end: p.end ?? p.start ?? null } };
    case "SET_CAMERA": return { ...state, cameraBounds: p.bounds ?? null };
    case "SET_LANGUAGE": return { ...state, uiLanguage: p.language === "ar" ? "ar" : "en" };
    case "RUN_HUNTER": return { ...state, queryFilters: p.filters ?? null, hunterRequestId: state.hunterRequestId + 1, hunterStatus: "running", findings: [], selectedFindingId: null };
    case "CANCEL_SEARCH": return { ...state, hunterStatus: state.hunterStatus === "running" ? "cancelled" : state.hunterStatus, hunterRequestId: state.hunterRequestId + 1, echoStatus: state.echoStatus === "running" ? "cancelled" : state.echoStatus, echoRequestId: state.echoRequestId + 1 };
    case "HUNTER_RESULT": {
      // Late results of a superseded or cancelled query, or of another dataset, are dropped.
      if (p.requestId !== state.hunterRequestId || p.datasetId !== state.datasetId) return state;
      return { ...state, findings: p.findings ?? [], hunterStatus: p.status ?? "done" };
    }
    case "OPEN_FINDING": {
      const finding = state.findings.find((f) => f.id === p.id);
      if (!finding) return state;
      return { ...state, selectedFindingId: finding.id, selectedSampleId: finding.sampleId, focusSampleId: finding.sampleId };
    }
    case "SEARCH_ECHO": return { ...state, echoSourceId: sameSample(p.sourceId), echoRequestId: state.echoRequestId + 1, echoStatus: "running", echoMatches: [], echoDatasetId: state.datasetId };
    case "ECHO_RESULT": {
      if (p.requestId !== state.echoRequestId || p.datasetId !== state.datasetId) return state;
      return { ...state, echoMatches: p.matches ?? [], echoStatus: p.status ?? "done" };
    }
    case "OPEN_ECHO_MATCH": {
      if (!state.echoMatches.some((m) => m.sampleId === p.sampleId)) return state;
      return { ...state, selectedSampleId: p.sampleId, focusSampleId: p.sampleId };
    }
    case "DATA_ERROR": return { ...state, error: p.message ?? "error", hunterStatus: state.hunterStatus === "running" ? "error" : state.hunterStatus, echoStatus: state.echoStatus === "running" ? "error" : state.echoStatus };
    case "SPEECH_UNAVAILABLE": return { ...state, speech: SPEECH.UNAVAILABLE };
    default: return state;
  }
}

/** Invariants that must hold for every reachable state. Returns a list of violations (empty = fine). */
export function invariantViolations(state) {
  const problems = [];
  if (state.selectedFindingId && !state.findings.some((f) => f.id === state.selectedFindingId)) problems.push("selected finding is not in the findings list");
  if (state.echoMatches.length && state.echoDatasetId !== state.datasetId) problems.push("echo matches belong to another dataset");
  if (state.findings.length && state.hunterStatus === "running") problems.push("findings shown while a search is running");
  return problems;
}

export function createStore(initial = createAppState(), onChange = () => {}) {
  let state = initial;
  const listeners = new Set([onChange]);
  return {
    get state() { return state; },
    dispatch(type, payload) {
      const next = reduce(state, { type, payload });
      if (next !== state) { const previous = state; state = next; for (const l of listeners) l(state, previous, type); }
      return state;
    },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
  };
}
