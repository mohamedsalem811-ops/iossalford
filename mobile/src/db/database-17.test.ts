/**
 * @jest-environment node
 *
 * Database 17 (phase L): the bonus on slow pieces. A piece carries the owner's bonus, a sale line
 * keeps the bonus it earned, and the employee's account takes bonus lines (the bonus of a month,
 * its return when returns were more, and what the owner paid out). Nothing that was there changes.
 */
import { migrate } from './migrate';
import { migrations } from './schema';
import { openMemoryDb } from './testing/node-db';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);

describe('database 17', () => {
  it('keeps every account line and its id counter, and takes the bonus lines', () => {
    const db = openMemoryDb();
    migrate(db, upTo(16));
    for (const [kind, amount] of [
      ['charge', 5_000],
      ['repay', 2_000],
    ] as const)
      db.run(
        `INSERT INTO staff_ledger (employee, employee_name, kind, amount, created_at, month)
         VALUES ('emp-a', 'سارة', ?, ?, '2026-11-01T10:00:00', '2026-11')`,
        [kind, amount],
      );
    db.run("DELETE FROM staff_ledger WHERE kind = 'repay'");
    migrate(db, migrations);
    expect(db.all('SELECT id, kind, amount, uid IS NOT NULL AS has_uid FROM staff_ledger')).toEqual(
      [{ id: 1, kind: 'charge', amount: 5_000, has_uid: 1 }],
    );
    const add = (kind: string, month: string | null) =>
      db.run(
        `INSERT INTO staff_ledger (employee, employee_name, kind, amount, created_at, month, bonus_month)
         VALUES ('emp-a', 'سارة', ?, 1000, '2026-12-01T09:00:00', '2026-12', ?)`,
        [kind, month],
      ).lastInsertRowId;
    // Ids are never given twice: the deleted line's id stays used.
    expect(add('bonus', '2026-11')).toBe(3);
    // A month's bonus is added once per person.
    expect(() => add('bonus_back', '2026-11')).toThrow();
    expect(add('payout', null)).toBe(4);
    expect(() => add('gift', null)).toThrow();
    // The uid trigger still stamps new lines.
    expect(db.get('SELECT count(*) n FROM staff_ledger WHERE uid IS NULL')).toEqual({ n: 0 });
  });

  it('gives pieces and sale lines a bonus, none until the owner sets one', () => {
    const db = openMemoryDb();
    migrate(db, migrations);
    db.run(
      `INSERT INTO products (sku, name, category, price, cost, stock, created_at, updated_at)
       VALUES ('RNG-1', 'خاتم', 'خواتم', 1000, 500, 1, '2026-11-01', '2026-11-01')`,
    );
    expect(db.get('SELECT bonus FROM products')).toEqual({ bonus: null });
    expect(() => db.run('UPDATE products SET bonus = 0')).toThrow();
    const cols = db.all<{ name: string; dflt_value: string | null }>(
      'PRAGMA table_info(sale_lines)',
    );
    expect(cols.find((c) => c.name === 'bonus')).toMatchObject({ dflt_value: '0' });
  });
});
