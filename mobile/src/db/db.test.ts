/**
 * @jest-environment node
 */
import { DatabaseTooNewError, migrate, schemaVersion } from './migrate';
import { LATEST_VERSION } from './schema';
import { openMemoryDb } from './testing/node-db';
import type { Db } from './types';

let db: Db;
beforeEach(() => {
  db = openMemoryDb();
});
afterEach(() => db.close());

const now = '2026-11-09T10:00:00';

function addProduct(sku: string, stock = 1) {
  return db.run(
    `INSERT INTO products (sku, name, price, stock, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
    [sku, 'خاتم', 350_000, stock, now, now],
  ).lastInsertRowId;
}

describe('migrations', () => {
  it('creates the latest schema on a new database', () => {
    expect(migrate(db)).toBe(LATEST_VERSION);
    const tables = db
      .all<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
      )
      .map((t) => t.name);
    expect(tables).toEqual([
      'brands',
      'closings',
      'customers',
      'expenses',
      'payments',
      'products',
      'receipt_items',
      'receipts',
      'returns',
      'sale_lines',
      'sales',
      'set_items',
      'sets',
      'settings',
      'stock_moves',
    ]);
  });

  it('does nothing when run again', () => {
    migrate(db);
    addProduct('RNG-0001');
    expect(migrate(db)).toBe(LATEST_VERSION);
    expect(db.get<{ n: number }>('SELECT count(*) n FROM products')?.n).toBe(1);
  });

  it('applies only newer migrations, in order', () => {
    migrate(db);
    const extra = [
      { version: LATEST_VERSION + 1, name: 'test', sql: 'CREATE TABLE extra (id INTEGER);' },
    ];
    const { migrations } = jest.requireActual<typeof import('./schema')>('./schema');
    expect(migrate(db, [...migrations, ...extra])).toBe(LATEST_VERSION + 1);
    expect(db.get(`SELECT name FROM sqlite_master WHERE name = 'extra'`)).toBeTruthy();
  });

  it('leaves the database unchanged when a migration fails', () => {
    migrate(db);
    const { migrations } = jest.requireActual<typeof import('./schema')>('./schema');
    const broken = [
      {
        version: LATEST_VERSION + 1,
        name: 'broken',
        sql: 'CREATE TABLE half (id INTEGER); NOT VALID SQL;',
      },
    ];
    expect(() => migrate(db, [...migrations, ...broken])).toThrow();
    expect(schemaVersion(db)).toBe(LATEST_VERSION);
    expect(db.get(`SELECT name FROM sqlite_master WHERE name = 'half'`)).toBeUndefined();
  });

  it('refuses a database made by a newer app', () => {
    db.exec(`PRAGMA user_version = ${LATEST_VERSION + 5};`);
    expect(() => migrate(db)).toThrow(DatabaseTooNewError);
  });
});

describe('integrity rules', () => {
  beforeEach(() => migrate(db));

  it('never reuses an id after a delete', () => {
    const first = addProduct('RNG-0001');
    const second = addProduct('RNG-0002');
    db.run('DELETE FROM products WHERE id = ?', [second]);
    const third = addProduct('RNG-0003');
    expect(third).toBeGreaterThan(second);
    expect(first).toBe(1);
  });

  it('keeps SKUs unique regardless of case', () => {
    addProduct('RNG-0001');
    expect(() => addProduct('rng-0001')).toThrow();
  });

  it('refuses negative stock and prices', () => {
    const id = addProduct('RNG-0001', 1);
    expect(() => db.run('UPDATE products SET stock = -1 WHERE id = ?', [id])).toThrow();
    expect(() => db.run('UPDATE products SET price = -5 WHERE id = ?', [id])).toThrow();
  });

  it('enforces foreign keys', () => {
    expect(() =>
      db.run(
        `INSERT INTO payments (customer_id, amount, method, created_at, month) VALUES (99, 1000, 'cash', ?, '2026-11')`,
        [now],
      ),
    ).toThrow();
  });

  it('rolls a transaction back completely when it fails', () => {
    expect(() =>
      db.transaction(() => {
        addProduct('RNG-0001');
        addProduct('RNG-0001'); // duplicate: fails
      }),
    ).toThrow();
    expect(db.get<{ n: number }>('SELECT count(*) n FROM products')?.n).toBe(0);
  });

  it('joins nested transactions to the outer one', () => {
    expect(() =>
      db.transaction(() => {
        db.transaction(() => addProduct('RNG-0001'));
        throw new Error('later step failed');
      }),
    ).toThrow('later step failed');
    expect(db.get<{ n: number }>('SELECT count(*) n FROM products')?.n).toBe(0);
    db.transaction(() => db.transaction(() => addProduct('RNG-0002')));
    expect(db.get<{ n: number }>('SELECT count(*) n FROM products')?.n).toBe(1);
  });

  it('returns the transaction result', () => {
    expect(db.transaction(() => addProduct('RNG-0001'))).toBe(1);
  });

  it('only accepts the four payment methods', () => {
    expect(() =>
      db.run(
        `INSERT INTO sales (created_at, month, payment_method, rate, total, total_cost) VALUES (?, '2026-11', 'bitcoin', 7125, 0, 0)`,
        [now],
      ),
    ).toThrow();
  });
});
