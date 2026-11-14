/**
 * Pure rules of the backups on the device: file names, which to keep, and the reminder.
 * Backups never leave the device by themselves; copying one elsewhere is the owner's choice.
 */
import type { SystemId } from '@/theme';

/** How many backups each system keeps on the device (the oldest beyond go). */
export const KEEP = 10;
/** On top of those, the newest backup of each of the last this-many days with a backup is kept. */
export const KEEP_DAYS = 7;
/** Automatic backups within this many minutes of the last one replace it (one per hour). */
export const AUTO_EVERY_MINUTES = 60;
/** Days without a copy off the device before the reminder shows. */
export const REMIND_AFTER_DAYS = 7;

/**
 * auto: on leaving the app; manual: "نسخة الآن"; safety: the data a restore replaced; upgrade:
 * the data as it was before the app upgraded its database.
 */
export type BackupKind = 'auto' | 'manual' | 'safety' | 'upgrade';

/** Backups are copies of the database file (.db); older ones (before Phase 8) are .json. */
export type BackupFormat = 'db' | 'json';

const pad = (n: number) => String(n).padStart(2, '0');
const day = (at: Date) => `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;

/**
 * "2026-11-10_14.05.12_auto.db": the date first, so the Files app (which shortens long names in
 * the middle) still shows the day and the kind. The folder (Backups/jewelry) says the system.
 */
export function backupFileName(_system: SystemId, at: Date, kind: BackupKind): string {
  return `${day(at)}_${pad(at.getHours())}.${pad(at.getMinutes())}.${pad(at.getSeconds())}_${kind}.db`;
}

/** The file to copy off the device (the data and its photos): "jewelry_2026-11-10_14.05.db". */
export function copyFileName(system: SystemId, at: Date): string {
  return `${system}_${day(at)}_${pad(at.getHours())}.${pad(at.getMinutes())}.db`;
}

/** A file being written: renamed to its real name only when complete. */
export const PART = '.part';

export type BackupInfo = { name: string; kind: BackupKind; at: Date; format: BackupFormat };

const KINDS = 'auto|manual|safety|upgrade';
/** Today's names, and the names used before 2026-11-12 ("SALFORD-jewelry-2026-11-10-140512-auto.db"). */
const NAME = new RegExp(
  `^(\\d{4})-(\\d{2})-(\\d{2})_(\\d{2})\\.(\\d{2})\\.(\\d{2})_(${KINDS})\\.(db|json)$`,
);
const OLD_NAME = new RegExp(
  `^SALFORD-(?:jewelry|scarves)-(\\d{4})-(\\d{2})-(\\d{2})-(\\d{2})(\\d{2})(\\d{2})-(${KINDS})\\.(db|json)$`,
);

/** Reads a backup file name back (null for any other file). */
export function parseBackupName(name: string): BackupInfo | null {
  const m = NAME.exec(name) ?? OLD_NAME.exec(name);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, kind, ext] = m;
  return {
    name,
    kind: kind as BackupKind,
    format: ext as BackupFormat,
    at: new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s)),
  };
}

/** Newest first. */
export const newestFirst = (list: BackupInfo[]) =>
  [...list].sort((a, b) => b.at.getTime() - a.at.getTime());

/**
 * Which backups to delete, oldest first. The owner's own backups (automatic and manual): the
 * newest `keep`, plus the newest of each of the last KEEP_DAYS days that have a backup, so a busy
 * hour never pushes out yesterday's. Safety copies and copies made before an upgrade are counted
 * on their own (the newest `keep` of each), so neither ever pushes out the owner's backups.
 */
export function toDelete(list: BackupInfo[], keep = KEEP): BackupInfo[] {
  const regular = newestFirst(list.filter((b) => b.kind === 'auto' || b.kind === 'manual'));
  const kept = new Set(regular.slice(0, keep));
  const days = new Set<string>();
  for (const b of regular) {
    if (days.has(day(b.at))) continue;
    if (days.size === KEEP_DAYS) break;
    days.add(day(b.at));
    kept.add(b);
  }
  const safety = newestFirst(list.filter((b) => b.kind === 'safety'));
  const upgrade = newestFirst(list.filter((b) => b.kind === 'upgrade'));
  return [...regular.filter((b) => !kept.has(b)), ...safety.slice(keep), ...upgrade.slice(keep)];
}

/**
 * The automatic backup a new one replaces: the newest backup, when it is automatic and less than
 * an hour old. So using the app all day keeps one automatic backup per hour, always the latest.
 */
export function replacedAuto(list: BackupInfo[], now: Date): BackupInfo | null {
  const newest = newestFirst(list)[0];
  if (!newest || newest.kind !== 'auto') return null;
  const minutes = (now.getTime() - newest.at.getTime()) / 60_000;
  return minutes >= 0 && minutes < AUTO_EVERY_MINUTES ? newest : null;
}

/** Whole days from `then` to `now`. */
export function daysBetween(then: Date, now: Date): number {
  const start = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((end.getTime() - start.getTime()) / 86_400_000);
}

/**
 * Days since a copy last left the device, once the reminder is due (null before). Before any copy,
 * the days count from the first backup on the device (a new shop is not reminded on its first day).
 */
export function copyOverdueDays(
  lastCopied: Date | null,
  now: Date,
  firstBackup: Date | null = null,
): number | null {
  const since = lastCopied ?? firstBackup;
  if (!since) return null;
  const days = daysBetween(since, now);
  return days >= REMIND_AFTER_DAYS ? days : null;
}

/** The reminder line, or null while a copy is recent. */
export function copyReminder(
  lastCopied: Date | null,
  now: Date,
  firstBackup: Date | null = null,
): string | null {
  const days = copyOverdueDays(lastCopied, now, firstBackup);
  if (days === null) return null;
  if (!lastCopied)
    return `لم تُنسخ أي نسخة احتياطية خارج الجهاز منذ ${daysText(days)}. انسخ نسخة إلى الجهاز الآخر أو إلى كمبيوتر.`;
  return `آخر نسخة نُسخت خارج الجهاز ${agoText(lastCopied, now)}. انسخ نسخة جديدة إلى الجهاز الآخر أو إلى كمبيوتر.`;
}

/** The home screen's red line: "لا نسخة خارج الجهاز منذ 9 أيام". */
export const copyReminderTitle = (days: number) => `لا نسخة خارج الجهاز منذ ${daysText(days)}`;

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
  upgrade: 'قبل تحديث التطبيق',
};
