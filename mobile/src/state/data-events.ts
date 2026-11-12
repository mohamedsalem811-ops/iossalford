import { useEffect } from 'react';

/**
 * "The shop's data changed": sent after every save, delete or stock change, so each open
 * screen showing that data reads it again. Coming back into view also re-reads (see the
 * routes); this covers screens that stay on screen, like the iPad's list next to its form.
 */
const listeners = new Set<() => void>();

/** Right after a save: every open screen reads its data again, at once. */
export function notifyDataChanged() {
  listeners.forEach((listener) => listener());
}

let scheduled = false;
/**
 * The safety net: the open system's database calls this after every change (db/change-signal),
 * so a save that forgets `notifyDataChanged` still refreshes the screens. It waits until the
 * current tap has finished (all its writes done), and several changes refresh once.
 */
export function scheduleDataChanged() {
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    notifyDataChanged();
  });
}

/** Calls `onChange` whenever data changes, while the screen is mounted. */
export function useOnDataChanged(onChange: () => void) {
  useEffect(() => {
    listeners.add(onChange);
    return () => {
      listeners.delete(onChange);
    };
  }, [onChange]);
}
