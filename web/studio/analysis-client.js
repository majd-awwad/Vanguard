import { runEcho } from "./echo-core.js";
import { runHunter } from "./hunter-core.js";

// Runs Hunter and Echo in a Web Worker (web/studio/hunter.worker.js). Every request has an id; aborting posts a cancel
// message and rejects at once, so a late answer can never reach the page. If a module worker cannot start, the same
// pure core runs on the main thread (slower, identical results).

const abortError = () => Object.assign(new Error("Search cancelled"), { name: "AbortError" });

export function createAnalysisClient({
  createWorker = () => new Worker(new URL("./hunter.worker.js", import.meta.url), { type: "module" }),
} = {}) {
  let worker = null;
  let broken = false;
  let counter = 0;
  const pending = new Map();

  function ensure() {
    if (broken) return null;
    if (worker) return worker;
    try {
      worker = createWorker();
      worker.onmessage = ({ data }) => {
        const job = pending.get(data.id);
        if (!job) return;
        pending.delete(data.id);
        job.cleanup();
        if (data.error) job.reject(new Error(data.error)); else job.resolve(data.result);
      };
      worker.onerror = () => {
        broken = true;
        for (const [id, job] of pending) { pending.delete(id); job.cleanup(); job.fallback(); }
        worker = null;
      };
    } catch {
      broken = true;
      worker = null;
    }
    return worker;
  }

  async function local(type, query, data, signal) {
    const options = { shouldCancel: () => signal?.aborted === true, yieldFn: () => new Promise((resolve) => setTimeout(resolve, 0)) };
    const result = await (type === "echo" ? runEcho(query, data, options) : runHunter(query, data, options));
    if (signal?.aborted) throw abortError();
    return result;
  }

  return {
    get usesWorker() { return Boolean(worker) && !broken; },
    request(type, query, data, signal) {
      if (signal?.aborted) return Promise.reject(abortError());
      const target = ensure();
      if (!target) return local(type, query, data, signal);
      return new Promise((resolve, reject) => {
        const id = ++counter;
        const onAbort = () => { if (pending.delete(id)) { target.postMessage({ type: "cancel", id }); reject(abortError()); } };
        const cleanup = () => signal?.removeEventListener("abort", onAbort);
        pending.set(id, { resolve, reject, cleanup, fallback: () => local(type, query, data, signal).then(resolve, reject) });
        signal?.addEventListener("abort", onAbort, { once: true });
        target.postMessage({ id, type, query, data });
      });
    },
    dispose() { worker?.terminate(); worker = null; pending.clear(); },
  };
}
