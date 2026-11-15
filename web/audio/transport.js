function webAudio() {
  const Context = globalThis.AudioContext ?? globalThis.webkitAudioContext;
  if (!Context) throw new Error("Web Audio is unavailable.");
  return new Context();
}

export function createTransport({
  createContext = webAudio,
  now = () => performance.now() / 1000,
  requestFrame = (callback) => requestAnimationFrame(callback),
  cancelFrame = (key) => cancelAnimationFrame(key),
} = {}) {
  const listeners = new Set();
  const pending = new Set();
  let plan, context, master, frame;
  let revision = 0;
  let token = 0;
  let position = 0;
  let limit;
  let origin = 0;
  let clock = now;
  let status = "idle";
  let speed = 1;
  let volume = 0.72;
  let muted = false;
  let playback = "audio";
  let audioUnavailable = false;

  // Optional buses used by Scientific Orchestra. Legacy plans retain their routing.
  const channelBuses = new Map();
  let channelSettings = {};
  const channelLevel = (id) => {
    const c = channelSettings[id];
    const solo = Object.values(channelSettings).some(x => x.enabled && x.solo);
    return !c || !c.enabled || c.muted || (solo && !c.solo) ? 0 : Math.max(0, Math.min(1, c.gain ?? 1)) / 4;
  };
  function channelOutput(id) {
    if (!id) return master;
    if (!channelBuses.has(id)) {
      const bus = context.createGain();
      bus.gain.value = channelLevel(id);
      bus.connect(master);
      channelBuses.set(id, bus);
    }
    return channelBuses.get(id);
  }

  function snapshot() {
    const positionS = status === "playing"
      ? Math.min(limit, position + Math.max(0, clock() - origin) * speed) : position;
    const current = plan?.events.findLast((event) => event.onsetS <= positionS + 1e-9);
    return {
      planRevision: revision, status, positionS, activeEventId: current?.id ?? null,
      awaitingOnset: status === "playing" && clock() < origin,
      speed, volume, muted, playback, audioUnavailable,
    };
  }

  function emit() {
    const value = snapshot();
    for (const listener of listeners) listener(value);
  }

  function clearSchedule() {
    token++;
    if (frame !== undefined) cancelFrame(frame);
    frame = undefined;
    for (const node of pending) node.stop();
    pending.clear();
  }

  function updateVolume() {
    if (!master) return;
    master.gain.setTargetAtTime(muted ? 0 : volume, context.currentTime, 0.012);
  }

  function scheduleAudio() {
    for (const event of plan.events) {
      if (!event.tone || event.onsetS >= limit) continue;
      const voices = event.tone.pulses ?? [0];
      for (const offset of voices) scheduleTone(event.tone, event.onsetS + offset, event.channelId);
    }
  }

  function scheduleTone(tone, onset, channelId) {
    // Both spatial voice types use their supplied envelope; crackle durationS
    // is per pulse, just like legacy temporal rain plans.
    const { frequencyHz, attackS, releaseS, durationS, gain, waveform = "sine" } = tone;
    if ((!channelId && onset < position - 1e-9) || onset + durationS <= position || onset >= limit) return;
    const actualOnset = Math.max(onset, position);
    const start = origin + (actualOnset - position) / speed;
    const end = origin + (Math.min(onset + durationS, limit) - position) / speed;
    const span = (end - start) * speed;
    if (span < attackS + releaseS) return;
    const oscillator = context.createOscillator();
    const envelope = context.createGain();
    oscillator.type = waveform;
    oscillator.frequency.value = frequencyHz;
    envelope.gain.setValueAtTime(0, start);
    envelope.gain.linearRampToValueAtTime(gain, start + attackS / speed);
    envelope.gain.setValueAtTime(gain, end - releaseS / speed);
    envelope.gain.linearRampToValueAtTime(0, end);
    oscillator.connect(envelope);
    let panner;
    if (Number.isFinite(tone.pan) && typeof context.createStereoPanner === "function") {
      try {
        panner = context.createStereoPanner();
        panner.pan.value = Math.max(-1, Math.min(1, tone.pan));
      } catch {
        panner?.disconnect();
        panner = undefined;
      }
    }
    if (panner) {
      envelope.connect(panner);
      panner.connect(channelOutput(channelId));
    } else {
      envelope.connect(channelOutput(channelId));
    }
    const scheduled = channelId ? { stop() {
      const time = context.currentTime;
      if (envelope.gain.cancelAndHoldAtTime) envelope.gain.cancelAndHoldAtTime(time);
      else { envelope.gain.cancelScheduledValues(time); envelope.gain.setValueAtTime(envelope.gain.value, time); }
      envelope.gain.linearRampToValueAtTime(0, time + 0.02);
      oscillator.stop(time + 0.02);
    } } : oscillator;
    oscillator.onended = () => {
      pending.delete(scheduled);
      oscillator.disconnect();
      envelope.disconnect();
      panner?.disconnect();
    };
    oscillator.start(start);
    pending.add(scheduled);
    oscillator.stop(end);
  }

  function tick() {
    if (status !== "playing") return;
    if (snapshot().positionS >= limit) {
      position = limit;
      status = limit === plan.durationS ? "ended" : "paused";
      frame = undefined;
      emit();
      return;
    }
    emit();
    frame = requestFrame(tick);
  }

  function startRunning(mode) {
    playback = mode;
    clock = mode === "audio" ? () => context.currentTime : now;
    origin = clock() + (mode === "audio" ? 0.035 : 0);
    status = "playing";
    if (mode === "audio") scheduleAudio();
    tick();
  }

  async function play(mode = "audio", previewDuration) {
    if (!plan || status === "playing" || status === "starting") return;
    if (status === "ended") position = 0;
    limit = previewDuration === undefined ? plan.durationS : Math.min(plan.durationS, position + previewDuration);
    audioUnavailable = false;
    if (mode === "silent") {
      startRunning("silent");
      return;
    }
    const playbackToken = ++token;
    status = "starting";
    emit();
    try {
      if (!context) {
        const freshContext = createContext();
        const freshMaster = freshContext.createGain();
        freshMaster.connect(freshContext.destination);
        context = freshContext;
        master = freshMaster;
        master.gain.value = muted ? 0 : volume;
      }
      if (context.state !== "running") await context.resume();
      if (playbackToken !== token) return;
      if (context.state !== "running") throw new Error("Audio context did not start.");
      startRunning("audio");
    } catch {
      if (playbackToken !== token) return;
      clearSchedule();
      audioUnavailable = true;
      startRunning("silent");
    }
  }

  function pause() {
    if (status !== "playing" && status !== "starting") return;
    position = snapshot().positionS;
    clearSchedule();
    status = "paused";
    emit();
  }

  function seek(positionS) {
    if (!plan) return;
    clearSchedule();
    position = Math.max(0, Math.min(plan.durationS, positionS));
    status = "paused";
    emit();
  }

  return {
    snapshot,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    load(next, start = 0) {
      channelSettings = next.channels ?? {};
      for (const [id, bus] of channelBuses) bus.gain.setTargetAtTime(channelLevel(id), context.currentTime, 0.012);
      plan = next;
      revision++;
      seek(start);
    },
    play,
    pause,
    seek,
    stop() { seek(0); },
    replay(mode = playback) {
      seek(0);
      return play(mode);
    },
    setSpeed(next) {
      if (!Number.isFinite(next) || next <= 0 || next === speed) return;
      const running = status === "playing";
      position = snapshot().positionS;
      speed = next;
      if (running) {
        clearSchedule();
        startRunning(playback);
      } else {
        emit();
      }
    },
    setVolume(next) {
      if (!Number.isFinite(next)) return;
      volume = Math.max(0, Math.min(1, next));
      updateVolume();
      emit();
    },
    setMuted(next) {
      muted = next;
      updateVolume();
      emit();
    },
    setChannels(next) {
      channelSettings = next;
      if (context) for (const [id, bus] of channelBuses) bus.gain.setTargetAtTime(channelLevel(id), context.currentTime, 0.012);
    },
    dispose() {
      clearSchedule();
      for (const bus of channelBuses.values()) bus.disconnect();
      channelBuses.clear();
      master?.disconnect();
      context?.close?.();
      context = undefined; master = undefined; status = "idle";
      listeners.clear();
    },
  };
}
