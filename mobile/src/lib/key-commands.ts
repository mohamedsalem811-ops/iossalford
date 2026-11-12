import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import type { SearchBarCommands } from 'react-native-screens';

import KeyCommands, { type KeyCommand } from '../../modules/key-commands/src/KeyCommandsModule';

/** The iPad keyboard shortcuts (holding ⌘ lists them with these titles). */
export const SHORTCUTS: KeyCommand[] = [
  { id: 'search', input: 'f', title: 'بحث' },
  { id: 'new', input: 'n', title: 'إضافة جديد' },
];

export type ShortcutId = 'search' | 'new';

/** Handlers of the screens that are open, the most recent last: the screen in front wins. */
const handlers: Record<ShortcutId, (() => void)[]> = { search: [], new: [] };

/** Run a shortcut as if pressed (also what the native side calls). */
export function runShortcut(id: string) {
  const list = handlers[id as ShortcutId];
  list?.[list.length - 1]?.();
}

let installed = false;
/** Once, after the first screen is drawn. Expo Go has no native side: no shortcuts there. */
export function installKeyCommands() {
  if (installed || !KeyCommands) return;
  installed = true;
  KeyCommands.setCommands(SHORTCUTS);
  KeyCommands.addListener('onKeyCommand', ({ id }) => runShortcut(id));
}

/** While this screen is in front, the shortcut runs `handler`. */
export function useShortcut(id: ShortcutId, handler: () => void) {
  const latest = useRef(handler);
  useEffect(() => {
    latest.current = handler;
  });
  useFocusEffect(
    useCallback(() => {
      const run = () => latest.current();
      handlers[id].push(run);
      return () => {
        handlers[id] = handlers[id].filter((h) => h !== run);
      };
    }, [id]),
  );
}

/** ⌘F focuses the screen's search bar: pass the returned ref to its Stack.SearchBar. */
export function useSearchShortcut() {
  const ref = useRef<SearchBarCommands | null>(null);
  useShortcut('search', () => ref.current?.focus());
  return ref;
}
