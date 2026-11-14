/**
 * The birthday discount (H1): a percentage off a customer's purchase in their birthday week, set
 * up by the owner in Settings → الولاء والمكافآت, so the seller needs no approval and it is not in
 * the employee's discount limit. Like the visit reward it comes off the pieces' prices (returns
 * stay right) and is kept apart on the sale (sales.birthday_off).
 *
 * The rules, agreed with the owner:
 * - from 3 days before to 3 days after the birthday (29 February: 28 February in other years);
 * - once a year: not again within 330 days, whatever the birthday says (two birthdays are a year
 *   apart, so last year's use late in its week never blocks this year's week); a sale fully
 *   returned gives it back;
 * - for a customer with a phone number on file;
 * - a birthday saved (or changed) less than 30 days before it needs the owner's approval;
 * - never with the visit reward or any other discount on the same sale (one reward a purchase);
 * - off, with no cap, until the owner sets the cap and turns it on.
 */
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { allow, timestamp, RuleError, type Ctx } from './context';
import { birthdayText, getCustomer, phoneKey, validBirthday, type Customer } from './customers';
import { customerSales } from './customer-stats';
import { getSetting, setSetting } from './settings';

export type BirthdayRules = {
  enabled: boolean;
  /** Percent off the purchase. */
  percent: number;
  /** The most it takes off, in dirhams; 0: not set yet (the owner chooses it). */
  maxOff: number;
  /** Used only on a purchase of at least this much, in dirhams; 0: any. */
  minSale: number;
};

export const DEFAULT_BIRTHDAY: BirthdayRules = {
  enabled: false,
  percent: 10,
  maxOff: 0,
  minSale: 0,
};

export const BIRTHDAY_KEY = 'birthday_discount';
/** Days before and after the birthday. */
export const WINDOW_DAYS = 3;
/** A birthday saved less than this many days before it needs the owner. */
export const NOTICE_DAYS = 30;
/**
 * Not again within this many days. Safely under 358 (a year minus the 7-day window), so a use on
 * the last day of last year's window never blocks the first day of this year's.
 */
const ONCE_DAYS = 330;

export function getBirthday(ctx: Ctx): BirthdayRules {
  try {
    const saved = JSON.parse(getSetting(ctx, BIRTHDAY_KEY) ?? '{}') as Partial<BirthdayRules>;
    return { ...DEFAULT_BIRTHDAY, ...saved };
  } catch {
    return DEFAULT_BIRTHDAY;
  }
}

/** On and ready: the owner turned it on with a cap. */
export const birthdayOn = (r: BirthdayRules) => r.enabled && r.maxOff > 0 && r.percent > 0;

const describe = (r: BirthdayRules) =>
  r.enabled
    ? `خصم عيد الميلاد: ${r.percent}% حتى ${formatLyd(r.maxOff)}${r.minSale ? `، على شراء من ${formatLyd(r.minSale)}` : ''}`
    : 'خصم عيد الميلاد متوقف';

/** The owner sets the birthday discount; each change is logged. */
export function setBirthday(ctx: Ctx, changes: Partial<BirthdayRules>): BirthdayRules {
  allow(ctx, 'settings.edit');
  const old = getBirthday(ctx);
  const next: BirthdayRules = { ...old, ...changes };
  const whole = (n: number, min: number) => Number.isInteger(n) && n >= min;
  if (!whole(next.percent, 1) || next.percent > 50)
    throw new RuleError('نسبة خصم عيد الميلاد من 1 إلى 50%');
  if (!whole(next.maxOff, 0) || next.maxOff % 1000 !== 0)
    throw new RuleError('اكتب أكبر مبلغ لخصم عيد الميلاد بالدينار');
  if (next.enabled && next.maxOff < 1000)
    throw new RuleError('حدد أكبر مبلغ لخصم عيد الميلاد قبل تفعيله');
  if (!whole(next.minSale, 0)) throw new RuleError('اكتب أقل مبلغ للشراء');
  if (JSON.stringify(next) === JSON.stringify(old)) return old;
  ctx.db.transaction(() => {
    setSetting(ctx, BIRTHDAY_KEY, JSON.stringify(next));
    logAction(ctx, 'birthday.set', describe(next), { from: old, to: next });
  });
  return next;
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysBetween = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / DAY_MS);

/** The birthday in a given year: 29 February is the 28th in other years. */
function birthdayIn(year: number, month: number, day: number): Date {
  const leap = new Date(year, 1, 29).getMonth() === 1;
  return new Date(year, month - 1, month === 2 && day === 29 && !leap ? 28 : day);
}

export type BirthdayWindow = {
  /** The birthday this window is around (last year's, this year's or next year's). */
  date: Date;
  from: Date;
  to: Date;
  /** Days from today to the birthday: 0 today, negative once it has passed. */
  days: number;
};

/** The birthday window today is in, or null (the year's end included: 1 January in December). */
export function birthdayWindow(
  c: Pick<Customer, 'birthMonth' | 'birthDay'>,
  now: Date,
): BirthdayWindow | null {
  const b = validBirthday(c.birthMonth, c.birthDay);
  if (!b) return null;
  const today = startOfDay(now);
  for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
    const date = birthdayIn(year, b.month, b.day);
    const days = daysBetween(today, date);
    if (Math.abs(days) <= WINDOW_DAYS)
      return { date, from: addDays(date, -WINDOW_DAYS), to: addDays(date, WINDOW_DAYS), days };
  }
  return null;
}

/** This birthday window if today is in it, else the next one (for the message sent ahead). */
export function nextWindow(
  c: Pick<Customer, 'birthMonth' | 'birthDay'>,
  now: Date,
): BirthdayWindow | null {
  const b = validBirthday(c.birthMonth, c.birthDay);
  if (!b) return null;
  const today = startOfDay(now);
  for (const year of [today.getFullYear() - 1, today.getFullYear(), today.getFullYear() + 1]) {
    const date = birthdayIn(year, b.month, b.day);
    const to = addDays(date, WINDOW_DAYS);
    if (to >= today)
      return { date, from: addDays(date, -WINDOW_DAYS), to, days: daysBetween(today, date) };
  }
  return null;
}

export type BirthdayStatus = BirthdayWindow & {
  /** Already used this year (on a sale not fully returned). */
  used: boolean;
  /** The birthday was saved less than 30 days before it: the owner approves. */
  needsOwner: boolean;
};

/**
 * The customer's birthday discount today, or null when there is none to show: off, no birthday,
 * no phone number, or not in the birthday week.
 */
export function birthdayStatus(
  ctx: Ctx,
  customerId: number | null | undefined,
  rules: BirthdayRules = getBirthday(ctx),
): BirthdayStatus | null {
  if (!customerId || !birthdayOn(rules)) return null;
  const c = getCustomer(ctx, customerId);
  if (!c || !phoneKey(c.phone)) return null;
  const w = birthdayWindow(c, ctx.now());
  if (!w) return null;
  const used = birthdayUsed(ctx, customerId);
  // By the day: saved on the 1st for a birthday on the 31st is 30 days before.
  const needsOwner =
    !!c.birthdaySetAt &&
    c.birthdaySetAt.slice(0, 10) > timestamp(addDays(w.date, -NOTICE_DAYS)).slice(0, 10);
  return { ...w, used, needsOwner };
}

/** Used on a sale (not fully returned) in the last 330 days: not again yet. */
export function birthdayUsed(ctx: Ctx, customerId: number): boolean {
  const since = timestamp(addDays(startOfDay(ctx.now()), -ONCE_DAYS));
  return customerSales(ctx, customerId).some(
    (s) => s.birthdayOff > 0 && !s.fullyReturned && s.createdAt >= since,
  );
}

/** "17 نوفمبر": the last day of the window. */
export const windowEnd = (w: BirthdayWindow) =>
  birthdayText(w.to.getMonth() + 1, w.to.getDate()) ?? '';
/** "من 11 إلى 17 نوفمبر" / "من 30 ديسمبر إلى 5 يناير". */
export function windowText(w: BirthdayWindow): string {
  const from = birthdayText(w.from.getMonth() + 1, w.from.getDate()) ?? '';
  const to = windowEnd(w);
  return w.from.getMonth() === w.to.getMonth()
    ? `من ${w.from.getDate()} إلى ${to}`
    : `من ${from} إلى ${to}`;
}
