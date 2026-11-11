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

export class UpgradeBrokeLinksError extends Error {
  constructor(version: number, count: number) {
    super(`Upgrade ${version} would leave ${count} records pointing at nothing; it was undone.`);
    this.name = 'UpgradeBrokeLinksError';
  }
}

/** True when the database exists but is older than this app (an upgrade will run). */
export function needsUpgrade(db: Db, list: Migration[] = migrations): boolean {
  const current = schemaVersion(db);
  const latest = list[list.length - 1]?.version ?? 0;
  return current > 0 && current < latest;
}

/**
 * Brings a database up to the latest schema. Each migration runs in its own transaction and
 * records its version only when it fully succeeds, so a failure leaves the file as it was.
 * Refuses to open a database written by a newer app (it would be misread).
 *
 * The links between tables (foreign keys) are switched off while migrations run, because SQLite
 * rebuilds a table by creating a new one and dropping the old: with links on, dropping the old
 * `sales` would also delete every sale line and return (ON DELETE CASCADE). Before each
 * migration commits, every link is checked; a migration that would leave a record pointing at
 * nothing is undone. The caller saves a copy of the database before an upgrade (needsUpgrade).
 */
export function migrate(db: Db, list: Migration[] = migrations): number {
  configure(db);
  const current = schemaVersion(db);
  const latest = list[list.length - 1]?.version ?? 0;
  if (current > latest) throw new DatabaseTooNewError(current);
  if (current === latest) return current;
  // Must be outside a transaction to take effect.
  db.exec('PRAGMA foreign_keys = OFF;');
  try {
    for (const m of list) {
      if (m.version <= current) continue;
      db.transaction(() => {
        db.exec(m.sql);
        const broken = db.all('PRAGMA foreign_key_check');
        if (broken.length) throw new UpgradeBrokeLinksError(m.version, broken.length);
        db.exec(`PRAGMA user_version = ${m.version};`);
      });
    }
  } finally {
    db.exec('PRAGMA foreign_keys = ON;');
  }
  return schemaVersion(db);
}
