import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import type { SystemId } from '@/theme';

type LockState = {
  /** The one system that is open, or null when everything is locked. */
  unlocked: SystemId | null;
  unlock: (system: SystemId) => void;
  lock: () => void;
  /** False while the app is in the app switcher or a system prompt (Face ID) is showing. */
  active: boolean;
};

const LockContext = createContext<LockState | null>(null);

/** Leaving the app locks it: the next open needs the PIN (or Face ID) again. */
export function shouldLock(next: AppStateStatus) {
  return next === 'background';
}

/** The screen is visible unless iOS says the app is inactive or in the background. */
export function isShown(state: string | null | undefined) {
  return state !== 'inactive' && state !== 'background';
}

export function LockProvider({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<SystemId | null>(null);
  // Starts shown: iOS can report the launch-time state as "inactive" before the app becomes
  // active, and no change event follows, which left the cover up. Hiding is only needed when
  // the app leaves the screen, and iOS always reports that.
  const [active, setActive] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setActive(isShown(next));
      // 'inactive' (app switcher, Face ID prompt) only hides the screen; 'background' locks.
      if (shouldLock(next)) setUnlocked(null);
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback((system: SystemId) => setUnlocked(system), []);
  const lock = useCallback(() => setUnlocked(null), []);
  const value = useMemo(
    () => ({ unlocked, unlock, lock, active }),
    [unlocked, unlock, lock, active],
  );
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): LockState {
  const v = useContext(LockContext);
  if (!v) throw new Error('useLock outside LockProvider');
  return v;
}
