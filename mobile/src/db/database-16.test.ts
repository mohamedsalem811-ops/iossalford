/**
 * @jest-environment node
 *
 * Database 16 (phase K): names leave the lock screen once (audit 3). The app before it saved
 * «show names» with every reminder setting, so a device that saved any setting kept showing
 * names; the upgrade hides them once, and the owner can show them again.
 */
import type { Ctx } from '@/domain/context';
import { getNotifyRules } from '@/domain/notify';
import { OWNER } from '@/staff/model';

import { migrate } from './migrate';
import { migrations } from './schema';
import { openMemoryDb } from './testing/node-db';
import type { Db } from './types';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);
const ctxOf = (db: Db): Ctx => ({
  db,
  system: 'jewelry',
  now: () => new Date(2026, 10, 21, 12),
  actor: OWNER,
});

describe('database 16', () => {
  it('hides names on the lock screen once, keeping the other reminder settings', () => {
    const db = openMemoryDb();
    migrate(db, upTo(15));
    db.run("INSERT INTO settings (key, value) VALUES ('notify', ?)", [
      JSON.stringify({ hour: 10, minute: 15, hideNames: false, on: { birthdays: false } }),
    ]);
    migrate(db, migrations);
    const rules = getNotifyRules(ctxOf(db));
    expect(rules.hideNames).toBe(true);
    expect(rules.hour).toBe(10);
    expect(rules.minute).toBe(15);
    expect(rules.on.birthdays).toBe(false);
  });

  it('leaves a device with no reminder settings on the default', () => {
    const db = openMemoryDb();
    migrate(db, upTo(15));
    migrate(db, migrations);
    expect(db.get("SELECT value FROM settings WHERE key = 'notify'")).toBeUndefined();
    expect(getNotifyRules(ctxOf(db)).hideNames).toBe(true);
  });
});
