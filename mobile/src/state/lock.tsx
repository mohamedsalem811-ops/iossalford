import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { AppState, Linking, type AppStateStatus } from 'react-native';

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

/** How long SALFORD stays open after it opened WhatsApp (or a call) itself (audit 6: 1 minute). */
export const OUTSIDE_GRACE_MS = 60 * 1000;
/** The app must leave this soon after SALFORD opened the other app, or the grace is not given. */
export const LEAVE_WITHIN_MS = 5 * 1000;
/** When the app must have left by, for the grace; 0 when none is waiting. */
let leaveBy = 0;
let graceUntil = 0;

/**
 * Opens WhatsApp (or another app) from SALFORD: coming back within a minute finds the same
 * screen, so the step-by-step sender keeps its place. Only the leaving that opening causes gets
 * the grace, once: leaving any other way, or later, locks as before.
 */
export function openOutside(url: string) {
  leaveBy = Date.now() + LEAVE_WITHIN_MS;
  return Linking.openURL(url).catch(() => {
    leaveBy = 0;
  });
}

/** Called as the app leaves: true when SALFORD itself sent the person away a moment ago. */
export function takeGrace(now = Date.now()): boolean {
  const ok = now < leaveBy;
  leaveBy = 0;
  graceUntil = ok ? now + OUTSIDE_GRACE_MS : 0;
  return ok;
}

/** True while a person sent to another app by SALFORD may still come back to the same screen. */
export const inGrace = (now = Date.now()) => now < graceUntil;

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
    /** Left for WhatsApp: decided when the app comes back. */
    let away = false;
    const sub = AppState.addEventListener('change', (next) => {
      setActive(isShown(next));
      // 'inactive' (app switcher, Face ID prompt) only hides the screen; 'background' locks,
      // unless SALFORD opened WhatsApp itself and the person comes back within the grace.
      if (shouldLock(next)) {
        if (takeGrace()) {
          away = true;
          return;
        }
        setActor(null);
        setSession(null);
      } else if (next === 'active' && away) {
        away = false;
        if (!inGrace()) {
          setActor(null);
          setSession(null);
        }
        graceUntil = 0;
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
