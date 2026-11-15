import { fileFor } from "./ambience-core.js";

// The ambience engine: seamless loops (two overlapping sources with a 0.5 s crossfade), a 400 ms crossfade when the
// level changes, never two levels at full volume together. It sits about 12 dB under the data sonification, has its
// own volume, is ducked further while speech is speaking, and never starts before the user has enabled sound.

export const CROSSFADE_S = 0.5;
export const LEVEL_FADE_S = 0.4;
export const UNDER_DATA_DB = -12;
export const UNDER_DATA_GAIN = 10 ** (UNDER_DATA_DB / 20); // 0.251
export const SPEECH_DUCK = 0.15;
const SETTLE_MS = 140; // quick pointer movement does not flap between recordings

export function createAmbience({
  baseUrl, createContext = () => new (globalThis.AudioContext ?? globalThis.webkitAudioContext)(), fetchImpl = (...a) => fetch(...a),
  reduced = () => false, setTimer = (f, ms) => setTimeout(f, ms), clearTimer = (id) => clearTimeout(id), setTick = (f, ms) => setInterval(f, ms), clearTick = (id) => clearInterval(id),
} = {}) {
  let context = null;
  let master = null;
  let volume = 1;
  let dataVolume = 0.72;
  let duck = 1;
  let current = null; // { key, node, stop }
  let fading = null;
  let wanted = null; // { phenomenon, level } or null
  let settle = null;
  const buffers = new Map();

  const level = () => dataVolume * UNDER_DATA_GAIN * volume * duck;
  const applyLevel = () => { if (master && context) { master.gain.cancelScheduledValues(context.currentTime); master.gain.setTargetAtTime(level(), context.currentTime, 0.05); } };

  function ensureContext() {
    if (context) return context;
    context = createContext();
    master = context.createGain();
    master.gain.value = level();
    master.connect(context.destination);
    return context;
  }

  async function bufferFor(file) {
    if (!buffers.has(file)) {
      buffers.set(file, (async () => {
        const response = await fetchImpl(new URL(file, baseUrl));
        if (!response.ok) throw new Error("Could not load " + file);
        return context.decodeAudioData(await response.arrayBuffer());
      })());
    }
    return buffers.get(file);
  }

  /** One looping recording: instances start every (duration - crossfade) and fade in and out across the overlap. */
  async function startLoop(file) {
    const buffer = await bufferFor(file);
    const node = context.createGain();
    node.gain.value = 0;
    node.connect(master);
    const xf = Math.min(CROSSFADE_S, buffer.duration / 3);
    const sources = new Set();
    let nextStart = context.currentTime + 0.05;
    let stopped = false;
    const schedule = () => {
      while (!stopped && nextStart - context.currentTime < 1.2) {
        const source = context.createBufferSource();
        const instance = context.createGain();
        source.buffer = buffer;
        source.connect(instance);
        instance.connect(node);
        instance.gain.setValueAtTime(0, nextStart);
        instance.gain.linearRampToValueAtTime(1, nextStart + xf);
        instance.gain.setValueAtTime(1, nextStart + buffer.duration - xf);
        instance.gain.linearRampToValueAtTime(0, nextStart + buffer.duration);
        source.start(nextStart);
        source.stop(nextStart + buffer.duration + 0.05);
        sources.add(source);
        source.onended = () => { sources.delete(source); source.disconnect(); instance.disconnect(); };
        nextStart += buffer.duration - xf;
      }
    };
    schedule();
    const tick = setTick(schedule, 250);
    return {
      node,
      stop() { stopped = true; clearTick(tick); for (const s of sources) { try { s.stop(); } catch { /* already stopped */ } } node.disconnect(); },
    };
  }

  const fadeTime = () => (reduced() ? 0.06 : LEVEL_FADE_S);

  async function apply() {
    const target = wanted;
    if (!target && !context) return;
    const key = target ? `${target.phenomenon}-${target.level}` : null;
    if ((current?.key ?? null) === key) return;
    ensureContext();
    if (context.state === "suspended") await context.resume?.();
    const now = context.currentTime;
    const seconds = fadeTime();
    // At most two recordings are ever alive: finish any older fade immediately.
    if (fading) { fading.loop.stop(); clearTimer(fading.timer); fading = null; }
    const old = current;
    current = null;
    if (old) {
      old.loop.node.gain.cancelScheduledValues(now);
      old.loop.node.gain.setValueAtTime(old.loop.node.gain.value, now);
      old.loop.node.gain.linearRampToValueAtTime(0, now + seconds);
      fading = { loop: old.loop, timer: setTimer(() => { old.loop.stop(); if (fading?.loop === old.loop) fading = null; }, seconds * 1000 + 80) };
    }
    if (!target) return;
    try {
      const loop = await startLoop(fileFor(target.phenomenon, target.level));
      if (wanted?.phenomenon !== target.phenomenon || wanted?.level !== target.level) { loop.stop(); return; } // changed again while loading
      const at = context.currentTime;
      loop.node.gain.setValueAtTime(0, at);
      loop.node.gain.linearRampToValueAtTime(1, at + seconds);
      current = { key, loop };
    } catch (error) {
      console.warn("Ambience unavailable", error);
    }
  }

  return {
    /** Which recording should play now (null = silence). Safe to call on every cursor move. */
    setLevel(phenomenon, levelName) {
      wanted = phenomenon && levelName ? { phenomenon, level: levelName } : null;
      clearTimer(settle);
      if (!wanted) { apply(); return; }
      settle = setTimer(apply, SETTLE_MS);
    },
    setVolume(value) { volume = value; applyLevel(); },
    setDataVolume(value) { dataVolume = value; applyLevel(); },
    setDuck(on) { duck = on ? SPEECH_DUCK : 1; applyLevel(); },
    /** Mute or sound off: fade everything out and release it. */
    stop() { wanted = null; clearTimer(settle); apply(); },
    get active() { return current?.key ?? null; },
    get gain() { return level(); },
    get alive() { return (current ? 1 : 0) + (fading ? 1 : 0); },
  };
}
