/**
 * @jest-environment node
 *
 * Database 15 (J3): repairs and their payments, and the closing's repair columns. Nothing that
 * was there changes: a customer's balance, an old closing (no repairs: 0) and every link. The
 * upgrade is checked from database 12 and 14, and a backup from database 1 is restored.
 */
import { writeSnapshot, restoreSnapshot } from '@/backup/engine';
import { listClosings } from '@/domain/closing';
import type { Ctx } from '@/domain/context';
import { balance } from '@/domain/debts';
import { getRepair, moveRepair, deliverRepair, takeRepair } from '@/domain/repairs';
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

/** A customer owing 200 on a credit sale, and a closed quarter. */
function fill(db: Db) {
  db.run(
    "INSERT INTO customers (name, phone, phone_key, created_at) VALUES ('هدى', '0912222222', '912222222', '2026-11-01')",
  );
  db.run(
    `INSERT INTO sales (id, created_at, month, payment_method, customer_id, rate, total, total_cost)
     VALUES (1, '2026-11-02T10:00:00', '2026-11', 'credit', 1, 7000, 200000, 100000)`,
  );
  db.run(
    `INSERT INTO closings (period_key, title, total_sales, total_cost, total_expenses, total_refunds,
       net_profit, transactions, items_sold, closed_at)
     VALUES ('2026-Q3', 'الربع الثالث 2026', 500000, 200000, 0, 0, 300000, 3, 3, '2026-10-01T09:00:00')`,
  );
}

/** A repair delivered on credit, on today's schema. */
function repairOnCredit(db: Db) {
  const ctx = ctxOf(db);
  const { repairId } = takeRepair(ctx, {
    customer: { name: 'هدى', phone: '0912222222' },
    description: 'خاتم',
    work: 'polish',
    price: 30_000,
    readyBy: '2026-11-20',
    photos: ['jewelry-r.jpg'],
  });
  moveRepair(ctx, repairId, 'ready');
  deliverRepair(ctx, repairId, { method: 'credit' });
  return repairId;
}

describe.each([12, 14])('the upgrade from database %i', (from) => {
  it('adds repairs and keeps every figure', () => {
    const db = openMemoryDb();
    migrate(db, upTo(from));
    fill(db);
    migrate(db, migrations);
    expect(balance(ctxOf(db), 1)).toBe(200_000);
    expect(listClosings(ctxOf(db))[0]).toMatchObject({
      netProfit: 300_000,
      repairIncome: 0,
      repairCost: 0,
    });
    const id = repairOnCredit(db);
    expect(getRepair(ctxOf(db), id)).toMatchObject({ ticketNo: 'R-2026-0001', customerId: 1 });
    expect(balance(ctxOf(db), 1)).toBe(230_000);
    expect(db.get<{ uid: string | null }>('SELECT uid FROM repairs')!.uid).toMatch(
      /^[0-9a-f]{32}$/,
    );
    expect(db.get<{ uid: string | null }>('SELECT uid FROM repair_payments')!.uid).toMatch(
      /^[0-9a-f]{32}$/,
    );
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
  });
});

it('refuses a stage, a work or a payment method it does not know', () => {
  const db = openMemoryDb();
  migrate(db, migrations);
  fill(db);
  const id = repairOnCredit(db);
  expect(() => db.run("UPDATE repairs SET status = 'lost' WHERE id = ?", [id])).toThrow();
  expect(() => db.run("UPDATE repairs SET work = 'paint' WHERE id = ?", [id])).toThrow();
  expect(() => db.run("UPDATE repair_payments SET method = 'gold'")).toThrow();
  // Her repairs keep her from being removed.
  expect(() => db.run('DELETE FROM customers WHERE id = 1')).toThrow();
});

it('restores a backup from database 1, with no repairs and the figures kept', () => {
  const dir = tempDir();
  try {
    const old = openFileDb(dir.at('old-live.db'));
    migrate(old, upTo(1));
    fill(old);
    writeSnapshot(old, openFileDb, dir.at('old.db'), { system: 'jewelry', madeAt: 'x' });
    old.close();
    const live = openFileDb(dir.at('jewelry.db'));
    migrate(live, migrations);
    repairOnCredit(live);
    restoreSnapshot(live, openFileDb, dir.at('old.db'));
    expect(live.get<{ n: number }>('SELECT count(*) n FROM repairs')!.n).toBe(0);
    expect(balance(ctxOf(live), 1)).toBe(200_000);
    expect(listClosings(ctxOf(live))[0].repairIncome).toBe(0);
    // The ticket numbers go on after the highest ever used: a printed ticket never repeats.
    const again = repairOnCredit(live);
    expect(getRepair(ctxOf(live), again)!.ticketNo).toBe('R-2026-0002');
    live.close();
  } finally {
    dir.remove();
  }
});
