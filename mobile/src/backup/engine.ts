/**
 * Backups as copies of the database file, made and read by SQLite itself (8.0g, 8.0h, 8.0i).
 *
 * - A copy is written with VACUUM INTO: fast, compact, no memory spike however big the shop's
 *   data grows, and consistent (it is one read of the database).
 * - Each copy carries a small table saying which system it belongs to and when it was made.
 * - A copy made to leave the device also carries the photos, one row per photo, written and read
 *   one at a time so memory stays small.
 * - Restoring first upgrades the copy to this app's schema (the same migrations as the live
 *   database, so a backup from any older version restores correctly), then replaces the data in
 *   one transaction.
 *
 * Everything here is plain SQL on the Db interface, so the tests run the exact same SQL on real
 * database files.
 */
import type { Db, SqlValue } from '@/db/types';
import { migrate, schemaVersion } from '@/db/migrate';
import { LATEST_VERSION } from '@/db/schema';
import { keepUsedNumbers, TABLES, usedNumbers } from '@/domain/backup';
import { RuleError } from '@/domain/context';
import { toPath } from '@/lib/paths';
import type { SystemId } from '@/theme';

/** Opens a database file by its address (expo-sqlite in the app, node:sqlite in tests). */
export type OpenDb = (uri: string) => Db;

const META = '_salford_backup';
const PHOTOS = '_salford_photos';

/** A path inside SQL: single-quoted, quotes doubled. */
const sqlString = (s: string) => `'${s.replace(/'/g, "''")}'`;

export type SnapshotInfo = {
  system: SystemId;
  schema: number;
  madeAt: string;
  products: number;
  sales: number;
  customers: number;
  receipts: number;
  photos: number;
};

/**
 * Writes a copy of `db` to `path` (which must not exist yet). The same data always gives the same
 * bytes, so comparing a fingerprint of the file says whether anything changed. The caller writes
 * to a temporary name and renames it when the copy is complete and labelled, so a half-written
 * copy never looks finished.
 */
export function copyDatabase(db: Db, path: string) {
  db.exec(`VACUUM INTO ${sqlString(toPath(path))}`);
}

/** Says, inside the copy, which system it belongs to and when it was made. */
export function labelSnapshot(
  open: OpenDb,
  path: string,
  label: { system: SystemId; madeAt: string },
) {
  const copy = open(path);
  try {
    copy.exec(`CREATE TABLE IF NOT EXISTS ${META} (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
    copy.run(`INSERT OR REPLACE INTO ${META} (key, value) VALUES ('system', ?), ('made_at', ?)`, [
      label.system,
      label.madeAt,
    ]);
  } finally {
    copy.close();
  }
}

/** A labelled copy in one go (tests, and copies that don't compare fingerprints). */
export function writeSnapshot(
  db: Db,
  open: OpenDb,
  path: string,
  label: { system: SystemId; madeAt: string },
) {
  copyDatabase(db, path);
  labelSnapshot(open, path, label);
}

/** Adds photos to a copy, one at a time: each photo is read only when it is written. */
export function addPhotos(
  open: OpenDb,
  path: string,
  photos: Iterable<{ name: string; read: () => Uint8Array | null }>,
): number {
  const copy = open(path);
  let n = 0;
  try {
    copy.exec(`CREATE TABLE IF NOT EXISTS ${PHOTOS} (name TEXT PRIMARY KEY, data BLOB NOT NULL)`);
    for (const p of photos) {
      const bytes = p.read();
      if (!bytes) continue;
      copy.run(`INSERT OR REPLACE INTO ${PHOTOS} (name, data) VALUES (?, ?)`, [p.name, bytes]);
      n++;
    }
  } finally {
    copy.close();
  }
  return n;
}

/** Calls `write` for each photo a copy carries, reading one photo at a time. */
export function eachPhoto(
  open: OpenDb,
  path: string,
  write: (name: string, bytes: Uint8Array) => void,
): number {
  const copy = open(path);
  let n = 0;
  try {
    if (!copy.get(`SELECT 1 FROM sqlite_master WHERE name = '${PHOTOS}'`)) return 0;
    const names = copy.all<{ name: string }>(`SELECT name FROM ${PHOTOS} ORDER BY name`);
    for (const { name } of names) {
      const row = copy.get<{ data: SqlValue }>(`SELECT data FROM ${PHOTOS} WHERE name = ?`, [name]);
      if (row?.data instanceof Uint8Array) {
        write(name, row.data);
        n++;
      }
    }
  } finally {
    copy.close();
  }
  return n;
}

const SYSTEM_NAMES: Record<SystemId, string> = { jewelry: 'المجوهرات', scarves: 'الأوشحة' };

/**
 * Checks a copy without changing it: a sound database file, labelled as a SALFORD POS backup of
 * this system, not from a newer app. Throws a RuleError explaining what is wrong.
 */
export function checkSnapshot(open: OpenDb, path: string, system: SystemId): SnapshotInfo {
  let copy: Db;
  try {
    copy = open(path);
  } catch {
    throw new RuleError('ملف النسخة الاحتياطية تالف أو غير مكتمل');
  }
  try {
    let label: Record<string, string>;
    try {
      const ok = copy.get<{ quick_check: string }>('PRAGMA quick_check')?.quick_check;
      if (ok !== 'ok') throw new Error(ok);
    } catch {
      throw new RuleError('ملف النسخة الاحتياطية تالف أو غير مكتمل');
    }
    try {
      label = Object.fromEntries(
        copy
          .all<{ key: string; value: string }>(`SELECT key, value FROM ${META}`)
          .map((r) => [r.key, r.value]),
      );
    } catch {
      throw new RuleError('هذا الملف ليس نسخة احتياطية من SALFORD POS');
    }
    const schema = schemaVersion(copy);
    if (schema > LATEST_VERSION) {
      throw new RuleError('هذه النسخة من إصدار أحدث من التطبيق. حدّث التطبيق ثم أعد المحاولة');
    }
    if (label.system !== system) {
      throw new RuleError(
        `هذه نسخة نظام ${SYSTEM_NAMES[label.system as SystemId] ?? 'آخر'}، لا يمكن استعادتها في نظام ${SYSTEM_NAMES[system]}`,
      );
    }
    const count = (t: string) => {
      try {
        return copy.get<{ n: number }>(`SELECT count(*) n FROM ${t}`)?.n ?? 0;
      } catch {
        return 0;
      }
    };
    return {
      system,
      schema,
      madeAt: label.made_at ?? '',
      products: count('products'),
      sales: count('sales'),
      customers: count('customers'),
      receipts: count('receipts'),
      photos: count(PHOTOS),
    };
  } finally {
    copy.close();
  }
}

/**
 * Replaces the system's data with a copy's, all-or-nothing. `path` must be a working copy of the
 * backup (it is upgraded in place to this app's schema first). The caller saves a safety copy of
 * the current data BEFORE calling this.
 */
export function restoreSnapshot(db: Db, open: OpenDb, path: string) {
  const copy = open(path);
  try {
    migrate(copy);
  } finally {
    copy.close();
  }
  db.exec(`ATTACH DATABASE ${sqlString(toPath(path))} AS backup`);
  try {
    db.transaction(() => {
      const used = usedNumbers(db);
      for (const t of [...TABLES].reverse()) db.run(`DELETE FROM main.${t}`);
      for (const t of TABLES) {
        const mine = new Set(
          db.all<{ name: string }>(`PRAGMA main.table_info(${t})`).map((c) => c.name),
        );
        const cols = db
          .all<{ name: string }>(`PRAGMA backup.table_info(${t})`)
          .map((c) => c.name)
          .filter((c) => mine.has(c));
        if (cols.length === 0) continue;
        const list = cols.join(', ');
        db.run(`INSERT INTO main.${t} (${list}) SELECT ${list} FROM backup.${t}`);
      }
      // Record numbers continue after the highest ever used, here or in the backup.
      db.run('DELETE FROM main.sqlite_sequence');
      db.run(
        `INSERT INTO main.sqlite_sequence (name, seq)
         SELECT name, seq FROM backup.sqlite_sequence WHERE name IN (${TABLES.map(sqlString).join(', ')})`,
      );
      keepUsedNumbers(db, used);
      const broken = db.all('PRAGMA main.foreign_key_check');
      if (broken.length) throw new RuleError('ملف النسخة الاحتياطية تالف أو غير مكتمل');
    });
  } finally {
    db.exec('DETACH DATABASE backup');
  }
}
