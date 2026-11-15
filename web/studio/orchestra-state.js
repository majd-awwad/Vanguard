import { ORCHESTRA_IDS, recordingLevel } from "./orchestra-data.js";

// A preference identifies an actual averaging window, independently of date and map layer.
export function windowIdentity(key) {
  const [start, end, kind] = (key ?? "").split("|");
  const duration = Date.parse(end) - Date.parse(start);
  return kind && Number.isFinite(duration) && duration > 0 ? `${kind}|${start.slice(11)}|${end.slice(11)}|${duration}` : null;
}

/** Choices already contain observations validated by the unchanged scientific gate. */
export function chooseListeningWindow(choices, preference = null) {
  const ranked = [...choices].sort((a, b) => b.compatible - a.compatible);
  const selected = preference ? choices.find(c => windowIdentity(c.key) === preference) ?? null : ranked[0] ?? null;
  const unavailable = !selected || selected.compatible === 0;
  return { selected, unavailable, alternative: unavailable ? ranked.find(c => c.compatible > 0) ?? null : null };
}

/** Layer-level audibility during playback, not the instantaneous gaps between pulses. */
export function channelPresentation(observations, settings, { playing = false, outputOn = true } = {}) {
  const soloed = ORCHESTRA_IDS.some(id => observations[id]?.ok && settings[id].enabled && settings[id].solo);
  const channels = Object.fromEntries(ORCHESTRA_IDS.map(id => {
    const item = observations[id], s = settings[id];
    const compatible = Boolean(item?.ok), enabled = compatible && s.enabled;
    const level = compatible ? (item.level !== undefined ? item.level : recordingLevel(id, item.value)) : null;
    const silent = compatible && !level, excluded = Boolean(soloed && !s.solo);
    const canSound = Boolean(enabled && !silent && !s.muted && !excluded && s.gain > 0);
    return [id, { compatible, enabled: Boolean(enabled), silent, excluded, canSound, audible: Boolean(playing && outputOn && canSound) }];
  }));
  const count = key => Object.values(channels).filter(c => c[key]).length;
  return { channels, compatible: count("compatible"), enabled: count("enabled"), audible: count("audible"), canSound: count("canSound") };
}
