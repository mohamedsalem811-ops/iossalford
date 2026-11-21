/**
 * Typing counts as activity for the employee idle lock (audit 14): a hardware keyboard (an iPad's
 * Magic Keyboard) types without touching the screen, so the app's fields and search bars report
 * each change here, and the idle lock listens.
 */
const listeners = new Set<() => void>();

/** Something was typed. */
export function noteTyping() {
  for (const l of listeners) l();
}

/** Calls `listener` on each change typed; returns the way to stop. */
export function onTyping(listener: () => void): () => void {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** The same handler, reporting the change first. */
export const typed =
  <A extends unknown[]>(handler: (...args: A) => void) =>
  (...args: A) => {
    noteTyping();
    handler(...args);
  };
