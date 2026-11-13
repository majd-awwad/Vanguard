function webAudio() {
  return new AudioContext();
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
  let origin = 0;
  let clock = now;
  let status = "idle";
  let speed = 1;
  let volume = 0.72;
  let muted = false;
  let playback = "audio";
  let audioUnavailable = false;

  function snapshot() {
    const positionS = status === "playing"
      ? Math.min(plan.durationS, position + Math.max(0, clock() - origin) * speed) : position;
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
      if (!event.tone || event.onsetS < position - 1e-9) continue;
      const { frequencyHz, attackS, releaseS, durationS, gain } = event.tone;
      const start = origin + (event.onsetS - position) / speed;
      const end = start + durationS / speed;
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequencyHz;
      envelope.gain.setValueAtTime(0, start);
      envelope.gain.linearRampToValueAtTime(gain, start + attackS / speed);
      envelope.gain.setValueAtTime(gain, end - releaseS / speed);
      envelope.gain.linearRampToValueAtTime(0, end);
      oscillator.connect(envelope);
      envelope.connect(master);
      pending.add(oscillator);
      oscillator.onended = () => {
        pending.delete(oscillator);
        oscillator.disconnect();
        envelope.disconnect();
      };
      oscillator.start(start);
      oscillator.stop(end);
    }
  }

  function tick() {
    if (status !== "playing") return;
    if (snapshot().positionS >= plan.durationS) {
      position = plan.durationS;
      status = "ended";
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

  async function play(mode = "audio") {
    if (!plan || status === "playing" || status === "starting") return;
    if (status === "ended") position = 0;
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
      plan = next;
      revision++;
      seek(start);
    },
    play,
    pause,
    seek,
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
      volume = Math.max(0, Math.min(1, next));
      updateVolume();
      emit();
    },
    setMuted(next) {
      muted = next;
      updateVolume();
      emit();
    },
  };
}
