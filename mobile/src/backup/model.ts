/**
 * Pure rules of the backups on the device: file names, which to keep, and the reminder.
 * Backups never leave the device by themselves; copying one elsewhere is the owner's choice.
 */
import type { SystemId } from '@/theme';

/** How many backups each system keeps on the device (the oldest beyond go). */
export const KEEP = 10;
/** Days without a copy off the device before the reminder shows. */
export const REMIND_AFTER_DAYS = 7;

/** auto: on leaving the app; manual: "نسخة الآن"; safety: the data a restore replaced. */
export type BackupKind = 'auto' | 'manual' | 'safety';

const pad = (n: number) => String(n).padStart(2, '0');

/** "SALFORD-jewelry-2026-11-10-140512-auto.json": sorts by time, says the system and kind. */
export function backupFileName(system: SystemId, at: Date, kind: BackupKind): string {
  const stamp = `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}${pad(at.getSeconds())}`;
  return `SALFORD-${system}-${stamp}-${kind}.json`;
}

/** The file to copy off the device: the data and its photos in one file. */
export function copyFileName(system: SystemId, at: Date): string {
  return backupFileName(system, at, 'manual').replace('-manual.json', '-copy.json');
}

export type BackupInfo = { name: string; kind: BackupKind; at: Date };

/** Reads a backup file name back (null for any other file). */
export function parseBackupName(name: string): BackupInfo | null {
  const m =
    /^SALFORD-(jewelry|scarves)-(\d{4})-(\d{2})-(\d{2})-(\d{2})(\d{2})(\d{2})-(auto|manual|safety)\.json$/.exec(
      name,
    );
  if (!m) return null;
  const [, , y, mo, d, h, mi, s, kind] = m;
  return {
    name,
    kind: kind as BackupKind,
    at: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)),
  };
}

/** Newest first. */
export const newestFirst = (list: BackupInfo[]) =>
  [...list].sort((a, b) => b.at.getTime() - a.at.getTime());

/**
 * Which backups to delete so that `keep` remain, oldest first. Safety copies are counted on their
 * own, so restoring never pushes out the owner's own backups.
 */
export function toDelete(list: BackupInfo[], keep = KEEP): BackupInfo[] {
  const regular = newestFirst(list.filter((b) => b.kind !== 'safety'));
  const safety = newestFirst(list.filter((b) => b.kind === 'safety'));
  return [...regular.slice(keep), ...safety.slice(keep)];
}

/** Whole days from `then` to `now`. */
export function daysBetween(then: Date, now: Date): number {
  const start = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * The reminder line, or null while a copy is recent. Before any copy, the 7 days count from the
 * first backup on the device (a new shop is not reminded on its first day).
 */
export function copyReminder(
  lastCopied: Date | null,
  now: Date,
  firstBackup: Date | null = null,
): string | null {
  if (!lastCopied) {
    if (!firstBackup || daysBetween(firstBackup, now) < REMIND_AFTER_DAYS) return null;
    return `لم تُنسخ أي نسخة احتياطية خارج الجهاز منذ ${daysText(daysBetween(firstBackup, now))}. انسخ نسخة إلى الجهاز الآخر أو إلى كمبيوتر.`;
  }
  if (daysBetween(lastCopied, now) < REMIND_AFTER_DAYS) return null;
  return `آخر نسخة نُسخت خارج الجهاز ${agoText(lastCopied, now)}. انسخ نسخة جديدة إلى الجهاز الآخر أو إلى كمبيوتر.`;
}

/** "يومين", "5 أيام", "21 يوماً". */
function daysText(d: number): string {
  if (d === 1) return 'يوم';
  if (d === 2) return 'يومين';
  return `${d} ${d <= 10 ? 'أيام' : 'يوماً'}`;
}

/** "قبل 3 أيام", "اليوم", "أمس". */
export function agoText(then: Date, now: Date): string {
  const d = daysBetween(then, now);
  if (d <= 0) return 'اليوم';
  if (d === 1) return 'أمس';
  return `قبل ${daysText(d)}`;
}

export const KIND_LABELS: Record<BackupKind, string> = {
  auto: 'تلقائية',
  manual: 'يدوية',
  safety: 'قبل الاستعادة',
};
