/**
 * Backups on the device. Each system keeps its last 10 in the app's own folder (visible in the
 * Files app and in Finder over a cable: On My iPhone/iPad → SALFORD POS → Backups). Nothing is
 * sent anywhere: a copy leaves the device only when the owner shares it (AirDrop, Files, a
 * computer). Restoring checks the file first and keeps a safety copy of the data it replaces.
 */
import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';

import { exportBackup, restoreBackup, validateBackup, type Backup } from '@/domain/backup';
import type { Ctx } from '@/domain/context';
import { putCart } from '@/state/cart';
import type { SystemId } from '@/theme';

import {
  backupFileName,
  copyFileName,
  newestFirst,
  parseBackupName,
  toDelete,
  type BackupInfo,
  type BackupKind,
} from './model';

/** A backup copied off the device also carries the system's photos, by file name. */
export type BackupFile = Backup & { photos?: Record<string, string> };

const folder = (system: SystemId) => {
  const dir = new Directory(Paths.document, 'Backups', system);
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
};
const photoFolder = (system: SystemId) => new Directory(Paths.document, 'photos', system);

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

/** The system's backups on the device, newest first. */
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
  for (const b of toDelete(listBackups(system))) {
    try {
      new File(folder(system), b.name).delete();
    } catch {
      // A copy left behind only takes space.
    }
  }
}

/**
 * Saves a backup of the system now. An automatic backup is skipped when nothing changed since
 * the last one, so ten identical copies never push out older, different ones.
 */
export function saveBackup(ctx: Ctx, kind: BackupKind, data: Backup = exportBackup(ctx)) {
  if (kind === 'auto' && data.checksum === read(key('checksum', ctx.system))) return null;
  const name = backupFileName(ctx.system, ctx.now(), kind);
  const file = new File(folder(ctx.system), name);
  file.create({ overwrite: true });
  file.writeSync(JSON.stringify(data));
  if (kind !== 'safety') write(key('checksum', ctx.system), data.checksum);
  if (!read(key('first', ctx.system))) write(key('first', ctx.system), ctx.now().toISOString());
  prune(ctx.system);
  return parseBackupName(name);
}

export function deleteBackup(system: SystemId, name: string) {
  const f = new File(folder(system), name);
  if (f.exists) f.delete();
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
 * the other device, Save to Files, or a message to oneself. Also saved as a backup on this device.
 */
export async function shareCopy(ctx: Ctx): Promise<void> {
  const data = exportBackup(ctx);
  saveBackup(ctx, 'manual', data);
  const photos: Record<string, string> = {};
  const dir = photoFolder(ctx.system);
  for (const name of photoNames(ctx)) {
    const f = new File(dir, name);
    if (f.exists) photos[name] = await f.base64();
  }
  const file = new File(Paths.cache, copyFileName(ctx.system, ctx.now()));
  file.create({ overwrite: true });
  file.writeSync(JSON.stringify({ ...data, photos } satisfies BackupFile));
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: file.name,
  });
  write(key('copied', ctx.system), ctx.now().toISOString());
}

/** Picks a backup file from the device (Files, or what AirDrop saved). Null if cancelled. */
export async function pickBackupFile(): Promise<string | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: ['application/json', 'public.json', 'public.data'],
    copyToCacheDirectory: true,
    multiple: false,
  });
  return r.canceled ? null : (r.assets[0]?.uri ?? null);
}

/** Reads and checks a backup file. Throws a RuleError explaining what is wrong. */
export async function readBackupFile(ctx: Ctx, uri: string): Promise<BackupFile> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(await new File(uri).text());
  } catch {
    parsed = null;
  }
  const backup = validateBackup(ctx, parsed);
  const photos = (parsed as BackupFile).photos;
  return { ...backup, photos: photos && typeof photos === 'object' ? photos : undefined };
}

/** A backup saved on this device, read and checked. */
export function savedBackupUri(system: SystemId, name: string) {
  return new File(folder(system), name).uri;
}

/**
 * Replaces the system's data with the backup. The data it replaces is saved first as a safety
 * copy (on the device, in the backups list), photos the backup carries are put back, and the open
 * cart is emptied (its pieces may no longer exist).
 */
export async function restore(ctx: Ctx, file: BackupFile): Promise<void> {
  const { photos, ...backup } = file;
  const { safetyCopy } = restoreBackup(ctx, backup);
  saveBackup(ctx, 'safety', safetyCopy);
  write(key('checksum', ctx.system), backup.checksum);
  if (photos) {
    const dir = photoFolder(ctx.system);
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    for (const [name, base64] of Object.entries(photos)) {
      if (!/^[\w.-]+$/.test(name)) continue;
      const f = new File(dir, name);
      if (f.exists) continue;
      f.create();
      f.writeSync(base64, { encoding: 'base64' });
    }
  }
  putCart(ctx.system, []);
}
