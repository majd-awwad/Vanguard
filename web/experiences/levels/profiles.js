// Local profiles for Decode. No login, no server: everything lives in this browser's localStorage under one versioned key.
// Each profile keeps its own completed levels, current progress, best score per level, total, achievements and last level.
// Every storage access is wrapped in try/catch, so a blocked or full storage never breaks the game (the profile then lives in memory only).
import { LEVEL_COUNT } from "./levels.js";

export const PROFILES_KEY = "earthpulse.decode.profiles.v1";
export const SCHEMA_VERSION = 1;
export const AVATARS = Object.freeze(["globe", "dune", "cloud", "wave", "wind", "sun", "rocket", "satellite"]);
export const MAX_PROFILES = 8;
export const NAME_MAX = 24;
export const ACHIEVEMENTS = Object.freeze(["level-1", "level-2", "level-3", "level-4", "level-5", "no-hints", "perfect-level", "earth-master"]);

const blank = () => ({ version: SCHEMA_VERSION, activeId: null, profiles: [] });
const clean = (text) => String(text ?? "").replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, NAME_MAX);

const defaultStorage = () => { try { return globalThis.localStorage ?? null; } catch { return null; } };
let counter = 0;
const newId = () => "p" + Date.now().toString(36) + (counter++).toString(36) + Math.floor(Math.random() * 1296).toString(36);

export function emptyProgress() {
  return { completed: [], best: {}, total: 0, achievements: [], lastLevel: null, current: null, finishedAt: null };
}

function sanitizeProfile(p) {
  if (!p || typeof p !== "object" || typeof p.id !== "string") return null;
  const name = clean(p.name);
  if (!name) return null;
  const progress = emptyProgress();
  const src = p.progress ?? {};
  const levels = Array.isArray(src.completed) ? src.completed.filter((n) => Number.isInteger(n) && n >= 1 && n <= LEVEL_COUNT) : [];
  progress.completed = [...new Set(levels)].sort();
  for (const [k, v] of Object.entries(src.best ?? {})) { const n = Number(k); if (Number.isInteger(n) && n >= 1 && n <= LEVEL_COUNT && Number.isFinite(v)) progress.best[n] = Math.max(0, Math.min(100, Math.round(v))); }
  progress.total = Object.values(progress.best).reduce((s, v) => s + v, 0);
  progress.achievements = Array.isArray(src.achievements) ? src.achievements.filter((a) => ACHIEVEMENTS.includes(a)) : [];
  progress.lastLevel = Number.isInteger(src.lastLevel) && src.lastLevel >= 1 && src.lastLevel <= LEVEL_COUNT ? src.lastLevel : null;
  progress.current = src.current && typeof src.current === "object" && Number.isInteger(src.current.levelId) ? src.current : null;
  progress.finishedAt = typeof src.finishedAt === "string" ? src.finishedAt : null;
  return { id: p.id, name, avatar: AVATARS.includes(p.avatar) ? p.avatar : AVATARS[0], createdAt: typeof p.createdAt === "string" ? p.createdAt : new Date(0).toISOString(), progress };
}

export function createProfileStore({ storage = defaultStorage(), now = () => new Date().toISOString() } = {}) {
  let data = blank();
  let persisted = true;
  function load() {
    try {
      const raw = storage?.getItem(PROFILES_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === SCHEMA_VERSION && Array.isArray(parsed.profiles)) {
          data = { version: SCHEMA_VERSION, activeId: typeof parsed.activeId === "string" ? parsed.activeId : null, profiles: parsed.profiles.map(sanitizeProfile).filter(Boolean).slice(0, MAX_PROFILES) };
          if (!data.profiles.some((p) => p.id === data.activeId)) data.activeId = null;
        }
      }
    } catch { data = blank(); }
  }
  function save() {
    try { storage?.setItem(PROFILES_KEY, JSON.stringify(data)); persisted = true; } catch { persisted = false; }
    return persisted;
  }
  load();
  const find = (id) => data.profiles.find((p) => p.id === id) ?? null;
  const api = {
    get persisted() { return persisted && Boolean(storage); },
    list: () => data.profiles.map((p) => structuredClone(p)),
    get(id) { const p = find(id); return p ? structuredClone(p) : null; },
    get activeId() { return data.activeId; },
    active() { return api.get(data.activeId); },
    create({ name, avatar }) {
      const clear = clean(name);
      if (!clear) return { ok: false, error: "name" };
      if (data.profiles.length >= MAX_PROFILES) return { ok: false, error: "full" };
      if (data.profiles.some((p) => p.name.toLowerCase() === clear.toLowerCase())) return { ok: false, error: "duplicate" };
      const profile = { id: newId(), name: clear, avatar: AVATARS.includes(avatar) ? avatar : AVATARS[0], createdAt: now(), progress: emptyProgress() };
      data.profiles.push(profile);
      data.activeId = profile.id;
      save();
      return { ok: true, profile: structuredClone(profile) };
    },
    select(id) { if (!find(id)) return false; data.activeId = id; save(); return true; },
    signOut() { data.activeId = null; save(); },
    remove(id) {
      const before = data.profiles.length;
      data.profiles = data.profiles.filter((p) => p.id !== id);
      if (data.activeId === id) data.activeId = null;
      save();
      return data.profiles.length < before;
    },
    /** Unlocked levels: 1, plus the level after the highest completed one in a row. */
    unlockedLevels(id = data.activeId) {
      const p = find(id);
      if (!p) return [1];
      let n = 1;
      while (n < LEVEL_COUNT && p.progress.completed.includes(n)) n++;
      return Array.from({ length: n }, (_, i) => i + 1);
    },
    /** Saves a level in progress (objective states only, no data values) and remembers it as the last level. */
    saveCurrent(id, snapshot) {
      const p = find(id);
      if (!p || !snapshot) return false;
      p.progress.current = structuredClone(snapshot);
      p.progress.lastLevel = snapshot.levelId;
      save();
      return true;
    },
    /** A level finished with this result: keeps the BEST score, never lowers it, updates the total and the achievements. */
    completeLevel(id, result) {
      const p = find(id);
      if (!p) return null;
      const level = result.levelId;
      const score = Math.max(0, Math.min(100, Math.round(result.score)));
      const first = !p.progress.completed.includes(level);
      if (first) p.progress.completed = [...p.progress.completed, level].sort();
      const previous = p.progress.best[level] ?? 0;
      p.progress.best[level] = Math.max(previous, score);
      p.progress.total = Object.values(p.progress.best).reduce((s, v) => s + v, 0);
      p.progress.lastLevel = level;
      p.progress.current = null;
      const earn = (a) => { if (!p.progress.achievements.includes(a)) p.progress.achievements.push(a); };
      earn("level-" + level);
      if (result.hints === 0) earn("no-hints");
      if (score === 100) earn("perfect-level");
      const all = p.progress.completed.length === LEVEL_COUNT;
      if (all) { earn("earth-master"); p.progress.finishedAt ??= now(); }
      save();
      return { first, improved: score > previous, best: p.progress.best[level], total: p.progress.total, allDone: all, profile: structuredClone(p) };
    },
  };
  return api;
}

export const bestOf = (profile, level) => profile?.progress.best[level] ?? 0;
