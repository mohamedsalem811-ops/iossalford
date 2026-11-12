/**
 * Where the app keeps its files.
 *
 * - Private (not shown in the Files app, so nothing can be deleted or moved there by mistake): the
 *   databases and the photos, in Library/Application Support/SALFORD.
 * - Shown in Files (On My iPhone / On My iPad → SALFORD POS): only Backups and Receipts, in
 *   Documents.
 *
 * Installs from before Phase 8 kept the databases and photos in Documents; moveLegacyData() moves
 * them once, at start, before any database opens. A file is never overwritten, and if a move fails
 * the app keeps reading the file where it is (see databaseDirectory and photoFile), so the shop's
 * data is never hidden or lost. In Expo Go (testing only) the private folder sits inside Documents.
 */
import { isRunningInExpoGo } from 'expo';
import { Directory, File, Paths } from 'expo-file-system';

import type { SystemId } from '@/theme';

const ensure = (dir: Directory) => {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

/** The app's private folder. */
export function privateRoot(): Directory {
  return ensure(
    isRunningInExpoGo()
      ? new Directory(Paths.document, 'private')
      : new Directory(Paths.document.parentDirectory, 'Library', 'Application Support', 'SALFORD'),
  );
}

/** Where the databases used to be (Documents/SQLite) and where they are now. */
const legacyDatabases = () => new Directory(Paths.document, 'SQLite');
export const databaseFolder = () => ensure(new Directory(privateRoot(), 'SQLite'));

const legacyPhotos = (system: SystemId) => new Directory(Paths.document, 'photos', system);
export const photoFolder = (system: SystemId) =>
  ensure(new Directory(privateRoot(), 'photos', system));

export { toPath } from './paths';

/**
 * The folder holding a database file: the private one, unless the file is still only in the old
 * place (a move that failed), in which case it is opened there rather than starting empty.
 */
export function databaseDirectory(fileName: string): Directory {
  const current = databaseFolder();
  if (new File(current, fileName).exists) return current;
  const old = legacyDatabases();
  if (old.exists && new File(old, fileName).exists) return old;
  return current;
}

/** A photo file: in the private folder, or still in the old place if it couldn't be moved. */
export function photoFile(system: SystemId, name: string): File {
  const current = new File(photoFolder(system), name);
  if (current.exists) return current;
  const old = new File(legacyPhotos(system), name);
  return old.exists ? old : current;
}

/** Moves every file of `from` into `to` that isn't there yet; returns how many were left behind. */
function moveFiles(from: Directory, to: Directory): number {
  if (!from.exists) return 0;
  let left = 0;
  for (const item of from.list()) {
    if (!(item instanceof File)) continue;
    const target = new File(to, item.name);
    if (target.exists) {
      left++;
      continue;
    }
    try {
      item.moveSync(target);
    } catch {
      left++;
    }
  }
  if (left === 0) {
    try {
      from.delete();
    } catch {
      // An empty folder left behind does no harm.
    }
  }
  return left;
}

export type MoveReport = { moved: boolean; leftBehind: number };

/**
 * Moves an older install's databases (with their -wal/-shm files) and photos into the private
 * folder. Safe to run at every start: when nothing is left in the old place it does nothing.
 */
export function moveLegacyData(systems: readonly SystemId[]): MoveReport {
  let leftBehind = 0;
  let moved = false;
  try {
    const db = legacyDatabases();
    if (db.exists) {
      moved = true;
      // A database is moved together with its -wal and -shm files, or not at all, so a half
      // moved database can never be opened.
      const current = databaseFolder();
      const groups = new Map<string, File[]>();
      for (const f of db.list()) {
        if (!(f instanceof File)) continue;
        const base = f.name.replace(/-(wal|shm|journal)$/, '');
        groups.set(base, [...(groups.get(base) ?? []), f]);
      }
      for (const [base, group] of groups) {
        if (new File(current, base).exists) {
          leftBehind += group.length;
          continue;
        }
        const done: File[] = [];
        try {
          // The main file last: until it has moved, the database still opens from the old place.
          for (const f of [...group].sort((a, b) =>
            a.name === base ? 1 : b.name === base ? -1 : 0,
          )) {
            const target = new File(current, f.name);
            f.moveSync(target);
            done.push(target);
          }
        } catch {
          // Put back what moved, so the database stays whole in the old place.
          for (const t of done) {
            try {
              t.moveSync(new File(db, t.name));
            } catch {
              // Nothing more can be done now; the next start tries again.
            }
          }
          leftBehind += group.length;
        }
      }
      if (leftBehind === 0) {
        try {
          db.delete();
        } catch {
          // An empty folder left behind does no harm.
        }
      }
    }
    for (const system of systems) {
      const old = legacyPhotos(system);
      if (!old.exists) continue;
      moved = true;
      leftBehind += moveFiles(old, photoFolder(system));
    }
    const photosRoot = new Directory(Paths.document, 'photos');
    if (photosRoot.exists && photosRoot.list().length === 0) photosRoot.delete();
  } catch {
    // Never stop the app over this: files not moved are still read where they are.
  }
  return { moved, leftBehind };
}
