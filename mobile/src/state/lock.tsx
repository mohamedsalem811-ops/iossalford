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

import { OWNER, type Actor } from '@/staff/model';
import type { SystemId } from '@/theme';

import { setActor } from './session';

type LockState = {
  /** The one system that is open, or null when everything is locked. */
  unlocked: SystemId | null;
  /** Who opened it: the owner or an employee (null while locked). */
  actor: Actor | null;
  unlock: (system: SystemId, actor?: Actor) => void;
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
  const [session, setSession] = useState<{ system: SystemId; actor: Actor } | null>(null);
  const unlocked = session?.system ?? null;
  const actor = session?.actor ?? null;
  // Starts shown: iOS can report the launch-time state as "inactive" before the app becomes
  // active, and no change event follows, which left the cover up. Hiding is only needed when
  // the app leaves the screen, and iOS always reports that.
  const [active, setActive] = useState(true);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setActive(isShown(next));
      // 'inactive' (app switcher, Face ID prompt) only hides the screen; 'background' locks.
      if (shouldLock(next)) {
        setActor(null);
        setSession(null);
      }
    });
    return () => sub.remove();
  }, []);

  const unlock = useCallback((system: SystemId, who: Actor = OWNER) => {
    setActor(who);
    setSession({ system, actor: who });
  }, []);
  const lock = useCallback(() => {
    setActor(null);
    setSession(null);
  }, []);
  const value = useMemo(
    () => ({ unlocked, actor, unlock, lock, active }),
    [unlocked, actor, unlock, lock, active],
  );
  return <LockContext.Provider value={value}>{children}</LockContext.Provider>;
}

export function useLock(): LockState {
  const v = useContext(LockContext);
  if (!v) throw new Error('useLock outside LockProvider');
  return v;
}
