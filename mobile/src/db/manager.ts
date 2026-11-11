import type { SystemId } from '@/theme';

import { openExpoDb } from './expo-db';
import { DatabaseTooNewError, migrate } from './migrate';
import type { Db } from './types';

/** One database file per system, kept apart so the two shops never mix. */
export const DB_FILES: Record<SystemId, string> = {
  jewelry: 'jewelry.db',
  scarves: 'scarves.db',
};

export type OpenResult =
  | { status: 'ok'; db: Db }
  /** Made by a newer app version: left untouched; update the app to open it. */
  | { status: 'too-new'; message: string }
  /** Could not be opened or upgraded: the file is left exactly as it is. */
  | { status: 'unreadable'; message: string };

/**
 * Opens and upgrades a system's database. Nothing is ever deleted or recreated here: if the file
 * can't be read, it is left in place and the caller shows an error screen. Setting the file aside
 * and starting fresh is a separate, explicit choice (setAsideUnreadable).
 */
export function openSystemDb(
  system: SystemId,
  open: (file: string) => Db = openExpoDb,
): OpenResult {
  let db: Db | undefined;
  try {
    db = open(DB_FILES[system]);
    migrate(db);
    db.exec('PRAGMA journal_mode = WAL;');
    return { status: 'ok', db };
  } catch (error) {
    try {
      db?.close();
    } catch {
      // Closing a broken connection may fail too; the original error is what matters.
    }
    const message = error instanceof Error ? error.message : String(error);
    return error instanceof DatabaseTooNewError
      ? { status: 'too-new', message }
      : { status: 'unreadable', message };
  }
}

/** "jewelry.unreadable-2026-11-09T10-15-00.db": the name a set-aside copy is given. */
export function setAsideName(system: SystemId, now: Date): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
  return DB_FILES[system].replace('.db', `.unreadable-${stamp}.db`);
}

/**
 * Only after the owner confirms on the error screen: moves an unreadable database (and its WAL
 * files) aside under a dated name in the same folder, so a fresh one can be created. The old file
 * is kept for recovery, never deleted. Returns the new file name.
 */
export async function setAsideUnreadable(
  system: SystemId,
  now: Date = new Date(),
): Promise<string> {
  const { File } = await import('expo-file-system');
  const { databaseDirectory } = await import('@/lib/storage');
  const name = setAsideName(system, now);
  const dir = databaseDirectory(DB_FILES[system]);
  for (const suffix of ['', '-wal', '-shm']) {
    const file = new File(dir, DB_FILES[system] + suffix);
    if (file.exists) await file.move(new File(dir, name + suffix));
  }
  return name;
}
