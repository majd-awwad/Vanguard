import { makePlan, bandEvidence } from "../../audio/gedi-plan.js";

export function createSession(data, transport) {
  const listeners = new Set();
  const shotAt = (id) => data.footprints.find((row) => row.id === id);
  let selection = { axis: "horizontal", shotId: data.guide.low, bandM: data.guide.band };
  let plan = makePlan(data, selection);
  let inspected = null;
  let revealed = false;
  let exploration = false;
  let transportState;

  function snapshot() {
    const event = plan.events.find((item) => item.id === transportState.activeEventId) ?? plan.events[0];
    const observation = shotAt(event.evidence.observationId);
    return { selection, plan, transport: transportState, event, observation, inspected, revealed, exploration };
  }

  function emit() {
    const state = snapshot();
    for (const listener of listeners) listener(state);
  }

  transport.subscribe((state) => {
    transportState = state;
    emit();
  });
  transport.load(plan, plan.events.find((event) => event.evidence.observationId === selection.shotId).onsetS);

  function select(next, positionFor = () => 0) {
    selection = next;
    plan = makePlan(data, next);
    transport.load(plan, positionFor(plan));
  }

  const startOfShot = (id) => (next) =>
    next.events.find((event) => event.evidence.observationId === id)?.onsetS ?? 0;

  function dispatch(intent) {
    const current = snapshot();
    switch (intent.type) {
      case "axis": {
        if (selection.axis === intent.axis) return;
        const shotId = current.observation.id;
        select({ ...selection, axis: intent.axis, shotId }, startOfShot(shotId));
        return;
      }
      case "footprint": {
        if (!shotAt(intent.shotId)) return;
        if (selection.axis === "vertical") {
          select({ ...selection, shotId: intent.shotId });
        } else {
          transport.seek(startOfShot(intent.shotId)(plan));
        }
        return;
      }
      case "band":
        if (selection.axis !== "horizontal") return;
        select({ ...selection, bandM: intent.band, shotId: current.observation.id }, startOfShot(current.observation.id));
        return;
      case "height":
        if (selection.axis === "vertical" && plan.events[intent.index]) {
          transport.seek(plan.events[intent.index].onsetS);
        }
        return;
      case "compare":
        if (![data.guide.low, data.guide.high].includes(intent.shotId)) return;
        select({ axis: "horizontal", shotId: intent.shotId, bandM: data.guide.band }, startOfShot(intent.shotId));
        return;
      case "step": {
        const index = plan.events.indexOf(current.event);
        const next = Math.max(0, Math.min(plan.events.length - 1, index + intent.direction));
        transport.seek(plan.events[next].onsetS);
        return;
      }
      case "inspect":
        transport.pause();
        inspected = { ...current.event.evidence, observation: current.observation };
        emit();
        return;
      case "reveal":
        revealed = true;
        emit();
        return;
      case "explore":
        exploration = true;
        emit();
        return;
      case "play":
        if (intent.fromStart) return transport.replay(intent.mode);
        return transport.play(intent.mode);
      case "pause": return transport.pause();
      case "replay": return transport.replay(intent.mode);
      case "speed": return transport.setSpeed(intent.value);
      case "volume": return transport.setVolume(intent.value);
      case "mute": return transport.setMuted(intent.value);
    }
  }

  return {
    data, snapshot, dispatch,
    comparison: data.footprints.map((row) => ({
      observation: row, evidence: bandEvidence(data, row, data.guide.band),
    })).filter(({ observation }) => [data.guide.low, data.guide.high].includes(observation.id)),
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
  };
}
