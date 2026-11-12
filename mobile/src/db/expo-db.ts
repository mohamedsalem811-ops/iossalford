import { openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';

import { databaseDirectory, toPath } from '@/lib/storage';

import { bindable, makeTransaction, type Db, type Params } from './types';

/** Opens a system's database file in the app's private folder (expo-sqlite, synchronous API). */
export function openExpoDb(fileName: string): Db {
  return wrap(openDatabaseSync(fileName, undefined, toPath(databaseDirectory(fileName).uri)));
}

/** Opens any database file by its address (a backup being checked or restored). */
export function openExpoDbAt(uri: string): Db {
  const path = toPath(uri);
  const slash = path.lastIndexOf('/');
  return wrap(openDatabaseSync(path.slice(slash + 1), undefined, path.slice(0, slash)));
}

function wrap(db: SQLiteDatabase): Db {
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
