import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { saveUpgradeCopy } from '@/backup/store';
import { openSystemDb, type OpenResult } from '@/db/manager';
import type { Ctx } from '@/domain/context';
import type { SystemId } from '@/theme';

/** Each system's database is opened once per app run and kept open. Errors are not kept. */
const opened = new Map<SystemId, OpenResult>();

function open(system: SystemId): OpenResult {
  const cached = opened.get(system);
  if (cached) return cached;
  // Before an app update upgrades the database, a copy of the data as it was is saved.
  const result = openSystemDb(system, undefined, (db) => saveUpgradeCopy(system, db));
  // Only an open database is kept; after an error the next visit (or Retry) tries again.
  if (result.status === 'ok') opened.set(system, result);
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
  const value = useMemo<Ctx>(() => ({ db, system, now: () => new Date() }), [db, system]);
  return <CtxContext.Provider value={value}>{children}</CtxContext.Provider>;
}

/** The open system's database, system and clock, for the business rules. */
export function useCtx(): Ctx {
  const v = useContext(CtxContext);
  if (!v) throw new Error('useCtx outside an open system');
  return v;
}
