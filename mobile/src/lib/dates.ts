/**
 * Dates use the Gregorian calendar and the device's local time, with Arabic month and day names
 * and digits 0-9 only. Months are identified by a "YYYY-MM" key and quarters by "YYYY-Qn",
 * the same keys the current app uses.
 */

export const MONTH_NAMES = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

export const WEEKDAY_NAMES = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

const QUARTER_NAMES = ['الأول', 'الثاني', 'الثالث', 'الرابع'] as const;

export type MonthKey = string; // "2026-11"
export type Quarter = { year: number; quarter: 1 | 2 | 3 | 4 };

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

/** "2026-11" for the month that contains `date`. */
export function monthKey(date: Date = new Date()): MonthKey {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}`;
}

/** "2026-11-09" for the day that contains `date`. */
export function dayKey(date: Date = new Date()): string {
  return `${monthKey(date)}-${pad(date.getDate())}`;
}

/** Reads a "YYYY-MM" key. Returns null for anything else. */
export function parseMonthKey(key: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  return month >= 1 && month <= 12 ? { year, month } : null;
}

/** "نوفمبر 2026"; returns the key itself if it is not a month key. */
export function monthTitle(key: MonthKey): string {
  const p = parseMonthKey(key);
  return p ? `${MONTH_NAMES[p.month - 1]} ${p.year}` : key;
}

/** Moves a month key by `delta` months (negative goes back). */
export function addMonths(key: MonthKey, delta: number): MonthKey {
  const p = parseMonthKey(key);
  if (!p) return key;
  const index = p.year * 12 + (p.month - 1) + delta;
  return `${pad(Math.floor(index / 12), 4)}-${pad((index % 12) + 1)}`;
}

/** This month first, then the `count - 1` months before it. */
export function recentMonths(count = 12, now: Date = new Date()): MonthKey[] {
  const current = monthKey(now);
  return Array.from({ length: count }, (_, i) => addMonths(current, -i));
}

/** Every month from `from` to `to`, both included, oldest first. Empty if `from` is after `to`. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const a = parseMonthKey(from);
  const b = parseMonthKey(to);
  if (!a || !b) return [];
  const count = b.year * 12 + b.month - (a.year * 12 + a.month) + 1;
  return count > 0 ? Array.from({ length: count }, (_, i) => addMonths(from, i)) : [];
}

/** Number of days in a month key (28–31). */
export function daysInMonth(key: MonthKey): number {
  const p = parseMonthKey(key);
  return p ? new Date(p.year, p.month, 0).getDate() : 0;
}

/** The quarter a date or month key belongs to. */
export function quarterOf(value: Date | MonthKey = new Date()): Quarter | null {
  const p =
    typeof value === 'string'
      ? parseMonthKey(value)
      : { year: value.getFullYear(), month: value.getMonth() + 1 };
  if (!p) return null;
  return { year: p.year, quarter: (Math.floor((p.month - 1) / 3) + 1) as Quarter['quarter'] };
}

/** "2026-Q4" */
export function quarterKey(q: Quarter): string {
  return `${q.year}-Q${q.quarter}`;
}

/** The three month keys of a quarter. */
export function quarterMonths(q: Quarter): MonthKey[] {
  const first = (q.quarter - 1) * 3 + 1;
  return [0, 1, 2].map((i) => `${pad(q.year, 4)}-${pad(first + i)}`);
}

/** "الربع الرابع 2026" */
export function quarterTitle(q: Quarter): string {
  return `الربع ${QUARTER_NAMES[q.quarter - 1]} ${q.year}`;
}

/** "الإثنين 9 نوفمبر" (add the year with `withYear`). */
export function formatDay(date: Date, withYear = false): string {
  const text = `${WEEKDAY_NAMES[date.getDay()]} ${date.getDate()} ${MONTH_NAMES[date.getMonth()]}`;
  return withYear ? `${text} ${date.getFullYear()}` : text;
}

/** "9 نوفمبر 2026" */
export function formatDate(date: Date): string {
  return `${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

/** "14:05" (24-hour, as on the current receipts). */
export function formatTime(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
