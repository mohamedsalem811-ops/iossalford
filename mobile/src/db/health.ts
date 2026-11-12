import type { Db } from './types';

/** How often the database is checked when it opens. */
export const HEALTH_EVERY_DAYS = 7;

const get = (db: Db, key: string) =>
  db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value;
const set = (db: Db, key: string, value: string) =>
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);

/**
 * About once a week, when a system opens: SQLite checks its own file (quick_check) and tidies
 * its query planning (optimize). A problem is remembered, so the home screen can say so while
 * recent backups still exist. Never stops the app from opening.
 */
export function weeklyHealthCheck(db: Db, now: Date): 'ok' | 'problem' | 'not-due' {
  try {
    const last = Date.parse(get(db, 'health_checked_at') ?? '');
    if (!Number.isNaN(last) && now.getTime() - last < HEALTH_EVERY_DAYS * 86_400_000)
      return 'not-due';
    const result = db.get<{ quick_check: string }>('PRAGMA quick_check')?.quick_check ?? '';
    db.exec('PRAGMA optimize;');
    set(db, 'health_checked_at', now.toISOString());
    set(db, 'health_problem', result === 'ok' ? '' : result);
    return result === 'ok' ? 'ok' : 'problem';
  } catch (error) {
    try {
      set(db, 'health_problem', error instanceof Error ? error.message : String(error));
    } catch {
      // The file can't even be written: the next open shows the error screen anyway.
    }
    return 'problem';
  }
}

/** What the last check found wrong, or null. */
export function healthProblem(db: Db): string | null {
  try {
    return get(db, 'health_problem') || null;
  } catch {
    return null;
  }
}
