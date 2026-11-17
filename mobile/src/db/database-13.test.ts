/**
 * @jest-environment node
 *
 * Database 13 (J1, from the full check): an index under every link between tables. Without one,
 * deleting a row makes SQLite read the whole table that points at it: restoring a backup with
 * 10,000 customers took 10 s, because each customer deleted read every customer
 * (`referred_by`). The owner's devices run database 4; database 12 is checked too.
 */
import type { Db } from './types';
import { migrate, schemaVersion } from './migrate';
import { LATEST_VERSION, migrations } from './schema';
import { openMemoryDb } from './testing/node-db';

const upTo = (version: number) => migrations.filter((m) => m.version <= version);

/** Links (table.column → table) with no index that starts with that column. */
function unindexedLinks(db: Db) {
  const tables = db
    .all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'",
    )
    .map((t) => t.name);
  return tables.flatMap((t) => {
    const first = new Set(
      db
        .all<{ name: string }>(`PRAGMA index_list(${t})`)
        .map((i) => db.all<{ name: string }>(`PRAGMA index_info(${i.name})`)[0]?.name),
    );
    return db
      .all<{ table: string; from: string }>(`PRAGMA foreign_key_list(${t})`)
      .filter((fk) => !first.has(fk.from))
      .map((fk) => `${t}.${fk.from} → ${fk.table}`);
  });
}

describe('database 13', () => {
  it('has an index under every link', () => {
    const db = openMemoryDb();
    migrate(db, upTo(12));
    expect(unindexedLinks(db).length).toBeGreaterThan(0);
    migrate(db, migrations);
    expect(schemaVersion(db)).toBe(LATEST_VERSION);
    expect(unindexedLinks(db)).toEqual([]);
  });

  it.each([4, 12])('keeps every row in the upgrade from database %i', (from) => {
    const db = openMemoryDb();
    migrate(db, upTo(from));
    db.run(
      "INSERT INTO customers (name, phone, created_at) VALUES ('هدى', '0912222222', '2026-11-01')",
    );
    db.run(
      `INSERT INTO sales (created_at, month, payment_method, customer_id, rate, total, total_cost)
       VALUES ('2026-11-02T10:00:00', '2026-11', 'cash', 1, 7000, 1000000, 500000)`,
    );
    const customers = db.all('SELECT * FROM customers');
    const sales = db.all('SELECT * FROM sales');
    migrate(db, migrations);
    expect(db.all('SELECT * FROM customers')).toMatchObject(customers as object[]);
    expect(db.all('SELECT * FROM sales')).toMatchObject(sales as object[]);
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
  });
});
