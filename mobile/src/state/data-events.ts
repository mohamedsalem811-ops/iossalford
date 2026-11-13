import { useContext, useEffect } from 'react';
// The navigation of the screen a hook is in. expo-router keeps React Navigation inside its own
// package and does not export this context; if an upgrade moves it, the type check fails here.
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';

/**
 * "The shop's data changed": sent after every save, delete or stock change, so each open
 * screen showing that data reads it again. Coming back into view also re-reads (see the
 * routes); this covers screens that stay on screen, like the iPad's list next to its form.
 *
 * One save refreshes once (audit F-3): the screen's own call covers the database's signal for
 * the same save (db/change-signal), and a screen out of view waits until it comes back instead
 * of reading at once.
 */
const listeners = new Set<() => void>();

let scheduled = false;
/** The screen already refreshed for the changes the pending signal is about. */
let covered = false;

const send = () => listeners.forEach((listener) => listener());

/** Right after a save: every open screen reads its data again, at once. */
export function notifyDataChanged() {
  // The database's signal for this same save is still pending: this refresh covers it.
  if (scheduled) covered = true;
  send();
}

/**
 * The safety net: the open system's database calls this after every change, so a save that
 * forgets `notifyDataChanged` still refreshes the screens. It waits until the current tap has
 * finished (all its writes done); several changes refresh once, and none at all when the screen
 * already called `notifyDataChanged` after them.
 */
export function scheduleDataChanged() {
  // A change after the screen's own refresh needs one more.
  covered = false;
  if (scheduled) return;
  scheduled = true;
  queueMicrotask(() => {
    scheduled = false;
    if (covered) {
      covered = false;
      return;
    }
    send();
  });
}

/**
 * Calls `onChange` whenever data changes, while the screen is mounted. A screen that is not in
 * view (another tab, under a pushed screen) is only marked out of date and reads again when it
 * comes back into view. Outside a screen (tests), it always reads.
 */
export function useOnDataChanged(onChange: () => void) {
  const navigation = useContext(NavigationContext);
  useEffect(() => {
    let stale = false;
    const listener = () => {
      if (navigation && !navigation.isFocused()) stale = true;
      else onChange();
    };
    listeners.add(listener);
    const unsubscribe = navigation?.addListener('focus', () => {
      if (!stale) return;
      stale = false;
      onChange();
    });
    return () => {
      listeners.delete(listener);
      unsubscribe?.();
    };
  }, [onChange, navigation]);
}
