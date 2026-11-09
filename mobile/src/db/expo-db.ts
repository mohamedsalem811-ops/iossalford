import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { bindable, makeTransaction, type Db, type Params } from './types';

/** Opens a database file in the app's private storage, using expo-sqlite's synchronous API. */
export function openExpoDb(fileName: string): Db {
  const db: SQLiteDatabase = openDatabaseSync(fileName);
  const exec = (sql: string) => db.execSync(sql);
  return {
    exec,
    run(sql: string, params?: Params) {
      const r = db.runSync(sql, bindable(params));
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    all<T>(sql: string, params?: Params) {
      return db.getAllSync<T>(sql, bindable(params));
    },
    get<T>(sql: string, params?: Params) {
      return db.getFirstSync<T>(sql, bindable(params)) ?? undefined;
    },
    transaction: makeTransaction(exec),
    close() {
      db.closeSync();
    },
  };
}
