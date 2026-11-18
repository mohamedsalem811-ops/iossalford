/**
 * @jest-environment node
 *
 * Database 14 (J2): how a refund was paid back. Returns made before it are marked as the app
 * treated them: off the debt for a sale on credit, out of the drawer for the rest, so no past
 * figure changes. The owner's devices run database 4; database 13 and a backup from database 1
 * are checked too.
 */
import { writeSnapshot, restoreSnapshot } from '@/backup/engine';
import { balance } from '@/domain/debts';
import type { Ctx } from '@/domain/context';
import { getReturn } from '@/domain/sales';
import { OWNER } from '@/staff/model';

import { migrate } from './migrate';
import { migrations } from './schema';
import { openFileDb, openMemoryDb } from './testing/node-db';
import { tempDir } from './testing/temp-files';
import type { Db } from './types';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);
const ctxOf = (db: Db): Ctx => ({
  db,
  system: 'jewelry',
  now: () => new Date(2026, 10, 17, 12),
  actor: OWNER,
});

/** A customer with a credit sale and a cash sale, one piece of each returned. */
function fill(db: Db) {
  db.run(
    "INSERT INTO customers (name, phone, created_at) VALUES ('هدى', '0912222222', '2026-11-01')",
  );
  for (const [id, method] of [
    [1, 'credit'],
    [2, 'cash'],
  ] as const) {
    db.run(
      `INSERT INTO sales (id, created_at, month, payment_method, customer_id, rate, total, total_cost)
       VALUES (?, '2026-11-02T10:00:00', '2026-11', ?, 1, 7000, 200000, 100000)`,
      [id, method],
    );
    db.run(
      `INSERT INTO sale_lines (id, sale_id, product_id, name, sku, quantity, unit_cost, list_price, unit_price, line_total, line_cost)
       VALUES (?, ?, 1, 'خاتم', 'R-1', 2, 50000, 100000, 100000, 200000, 100000)`,
      [id, id],
    );
    db.run(
      `INSERT INTO returns (id, sale_line_id, product_id, name, quantity, refund, cost, created_at, month)
       VALUES (?, ?, 1, 'خاتم', 1, 100000, 50000, '2026-11-03T10:00:00', '2026-11')`,
      [id, id],
    );
  }
}

describe.each([4, 13])('the upgrade from database %i', (from) => {
  it('marks the old returns as the app treated them, and keeps every figure', () => {
    const db = openMemoryDb();
    migrate(db, upTo(from));
    fill(db);
    const rows = db.all('SELECT * FROM returns ORDER BY id');
    migrate(db, migrations);
    expect(db.all('SELECT * FROM returns ORDER BY id')).toMatchObject(rows as object[]);
    expect(getReturn(ctxOf(db), 1)!.refundMethod).toBe('debt');
    expect(getReturn(ctxOf(db), 2)!.refundMethod).toBe('cash');
    // As before: the 200 on credit less its 100 return; the cash refund left the drawer.
    expect(balance(ctxOf(db), 1)).toBe(100_000);
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
  });
});

it('refuses a refund method it does not know', () => {
  const db = openMemoryDb();
  migrate(db, migrations);
  fill(db);
  expect(() => db.run("UPDATE returns SET refund_method = 'gold' WHERE id = 1")).toThrow();
});

it('restores a backup from database 1 with its returns marked', () => {
  const dir = tempDir();
  try {
    const old = openFileDb(dir.at('old-live.db'));
    migrate(old, upTo(1));
    fill(old);
    writeSnapshot(old, openFileDb, dir.at('old.db'), { system: 'jewelry', madeAt: 'x' });
    old.close();
    const live = openFileDb(dir.at('jewelry.db'));
    migrate(live, migrations);
    restoreSnapshot(live, openFileDb, dir.at('old.db'));
    expect(getReturn(ctxOf(live), 1)!.refundMethod).toBe('debt');
    expect(getReturn(ctxOf(live), 2)!.refundMethod).toBe('cash');
    expect(balance(ctxOf(live), 1)).toBe(100_000);
    live.close();
  } finally {
    dir.remove();
  }
});
