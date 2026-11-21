/**
 * Reminders on the device while the app is closed (J6): local notifications only, scheduled on
 * the iPad for the coming week (no internet, no Apple push service). This module holds the
 * owner's choices and works out what to schedule; `features/notifications` hands it to iOS.
 *
 * Each morning at the owner's time: repairs and orders due that day, late, or ready and not
 * collected; gift dates a week ahead; birthdays that day; the off-device backup once it is due.
 * While a shift is open: each closing time of the week, and once the morning after it was left
 * open past closing. One reminder per kind per day (the shift: its morning one too), naming three people at
 * most (or only counting them, when the owner hides names on the lock screen). Never a phone.
 * What is planned for later days assumes nothing changes; the app plans again every time it
 * goes to the background and after each change.
 */
import { copyOverdueDays, copyReminderTitle } from '@/backup/model';
import { dayKey } from '@/lib/dates';

import { logAction } from './activity';
import { allow, RuleError, type Ctx } from './context';
import { birthdaysThisWeek } from './customer-care';
import { giftReminders } from './marketing';
import { orderReminders, ordersDueOn } from './orders';
import { repairReminders } from './repairs';
import { getSetting, setSetting } from './settings';

export const NOTIFY_KINDS = ['repairs', 'orders', 'gifts', 'birthdays', 'shift', 'backup'] as const;
export type NotifyKind = (typeof NOTIFY_KINDS)[number];

export const NOTIFY_LABELS: Record<NotifyKind, string> = {
  repairs: 'الصيانة: موعدها، المتأخرة، الجاهزة ولم تُستلم',
  orders: 'الطلبيات: موعد وصولها، المتأخرة، الواصلة ولم تُستلم',
  gifts: 'مواعيد الهدايا قبلها بأسبوع',
  birthdays: 'أعياد الميلاد صباح اليوم',
  shift: 'وردية ما زالت مفتوحة عند الإغلاق',
  backup: 'النسخ الاحتياطي خارج الجهاز',
};

export type NotifyRules = {
  on: Record<NotifyKind, boolean>;
  /** The morning reminders' time. */
  hour: number;
  minute: number;
  /** The shop's closing time, for an open shift. */
  closeHour: number;
  closeMinute: number;
  /** Count people on the lock screen instead of naming them. */
  hideNames: boolean;
};

export const DEFAULT_NOTIFY: NotifyRules = {
  on: { repairs: true, orders: true, gifts: true, birthdays: true, shift: true, backup: true },
  hour: 9,
  minute: 0,
  closeHour: 21,
  closeMinute: 30,
  // Names stay off the lock screen until the owner chooses to show them (audit 3).
  hideNames: true,
};

const KEY = 'notify';

export function getNotifyRules(ctx: Ctx): NotifyRules {
  const raw = getSetting(ctx, KEY);
  if (!raw) return DEFAULT_NOTIFY;
  try {
    const saved = JSON.parse(raw) as Partial<NotifyRules>;
    return { ...DEFAULT_NOTIFY, ...saved, on: { ...DEFAULT_NOTIFY.on, ...saved.on } };
  } catch {
    return DEFAULT_NOTIFY;
  }
}

const whole = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max;

/** The owner's choices; logged. */
export function setNotifyRules(ctx: Ctx, changes: Partial<NotifyRules>): NotifyRules {
  allow(ctx, 'settings.edit');
  const old = getNotifyRules(ctx);
  const next: NotifyRules = { ...old, ...changes, on: { ...old.on, ...changes.on } };
  if (!whole(next.hour, 0, 23) || !whole(next.minute, 0, 59))
    throw new RuleError('وقت التنبيهات غير صحيح');
  if (!whole(next.closeHour, 0, 23) || !whole(next.closeMinute, 0, 59))
    throw new RuleError('وقت الإغلاق غير صحيح');
  return ctx.db.transaction(() => {
    setSetting(ctx, KEY, JSON.stringify(next));
    logAction(ctx, 'settings.notify', 'تعديل التنبيهات', { ...next });
    return next;
  });
}

export type PlannedReminder = {
  /** "jewelry-repairs-2026-11-19": one per system, kind and day. */
  id: string;
  kind: NotifyKind;
  at: Date;
  title: string;
  body: string;
};

/** When a copy last left the device, and the first backup (backup/store). */
export type BackupDates = { lastCopied: Date | null; firstBackup: Date | null };

const DAYS = 7;
const SYSTEM_NAMES: Record<Ctx['system'], string> = { jewelry: 'المجوهرات', scarves: 'الأوشحة' };
const MAX = 60;

/** "منى، سلمى، هدى و2 غيرهن", or "5" when names are hidden. */
function people(names: string[], hide: boolean): string {
  if (hide) return String(names.length);
  const shown = names.slice(0, 3).join('، ');
  return names.length > 3 ? `${shown} و${names.length - 3} غيرهن` : shown;
}

/** "موعدها اليوم: منى • متأخرة: سلمى", leaving out empty parts. */
function parts(list: [string, string[]][], hide: boolean): string {
  return list
    .filter(([, names]) => names.length > 0)
    .map(([label, names]) => `${label}: ${people(names, hide)}`)
    .join(' • ');
}

/** What to schedule for the coming week, the soonest first. */
export function planReminders(ctx: Ctx, backup: BackupDates): PlannedReminder[] {
  const rules = getNotifyRules(ctx);
  const now = ctx.now();
  const hide = rules.hideNames;
  const out: PlannedReminder[] = [];
  const add = (kind: NotifyKind, at: Date, title: string, body: string, tag: string = kind) => {
    if (body && at.getTime() > now.getTime())
      out.push({
        id: `${ctx.system}-${tag}-${dayKey(at)}`,
        kind,
        at,
        // Both systems remind on the same iPad: which one it is.
        title: `${title} • ${SYSTEM_NAMES[ctx.system]}`,
        body,
      });
  };
  let backupWasDue = false;

  for (let i = 0; i < DAYS; i++) {
    const at = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() + i,
      rules.hour,
      rules.minute,
    );
    const day = dayKey(at);
    // The domain's own reminders, read as on that morning.
    const then: Ctx = { ...ctx, now: () => at };

    if (rules.on.repairs) {
      const r = repairReminders(then);
      add(
        'repairs',
        at,
        'الصيانة',
        parts(
          [
            ['موعدها اليوم', r.dueToday.map((x) => x.customerName)],
            ['متأخرة', r.late.map((x) => x.customerName)],
            ['جاهزة ولم تُستلم', r.waiting.map((x) => x.customerName)],
          ],
          hide,
        ),
      );
    }
    if (rules.on.orders) {
      const r = orderReminders(then);
      add(
        'orders',
        at,
        'الطلبيات',
        parts(
          [
            ['موعد وصولها اليوم', ordersDueOn(then, day).map((x) => x.customerName)],
            ['متأخرة عن موعدها', r.late.map((x) => x.customerName)],
            ['وصلت ولم تُستلم', r.waiting.map((x) => x.customerName)],
          ],
          hide,
        ),
      );
    }
    if (rules.on.gifts) {
      // Today all the gifts of the coming week; after that, each a week before its date.
      const gifts = giftReminders(then).filter((g) => i === 0 || g.days === 7);
      add(
        'gifts',
        at,
        'هدايا الأسبوع القادم',
        hide
          ? gifts.length
            ? `العدد: ${gifts.length}`
            : ''
          : gifts.map((g) => `${g.customerName}: ${g.occasion ?? g.forWhom}`).join(' • '),
      );
    }
    if (rules.on.birthdays) {
      const today = birthdaysThisWeek(then).filter((b) => b.days === 0);
      add(
        'birthdays',
        at,
        'أعياد الميلاد اليوم',
        today.length
          ? hide
            ? `العدد: ${today.length}`
            : people(
                today.map((b) => b.customer.name),
                false,
              )
          : '',
      );
    }
    if (rules.on.backup) {
      // Once: the first morning still to come that the off-device copy is due.
      const days = copyOverdueDays(backup.lastCopied, at, backup.firstBackup);
      if (days !== null && !backupWasDue && at.getTime() > now.getTime()) {
        add(
          'backup',
          at,
          'النسخ الاحتياطي',
          `${copyReminderTitle(days)}. انسخ نسخة إلى الجهاز الآخر أو إلى كمبيوتر.`,
        );
        backupWasDue = true;
      }
    }
  }

  if (rules.on.shift) {
    // The oldest shift still open (the owner's and an employee's can both be).
    const open = ctx.db.get<{ opened_at: string | null }>(
      'SELECT min(opened_at) opened_at FROM shifts WHERE closed_at IS NULL',
    );
    if (open?.opened_at) {
      const opened = new Date(open.opened_at);
      const closing = (d: Date, plus: number) =>
        new Date(
          d.getFullYear(),
          d.getMonth(),
          d.getDate() + plus,
          rules.closeHour,
          rules.closeMinute,
        );
      // Each closing time of the week while it stays open.
      for (let i = 0; i < DAYS; i++)
        add(
          'shift',
          closing(now, i),
          'الوردية ما زالت مفتوحة',
          'أغلق الوردية وعُدّ الصندوق قبل المغادرة.',
        );
      // Once, the morning after the first closing time it was left open past.
      const firstClosing = closing(opened, closing(opened, 0) > opened ? 0 : 1);
      const morning = new Date(
        firstClosing.getFullYear(),
        firstClosing.getMonth(),
        firstClosing.getDate() + 1,
        rules.hour,
        rules.minute,
      );
      add(
        'shift',
        morning,
        'وردية أمس ما زالت مفتوحة',
        'أغلق الوردية وعُدّ الصندوق.',
        'shift-morning',
      );
    }
  }

  return out.sort((a, b) => a.at.getTime() - b.at.getTime()).slice(0, MAX);
}
