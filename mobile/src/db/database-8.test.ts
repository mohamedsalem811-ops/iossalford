/**
 * @jest-environment node
 *
 * Database 8 (review after the audit): a return keeps its sale (the database refuses deleting a
 * sale that has returns, as the app already did), and customers are found by name with an index.
 */
import { restoreBackup, exportBackup } from '@/domain/backup';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import {
  customerSuggestions,
  ensureCustomer,
  listCustomers,
  saveCustomer,
} from '@/domain/customers';
import { getPolicies } from '@/domain/policies';
import { getProduct, saveProduct } from '@/domain/products';
import { addReturn, deleteReturn, getSale } from '@/domain/sales';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';

import { migrate, schemaVersion } from './migrate';
import { migrations } from './schema';
import { openMemoryDb } from './testing/node-db';

const answers = (ctx: TestCtx) =>
  Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true]));

function sellAndReturn(ctx: TestCtx, name: string) {
  const id = saveProduct(ctx, { name, category: 'خواتم', price: 1_000, stock: 5 });
  const cart = (addToCart([], getProduct(ctx, id)!, name, 1) as { cart: CartLine[] }).cart;
  const sale = checkout(ctx, { cart, paymentMethod: 'cash' }).saleId;
  const ret = addReturn(ctx, {
    photo: 'p.jpg',
    answers: answers(ctx),
    saleLineId: getSale(ctx, sale)!.lines[0].id,
    quantity: 1,
  });
  return { sale, ret };
}

describe('the upgrade from database 7', () => {
  it('keeps every return and its links, never gives an id twice, and fills the name keys', () => {
    const ctx = makeCtx();
    // Database 7: the app as installed before this change.
    const db = openMemoryDb();
    migrate(db, migrations.slice(0, 7));
    const old = { ...ctx, db } as TestCtx;
    expect(schemaVersion(db)).toBe(7);
    // This test writes through today's code, which also fills database 9's and 10's columns: they
    // are added here (database 8 doesn't touch these tables; database-9/10.test cover them).
    db.exec(`ALTER TABLE products ADD COLUMN specs TEXT;
      ALTER TABLE receipt_items ADD COLUMN specs TEXT;
      ALTER TABLE receipts ADD COLUMN show_specs INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE receipts ADD COLUMN points_paid INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sales ADD COLUMN points_paid INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE sales ADD COLUMN reward_off INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE receipts ADD COLUMN reward_off INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE receipts ADD COLUMN footer TEXT;
      CREATE TABLE loyalty_moves (id INTEGER PRIMARY KEY, customer_id INTEGER, kind TEXT, points INTEGER,
        sale_id INTEGER, return_id INTEGER, payment_id INTEGER, value INTEGER, note TEXT,
        created_at TEXT, month TEXT, by TEXT, by_name TEXT);`);
    // Written as the app did before database 8 (no name key).
    db.run(
      "INSERT INTO customers (name, phone, phone_key, created_at) VALUES ('  هدى   علي ', '0912222222', '912222222', '2026-11-01T10:00:00')",
    );
    const kept = sellAndReturn(old, 'Ring');
    const gone = sellAndReturn(old, 'Chain');
    deleteReturn(old, gone.ret); // the newest return id (2) was used, then deleted
    const before = db.all('SELECT * FROM returns ORDER BY id');

    migrate(db, migrations.slice(0, 8));
    expect(schemaVersion(db)).toBe(8);
    expect(db.all('SELECT * FROM returns ORDER BY id')).toEqual(before);
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
    // The database itself now refuses deleting a sale that has returns.
    expect(() => db.run('DELETE FROM sales WHERE id = ?', [kept.sale])).toThrow(/FOREIGN KEY/);
    // Return 2 was given before: the next return is 3, with its unique id filled in.
    const next = sellAndReturn(old, 'Pin');
    expect(next.ret).toBe(3);
    expect(db.get<{ uid: string }>('SELECT uid FROM returns WHERE id = 3')?.uid).toMatch(
      /^[0-9a-f]{32}$/,
    );
    // Existing customers got their name key.
    expect(db.all('SELECT name_key FROM customers')).toEqual([{ name_key: 'هدى علي' }]);
    db.close();
    ctx.close();
  });
});

describe('finding a customer by name', () => {
  let ctx: TestCtx;
  beforeEach(() => {
    ctx = makeCtx();
  });
  afterEach(() => ctx.close());

  it('uses the index, and still matches spaces and digits as before', () => {
    const plan = ctx.db
      .all<{ detail: string }>(
        `EXPLAIN QUERY PLAN SELECT * FROM customers WHERE name_key = ? AND (phone IS NULL OR ? IS NULL)
         ORDER BY id DESC LIMIT 1`,
        ['x', null],
      )
      .map((r) => r.detail)
      .join(' ');
    expect(plan).toMatch(/customers_name_key/);

    const first = ensureCustomer(ctx, 'سارة  محمد')!;
    // The same name typed differently is the same customer; a later phone is added to her.
    expect(ensureCustomer(ctx, ' سارة محمد ', '0913333333')).toBe(first);
    // A different phone is a different person with the same name.
    expect(ensureCustomer(ctx, 'سارة محمد', '0914444444')).not.toBe(first);
    expect(listCustomers(ctx)).toHaveLength(2);
    // Renaming keeps the key up to date.
    saveCustomer(ctx, { id: first, name: 'سارة أحمد', phone: '0913333333' });
    expect(ensureCustomer(ctx, 'سارة أحمد')).toBe(first);
    expect(customerSuggestions(ctx, 'سارة أ').map((c) => c.id)).toEqual([first]);
    // Suggestions by phone digits still work.
    expect(customerSuggestions(ctx, '0914').map((c) => c.name)).toEqual(['سارة محمد']);
  });

  it('gets its name keys back after restoring a backup made before database 8', () => {
    saveCustomer(ctx, { name: 'منى', phone: '0915555555' });
    const backup = exportBackup(ctx);
    // As an older app made it: no name_key column.
    for (const row of backup.tables.customers) delete row.name_key;
    const { checksumOf } = jest.requireActual<typeof import('@/domain/backup')>('@/domain/backup');
    backup.checksum = checksumOf(
      JSON.stringify({
        system: backup.system,
        schema: backup.schema,
        sequences: backup.sequences,
        tables: backup.tables,
      }),
    );
    restoreBackup(ctx, backup);
    expect(ensureCustomer(ctx, 'منى')).toBe(listCustomers(ctx)[0].id);
    expect(ctx.db.all('SELECT name_key FROM customers WHERE name_key IS NULL')).toEqual([]);
  });
});
