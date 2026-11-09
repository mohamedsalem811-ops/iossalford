/** Tests only: a fresh in-memory database for one system, with a clock the test can move. */
import { migrate } from '@/db/migrate';
import { openMemoryDb } from '@/db/testing/node-db';
import type { SystemId } from '@/theme';

import type { Ctx } from '../context';

export type TestCtx = Ctx & { setNow: (d: Date) => void; close: () => void };

export function makeCtx(
  system: SystemId = 'jewelry',
  start = new Date(2026, 10, 9, 10, 0, 0),
): TestCtx {
  const db = openMemoryDb();
  migrate(db);
  let current = start;
  return {
    db,
    system,
    now: () => current,
    setNow: (d) => {
      current = d;
    },
    close: () => db.close(),
  };
}
