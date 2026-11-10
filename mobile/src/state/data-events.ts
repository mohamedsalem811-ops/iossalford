import { useEffect } from 'react';

/**
 * "The shop's data changed": called after every save, delete or stock change, so each open
 * screen showing that data reads it again. Coming back into view also re-reads (see the
 * routes); this covers screens that stay on screen, like the iPad's list next to its form.
 */
const listeners = new Set<() => void>();

export function notifyDataChanged() {
  listeners.forEach((listener) => listener());
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
