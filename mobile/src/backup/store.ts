/**
 * Backups on the device. Each system keeps its last 10 in Documents/Backups (visible in the Files
 * app and in Finder over a cable: On My iPhone/iPad → SALFORD POS → Backups). Nothing is sent
 * anywhere: a copy leaves the device only when the owner shares it (AirDrop, Files, a computer).
 *
 * From Phase 8 a backup is a copy of the database file made by SQLite (see engine.ts): fast, small
 * and with no memory spike, however many years of sales there are. Every file is written under a
 * temporary name and renamed only when complete, so a half-written backup can't exist. Backups
 * made before Phase 8 (.json) are still listed and still restore.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';

import { openExpoDbAt } from '@/db/expo-db';
import type { Db } from '@/db/types';
import { forgetLog, saveAnchor, stampDevice } from '@/staff/guards';
import { backupContents, restoreBackup, validateBackup, type Backup } from '@/domain/backup';
import { lastLine, logAction } from '@/domain/activity';
import { allow, nowStamp, RuleError, timestamp, type Ctx } from '@/domain/context';
import { photoFile, photoFolder } from '@/lib/storage';
import { putCart } from '@/state/cart';
import type { SystemId } from '@/theme';

import {
  addPhotos,
  checkSnapshot,
  copyDatabase,
  eachPhoto,
  labelSnapshot,
  restoreSnapshot,
  type OpenDb,
} from './engine';
import {
  backupFileName,
  copyFileName,
  newestFirst,
  parseBackupName,
  PART,
  replacedAuto,
  toDelete,
  type BackupInfo,
  type BackupKind,
} from './model';

/** A backup copied off the device before Phase 8 also carried the system's photos, by name. */
export type BackupFile = Backup & { photos?: Record<string, string> };

/** What the restore screen shows before asking ("120 قطعة، 340 بيعة…"). */
export type BackupSummary = {
  products: number;
  sales: number;
  customers: number;
  receipts: number;
  exportedAt: string;
  photos: number;
};

/** A backup chosen to restore, checked and ready. */
export type PickedBackup =
  | { format: 'db'; work: string; contents: BackupSummary }
  | { format: 'json'; file: BackupFile; contents: BackupSummary };

const open: OpenDb = (uri) => openExpoDbAt(uri);

const folder = (system: SystemId) => {
  const dir = new Directory(Paths.document, 'Backups', system);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};

const key = (what: 'checksum' | 'copied' | 'first', system: SystemId) => `backup-${what}.${system}`;
const read = (k: string) => {
  try {
    return SecureStore.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    SecureStore.setItem(k, v);
  } catch {
    // Only a convenience (skipping identical backups, the reminder).
  }
};

const removeQuietly = (f: File) => {
  try {
    if (f.exists) f.delete();
  } catch {
    // A leftover temporary file only takes space; it is never listed.
  }
};

/** The system's backups on the device, newest first (files still being written are left out). */
export function listBackups(system: SystemId): BackupInfo[] {
  const dir = new Directory(Paths.document, 'Backups', system);
  if (!dir.exists) return [];
  return newestFirst(
    dir
      .list()
      .filter((f): f is File => f instanceof File)
      .map((f) => parseBackupName(f.name))
      .filter((b): b is BackupInfo => b !== null),
  );
}

function prune(system: SystemId) {
  for (const b of toDelete(listBackups(system))) removeQuietly(new File(folder(system), b.name));
  // Temporary files left by a backup the app could not finish (closed by iOS in the middle).
  for (const f of folder(system).list())
    if (f instanceof File && f.name.endsWith(PART)) removeQuietly(f);
}

/** Writes counted by SQLite on this connection since the app opened it. */
const changes = (db: Db) => db.get<{ n: number }>('SELECT total_changes() AS n')?.n ?? 0;
/** The write count at the last backup of each system in this run of the app. */
const lastBackedUp = new Map<SystemId, number>();

/**
 * Writes a labelled copy of `db` as `name` in `dir`, under a temporary name; the caller renames it
 * when it should count. Returns the file and its fingerprint (the same data, the same fingerprint).
 */
function writeCopy(db: Db, system: SystemId, dir: Directory, name: string, madeAt: string) {
  const part = new File(dir, `${name}${PART}`);
  removeQuietly(part);
  copyDatabase(db, part.uri);
  const fingerprint = part.md5;
  labelSnapshot(open, part.uri, { system, madeAt });
  return { part, fingerprint };
}

const ownKind = (kind: BackupKind) => kind === 'auto' || kind === 'manual';

/**
 * Saves a backup of the system now. An automatic backup is skipped when nothing changed since the
 * last one (so ten identical copies never push out older, different ones), without even reading
 * the database when nothing was written in this run of the app; one made within an hour of the
 * last automatic backup replaces it.
 */
export function saveBackup(ctx: Ctx, kind: BackupKind): BackupInfo | null {
  const system = ctx.system;
  const now = changes(ctx.db);
  if (kind === 'auto' && lastBackedUp.get(system) === now) return null;
  const name = backupFileName(system, ctx.now(), kind);
  const { part, fingerprint } = writeCopy(ctx.db, system, folder(system), name, nowStamp(ctx));
  if (kind === 'auto' && fingerprint && fingerprint === read(key('checksum', system))) {
    removeQuietly(part);
    lastBackedUp.set(system, now);
    return null;
  }
  // Within an hour of the last automatic backup, the new one replaces it (one per hour).
  const replaced = kind === 'auto' ? replacedAuto(listBackups(system), ctx.now()) : null;
  removeQuietly(new File(folder(system), name));
  part.rename(name);
  if (replaced && replaced.name !== name) removeQuietly(new File(folder(system), replaced.name));
  if (ownKind(kind)) {
    if (fingerprint) write(key('checksum', system), fingerprint);
    lastBackedUp.set(system, now);
  }
  if (!read(key('first', system))) write(key('first', system), ctx.now().toISOString());
  prune(system);
  return parseBackupName(name);
}

/**
 * Before the app upgrades a database (a new version with changed tables), a copy of the data as
 * it was is saved with the backups ("قبل تحديث التطبيق"). If the copy can't be made, the upgrade
 * does not run (the error screen shows; nothing is lost).
 */
export function saveUpgradeCopy(system: SystemId, db: Db, at: Date = new Date()) {
  const name = backupFileName(system, at, 'upgrade');
  // Local time, like every other date the app shows (not UTC).
  const { part } = writeCopy(db, system, folder(system), name, timestamp(at));
  part.rename(name);
  prune(system);
}

export function deleteBackup(ctx: Ctx, name: string) {
  allow(ctx, 'backup.manage');
  removeQuietly(new File(folder(ctx.system), name));
  logAction(ctx, 'backup.delete', `حذف النسخة الاحتياطية ${name}`, { name });
}

const readDate = (k: string) => {
  const v = read(k);
  const d = v ? new Date(v) : null;
  return d && !Number.isNaN(d.getTime()) ? d : null;
};

/** When a backup of this system was last copied off the device. */
export const lastCopied = (system: SystemId) => readDate(key('copied', system));

/** When the first backup of this system was saved on this device (kept even after pruning). */
export const firstBackup = (system: SystemId) => readDate(key('first', system));

/** Photo file names the system uses (products and brands). */
function photoNames(ctx: Ctx): string[] {
  return ctx.db
    .all<{ f: string }>(
      `SELECT image_file AS f FROM products WHERE image_file IS NOT NULL
       UNION SELECT image_file FROM brands WHERE image_file IS NOT NULL`,
    )
    .map((r) => r.f);
}

/**
 * Shares a full copy (the data and its photos in one file) through the iOS share sheet: AirDrop to
 * the other device, Save to Files, or a message to oneself. Photos are added one at a time, so
 * memory stays small however many there are. Also saved as a backup on this device.
 */
export async function shareCopy(ctx: Ctx): Promise<void> {
  allow(ctx, 'backup.manage');
  logAction(ctx, 'backup.share', 'نسخ نسخة احتياطية إلى خارج الجهاز');
  saveBackup(ctx, 'manual');
  const name = copyFileName(ctx.system, ctx.now());
  const cache = new Directory(Paths.cache);
  const { part } = writeCopy(ctx.db, ctx.system, cache, name, nowStamp(ctx));
  addPhotos(
    open,
    part.uri,
    photoNames(ctx).map((photo) => ({
      name: photo,
      read: () => {
        const f = photoFile(ctx.system, photo);
        return f.exists ? f.bytesSync() : null;
      },
    })),
  );
  const file = new File(cache, name);
  removeQuietly(file);
  part.rename(name);
  try {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'application/x-sqlite3',
      UTI: 'public.database',
      dialogTitle: file.name,
    });
    write(key('copied', ctx.system), ctx.now().toISOString());
  } finally {
    removeQuietly(file);
  }
}

/**
 * Picks a backup file from the device (Files, or what AirDrop saved). Null if cancelled. Every file
 * can be chosen: iOS has no type for a ".db" file, so asking for database types greyed out every
 * backup. The chosen file is checked before anything happens (readBackupFile).
 */
export async function pickBackupFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
    multiple: false,
  });
  return r.canceled ? null : (r.assets[0]?.uri ?? null);
}

/** A backup saved on this device, by name. */
export function savedBackupUri(system: SystemId, name: string) {
  return new File(folder(system), name).uri;
}

/**
 * Reads and checks a backup file without changing it. A database copy is checked on a working
 * copy (the chosen file itself is never touched). Throws a RuleError explaining what is wrong.
 */
export async function readBackupFile(ctx: Ctx, uri: string): Promise<PickedBackup> {
  const source = new File(uri);
  if (source.name.endsWith('.json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await source.text());
    } catch {
      parsed = null;
    }
    const backup = validateBackup(ctx, parsed);
    const photos = (parsed as BackupFile).photos;
    const file = { ...backup, photos: photos && typeof photos === 'object' ? photos : undefined };
    return {
      format: 'json',
      file,
      contents: { ...backupContents(backup), photos: Object.keys(file.photos ?? {}).length },
    };
  }
  if (!source.exists) throw new RuleError('لم يُعثر على ملف النسخة الاحتياطية');
  const work = new File(Paths.cache, `restore-${ctx.system}-${ctx.now().getTime()}.db`);
  removeQuietly(work);
  source.copySync(work);
  try {
    const info = checkSnapshot(open, work.uri, ctx.system);
    return {
      format: 'db',
      work: work.uri,
      contents: {
        products: info.products,
        sales: info.sales,
        customers: info.customers,
        receipts: info.receipts,
        exportedAt: info.madeAt,
        photos: info.photos,
      },
    };
  } catch (error) {
    removeQuietly(work);
    throw error;
  }
}

/** The owner chose not to restore: the working copy is removed. */
export function discardPicked(picked: PickedBackup) {
  if (picked.format === 'db') removeQuietly(new File(picked.work));
}

/** Writes a photo the backup carries, unless the device already has it. */
function putPhoto(system: SystemId, name: string, content: Uint8Array | string) {
  if (!/^[\w.-]+$/.test(name)) return;
  if (photoFile(system, name).exists) return;
  const f = new File(photoFolder(system), name);
  if (typeof content === 'string') f.writeSync(content, { encoding: 'base64' });
  else f.writeSync(content);
}

/**
 * Replaces the system's data with the backup. The data it replaces is saved FIRST, as a safety
 * copy on the device (in the backups list): if that can't be saved, nothing is replaced. Then the
 * photos the backup carries are put back, and the open cart is emptied (its pieces may no longer
 * exist).
 */
export async function restore(ctx: Ctx, picked: PickedBackup): Promise<void> {
  allow(ctx, 'backup.restore');
  saveBackup(ctx, 'safety');
  if (picked.format === 'db') {
    try {
      restoreSnapshot(ctx.db, open, picked.work);
      // The restored data brings its own log; this line is added after it.
      logAction(ctx, 'backup.restore', 'استرجاع نسخة احتياطية');
      eachPhoto(open, picked.work, (name, bytes) => putPhoto(ctx.system, name, bytes));
    } finally {
      removeQuietly(new File(picked.work));
    }
  } else {
    const { photos, ...backup } = picked.file;
    restoreBackup(ctx, backup);
    for (const [name, base64] of Object.entries(photos ?? {})) putPhoto(ctx.system, name, base64);
  }
  // The backup may come from the other device: new records here carry this device's id. Its log
  // is the backup's own, so what was remembered of the old log starts again from it.
  stampDevice(ctx.db);
  forgetLog(ctx.system);
  saveAnchor(ctx.system, lastLine(ctx));
  // The restored data is new to the backups: the next automatic backup saves it.
  lastBackedUp.delete(ctx.system);
  write(key('checksum', ctx.system), '');
  putCart(ctx.system, []);
}
