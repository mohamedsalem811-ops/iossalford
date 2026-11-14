/**
 * @jest-environment node
 *
 * Database 11 (phase H1): the birthday discount kept apart on the sale and its receipt, and when
 * a customer's birthday was saved. The owner's devices run database 10 (the .ipa of the #33
 * merge); database 9 is checked too.
 */
import { migrate, schemaVersion } from './migrate';
import { LATEST_VERSION, migrations } from './schema';
import { openMemoryDb } from './testing/node-db';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);

describe.each([9, 10])('the upgrade from database %i', (from) => {
  it('keeps every row and adds the new columns empty', () => {
    const db = openMemoryDb();
    migrate(db, upTo(from));
    expect(schemaVersion(db)).toBe(from);
    db.run(
      "INSERT INTO customers (name, name_key, phone, phone_key, created_at) VALUES ('هدى', 'هدى', '0912222222', '912222222', '2026-11-01')",
    );
    if (from === 10)
      db.run("UPDATE customers SET birth_month = 11, birth_day = 14 WHERE name = 'هدى'");
    db.run(
      `INSERT INTO sales (created_at, month, payment_method, customer_id, rate, total, total_cost, seller, seller_name)
       VALUES ('2026-11-02T10:00:00', '2026-11', 'cash', 1, 7000, 1000000, 500000, 'owner', 'المالك')`,
    );
    const customers = db.all('SELECT * FROM customers');
    const sales = db.all('SELECT * FROM sales');
    migrate(db, migrations);
    expect(schemaVersion(db)).toBe(LATEST_VERSION);
    expect(LATEST_VERSION).toBe(11);
    // A birthday saved before database 11 is trusted (no date: no owner's approval needed).
    // From database 9, database 10's columns come too: every old value is kept as it was.
    expect(db.all('SELECT * FROM customers')).toMatchObject(
      customers.map((c) => ({ ...(c as object), birthday_set_at: null })),
    );
    expect(db.all('SELECT * FROM sales')).toMatchObject(
      sales.map((s) => ({ ...(s as object), birthday_off: 0 })),
    );
    const receipts = db.all<{ name: string }>('PRAGMA table_info(receipts)').map((c) => c.name);
    expect(receipts).toContain('birthday_off');
  });

  it('refuses a negative birthday discount', () => {
    const db = openMemoryDb();
    migrate(db, migrations);
    expect(() =>
      db.run(
        `INSERT INTO sales (created_at, month, payment_method, rate, total, total_cost, seller, seller_name, birthday_off)
         VALUES ('2026-11-02T10:00:00', '2026-11', 'cash', 7000, 1000, 500, 'owner', 'المالك', -1)`,
      ),
    ).toThrow();
  });
});
