import { LATEST_VERSION, migrations, type Migration } from './schema';
import type { Db } from './types';

export class DatabaseTooNewError extends Error {
  constructor(found: number) {
    super(
      `The database was made by a newer version of the app (schema ${found}, this app knows ${LATEST_VERSION}).`,
    );
    this.name = 'DatabaseTooNewError';
  }
}

/** Connection settings applied every time a database is opened. */
export function configure(db: Db) {
  db.exec('PRAGMA foreign_keys = ON;');
}

export function schemaVersion(db: Db): number {
  return db.get<{ user_version: number }>('PRAGMA user_version')?.user_version ?? 0;
}

/**
 * Brings a database up to the latest schema. Each migration runs in its own transaction and
 * records its version only when it fully succeeds, so a failure leaves the file as it was.
 * Refuses to open a database written by a newer app (it would be misread).
 */
export function migrate(db: Db, list: Migration[] = migrations): number {
  configure(db);
  const current = schemaVersion(db);
  const latest = list[list.length - 1]?.version ?? 0;
  if (current > latest) throw new DatabaseTooNewError(current);
  for (const m of list) {
    if (m.version <= current) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version};`);
    });
  }
  return schemaVersion(db);
}
