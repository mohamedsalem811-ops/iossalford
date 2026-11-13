/** Tests only: a fresh in-memory database for one system, with a clock the test can move. */
import { migrate } from '@/db/migrate';
import { openMemoryDb } from '@/db/testing/node-db';
import { OWNER, type Actor } from '@/staff/model';
import type { SystemId } from '@/theme';

import type { Ctx } from '../context';
import { getPolicies } from '../policies';

export type TestCtx = Ctx & {
  setNow: (d: Date) => void;
  /** Who does the next actions (the owner unless changed). */
  setActor: (a: Actor | null) => void;
  close: () => void;
};

export const EMPLOYEE: Actor = { kind: 'employee', id: 'e1', name: 'سارة' };

export function makeCtx(
  system: SystemId = 'jewelry',
  start = new Date(2026, 10, 9, 10, 0, 0),
): TestCtx {
  const db = openMemoryDb();
  migrate(db);
  let current = start;
  let actor: Actor | null = OWNER;
  return {
    db,
    system,
    now: () => current,
    get actor() {
      return actor;
    },
    setNow: (d) => {
      current = d;
    },
    setActor: (a) => {
      actor = a;
    },
    close: () => db.close(),
  };
}

/** A return that passes the rules: a photo, and every condition answered "yes". */
export function passing(ctx: Ctx) {
  return {
    photo: 'piece.jpg',
    answers: Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true])),
  };
}
