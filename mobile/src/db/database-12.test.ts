/**
 * @jest-environment node
 *
 * Database 12 (phase I1): deposit orders and their payments, the deposit a delivery used, the
 * new discounts kept apart (I4), deposit receipts, who sent a customer, kept deposits in the
 * closing, and the tables for gifts, referrals, offers and messages. The owner's devices run
 * database 11 (the .ipa of the #34 merge); database 10 is checked too.
 */
import { mergeCustomers } from '@/domain/customer-care';
import { makeCtx } from '@/domain/testing/ctx';

import { migrate, schemaVersion } from './migrate';
import { LATEST_VERSION, migrations } from './schema';
import { openMemoryDb } from './testing/node-db';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);
const columns = (db: ReturnType<typeof openMemoryDb>, table: string) =>
  db.all<{ name: string }>(`PRAGMA table_info(${table})`).map((c) => c.name);

describe.each([10, 11])('the upgrade from database %i', (from) => {
  it('keeps every row and adds the new columns empty', () => {
    const db = openMemoryDb();
    migrate(db, upTo(from));
    expect(schemaVersion(db)).toBe(from);
    db.run(
      "INSERT INTO customers (name, name_key, phone, phone_key, created_at) VALUES ('هدى', 'هدى', '0912222222', '912222222', '2026-11-01')",
    );
    db.run(
      `INSERT INTO sales (created_at, month, payment_method, customer_id, rate, total, total_cost, seller, seller_name)
       VALUES ('2026-11-02T10:00:00', '2026-11', 'credit', 1, 7000, 1000000, 500000, 'owner', 'المالك')`,
    );
    db.run(
      `INSERT INTO receipts (receipt_no, date, time, customer, template, sale_id, created_at)
       VALUES ('GR-2026-0001', '02/11/2026', '10:00', 'هدى', 'salford_dark', 1, '2026-11-02T10:00:00')`,
    );
    db.run(
      `INSERT INTO closings (period_key, title, total_sales, total_cost, total_expenses, total_refunds, net_profit,
         transactions, items_sold, closed_at)
       VALUES ('2026-Q3', 'Q3', 1, 1, 0, 0, 0, 1, 1, '2026-10-01T10:00:00')`,
    );
    const before = Object.fromEntries(
      ['customers', 'sales', 'receipts', 'closings'].map((t) => [t, db.all(`SELECT * FROM ${t}`)]),
    );
    migrate(db, migrations);
    expect(schemaVersion(db)).toBe(LATEST_VERSION);
    expect(LATEST_VERSION).toBe(12);
    expect(db.all('SELECT * FROM customers')).toMatchObject(
      before.customers.map((c) => ({ ...(c as object), referred_by: null })),
    );
    expect(db.all('SELECT * FROM sales')).toMatchObject(
      before.sales.map((s) => ({ ...(s as object), deposit_used: 0, friend_off: 0, offer_off: 0 })),
    );
    expect(db.all('SELECT * FROM receipts')).toMatchObject(
      before.receipts.map((r) => ({
        ...(r as object),
        kind: 'sale',
        order_id: null,
        deposit: 0,
        friend_off: 0,
        offer_off: 0,
      })),
    );
    expect(db.all('SELECT * FROM closings')).toMatchObject(
      before.closings.map((c) => ({ ...(c as object), other_income: 0 })),
    );
    for (const t of ['orders', 'order_payments', 'gifts', 'referrals', 'offers', 'message_log'])
      expect(columns(db, t)).toEqual(expect.arrayContaining(['id', 'uid', 'device']));
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
  });
});

describe('database 12', () => {
  const fresh = () => {
    const db = openMemoryDb();
    migrate(db, migrations);
    db.run("INSERT INTO settings (key, value) VALUES ('device_id', 'dev-1')");
    db.run(
      "INSERT INTO customers (name, phone, phone_key, created_at) VALUES ('منى', '0912345678', '912345678', '2026-11-01')",
    );
    return db;
  };
  const order = (status = 'waiting', price = 1000) =>
    `INSERT INTO orders (kind, status, customer_id, description, price, created_at, month)
     VALUES ('order', '${status}', 1, 'سوار', ${price}, '2026-11-09T10:00:00', '2026-11')`;

  it('gives each new record its unique id and the device', () => {
    const db = fresh();
    db.run(order());
    db.run(
      "INSERT INTO order_payments (order_id, kind, amount, method, created_at, month) VALUES (1, 'pay', 500, 'cash', 'x', 'y')",
    );
    for (const t of ['orders', 'order_payments'])
      expect(db.get<{ uid: string; device: string }>(`SELECT uid, device FROM ${t}`)).toMatchObject(
        {
          uid: expect.stringMatching(/^[0-9a-f]{32}$/),
          device: 'dev-1',
        },
      );
  });

  it('refuses what can never be right', () => {
    const db = fresh();
    expect(() => db.run(order('lost'))).toThrow();
    expect(() => db.run(order('waiting', 0))).toThrow();
    db.run(order());
    for (const bad of [
      "(1, 'pay', 0, 'cash', 'x', 'y')",
      "(1, 'gift', 5, 'cash', 'x', 'y')",
      "(1, 'pay', 5, 'credit', 'x', 'y')",
    ])
      expect(() =>
        db.run(
          `INSERT INTO order_payments (order_id, kind, amount, method, created_at, month) VALUES ${bad}`,
        ),
      ).toThrow();
    expect(() =>
      db.run(
        "INSERT INTO receipts (receipt_no, date, time, customer, template, created_at, kind) VALUES ('X', 'd', 't', 'c', 'salford_dark', 'x', 'other')",
      ),
    ).toThrow();
    expect(() =>
      db.run(
        `INSERT INTO sales (created_at, month, payment_method, rate, total, total_cost, deposit_used)
         VALUES ('x', 'y', 'cash', 7000, 1000, 500, -1)`,
      ),
    ).toThrow();
    // A customer with an order can't be deleted by the database either.
    expect(() => db.run('DELETE FROM customers WHERE id = 1')).toThrow(/FOREIGN KEY/);
  });

  it('merges who sent a customer, and the friends she sent', () => {
    const ctx = makeCtx();
    const add = (name: string, phone: string, by: number | null = null) =>
      ctx.db.run(
        'INSERT INTO customers (name, name_key, phone, phone_key, referred_by, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [name, name, phone, phone.slice(1), by, '2026-11-01'],
      ).lastInsertRowId;
    const sender = add('سلوى', '0911111111');
    const keep = add('منى', '0912222222');
    const drop = add('منى', '0913333333', sender);
    const friend = add('ريم', '0914444444', drop);
    ctx.db.run(
      "INSERT INTO referrals (friend_id, referrer_id, created_at) VALUES (?, ?, '2026-11-02'), (?, ?, '2026-11-03')",
      [drop, sender, friend, drop],
    );
    mergeCustomers(ctx, keep, drop);
    const by = (id: number) =>
      ctx.db.get<{ r: number | null }>('SELECT referred_by r FROM customers WHERE id = ?', [id])?.r;
    expect(by(keep)).toBe(sender);
    expect(by(friend)).toBe(keep);
    expect(ctx.db.all('SELECT friend_id, referrer_id FROM referrals ORDER BY id')).toEqual([
      { friend_id: keep, referrer_id: sender },
      { friend_id: friend, referrer_id: keep },
    ]);
    ctx.close();
  });
});
