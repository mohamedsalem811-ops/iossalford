import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { saveUpgradeCopy } from '@/backup/store';
import { openSystemDb, type OpenResult } from '@/db/manager';
import type { Ctx } from '@/domain/context';
import type { SystemId } from '@/theme';
import { withChangeSignal } from '@/db/change-signal';
import { scheduleDataChanged } from '@/state/data-events';
import { getActor } from '@/state/session';
import type { Actor } from '@/staff/model';
import { getStaff } from '@/staff/store';
import { clockGuard, stampDevice } from '@/staff/guards';
import { recordClockBack } from '@/domain/activity';
import { logError } from '@/lib/error-log';

/** Each system's database is opened once per app run and kept open. Errors are not kept. */
const opened = new Map<SystemId, OpenResult>();

function open(system: SystemId): OpenResult {
  const cached = opened.get(system);
  if (cached) return cached;
  // Before an app update upgrades the database, a copy of the data as it was is saved.
  const result = openSystemDb(system, undefined, (db) => saveUpgradeCopy(system, db));
  // Only an open database is kept; after an error the next visit (or Retry) tries again.
  if (result.status === 'ok') {
    // New records carry this device's id (for syncing the two devices later).
    // Never stops the system from opening (records then carry no device id).
    try {
      stampDevice(result.db);
    } catch (error) {
      logError('رقم الجهاز', error);
    }
    opened.set(system, result);
  }
  return result;
}

/**
 * Opens (or reuses) the system's database; `retry` tries again after an error. The caller keys
 * its screen by system, so switching systems starts a fresh hook.
 */
export function useSystemDb(system: SystemId) {
  const [result, setResult] = useState<OpenResult>(() => open(system));
  const retry = useCallback(() => setResult(open(system)), [system]);
  return { result, retry };
}

/** The person signed in, or null when nobody is or the employee has been suspended (fail closed). */
function signedIn(): Actor | null {
  const actor = getActor();
  if (actor?.kind !== 'employee') return actor;
  const e = getStaff().employees.find((x) => x.id === actor.id);
  return e?.active ? actor : null;
}

const CtxContext = createContext<Ctx | null>(null);

export function CtxProvider({
  db,
  system,
  children,
}: {
  db: Ctx['db'];
  system: SystemId;
  children: ReactNode;
}) {
  // Every change to the data refreshes the open screens (see data-events).
  const value = useMemo<Ctx>(() => {
    const ctx: Ctx = {
      db: withChangeSignal(db, scheduleDataChanged),
      system,
      now: () => new Date(),
      // Read when each action runs: after a lock or a switch of person, an action still open on
      // the screen is done as whoever is signed in now (nobody: refused).
      get actor() {
        return signedIn();
      },
      // Every action that changes data is refused while the device clock is behind.
      clock: {
        check: (now) => {
          clockGuard.onBack = (latest, at) => {
            try {
              recordClockBack(ctx, latest, at);
            } catch (error) {
              logError('سجل النشاط: الساعة', error);
            }
          };
          return clockGuard.check(now);
        },
      },
    };
    return ctx;
  }, [db, system]);
  return <CtxContext.Provider value={value}>{children}</CtxContext.Provider>;
}

/** The open system's database, system and clock, for the business rules. */
export function useCtx(): Ctx {
  const v = useContext(CtxContext);
  if (!v) throw new Error('useCtx outside an open system');
  return v;
}
