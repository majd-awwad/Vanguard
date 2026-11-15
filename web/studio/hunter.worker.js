// Web Worker: runs Signal Hunter and Echo Finder off the main thread over the data posted by the page.
// Messages carry an id; { type: "cancel", id } stops a running job between slices, and the page ignores results of
// any id that is no longer current.
import { runEcho } from "./echo-core.js";
import { runHunter } from "./hunter-core.js";

const cancelled = new Set();
const yieldFn = () => new Promise((resolve) => setTimeout(resolve, 0));

self.onmessage = async ({ data: message }) => {
  if (message.type === "cancel") { cancelled.add(message.id); return; }
  const { id, type, query, data } = message;
  try {
    const options = { shouldCancel: () => cancelled.has(id), yieldFn };
    const result = type === "echo" ? await runEcho(query, data, options) : await runHunter(query, data, options);
    self.postMessage({ id, type, result });
  } catch (error) {
    self.postMessage({ id, type, error: String(error?.message ?? error) });
  } finally {
    cancelled.delete(id);
  }
};
