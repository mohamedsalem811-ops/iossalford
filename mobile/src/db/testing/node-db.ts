/**
 * Tests only: the same Db interface over Node's built-in SQLite (node:sqlite), so every business
 * rule is tested against a real SQLite database with the exact SQL the app runs.
 */
import { bindable, makeTransaction, type Db, type Params } from '../types';

type NodeStatement = {
  run(...params: unknown[]): { changes: number | bigint; lastInsertRowid: number | bigint };
  all(...params: unknown[]): unknown[];
  get(...params: unknown[]): unknown;
};
type NodeDatabase = { exec(sql: string): void; prepare(sql: string): NodeStatement; close(): void };

export function openMemoryDb(): Db {
  return openFileDb(':memory:');
}

/** A database file on disk (tests of backups, which copy whole database files). */
export function openFileDb(path: string): Db {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Node-only module, loaded in tests
  const { DatabaseSync } = require('node:sqlite') as {
    DatabaseSync: new (path: string) => NodeDatabase;
  };
  const db = new DatabaseSync(path);
  const exec = (sql: string) => db.exec(sql);
  // Rows come back as null-prototype objects; copy them so tests can compare with toEqual.
  const plain = <T>(row: unknown) => (row ? ({ ...(row as object) } as T) : undefined);
  return {
    exec,
    run(sql: string, params?: Params) {
      const r = db.prepare(sql).run(...bindable(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    all<T>(sql: string, params?: Params) {
      return db
        .prepare(sql)
        .all(...bindable(params))
        .map((r) => plain<T>(r) as T);
    },
    get<T>(sql: string, params?: Params) {
      return plain<T>(db.prepare(sql).get(...bindable(params)));
    },
    transaction: makeTransaction(exec),
    close() {
      db.close();
    },
  };
}
