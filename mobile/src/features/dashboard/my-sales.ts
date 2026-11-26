/**
 * An employee's home screen figures: only their own sales (the sales queries already show an
 * employee nothing else), and never cost, profit or the shop's totals.
 */
import type { Ctx } from '@/domain/context';
import { listSales, salesSummary, type Sale } from '@/domain/sales';
import { getRate } from '@/domain/settings';
import { getPolicies } from '@/domain/policies';
import { openShiftOf, shiftTotals } from '@/domain/shifts';
import { employeeStatement } from '@/domain/staff-ledger';
import { myGoal, type MyGoal, type Person } from '@/domain/staff-goals';
import { actorKey } from '@/staff/model';
import { dayKey, monthKey } from '@/lib/dates';

export type MySales = {
  date: Date;
  rate: number;
  today: { count: number; total: number };
  month: { count: number; total: number };
  latest: Sale[];
  /** What they owe on their account (returns charged to them, less repayments). */
  owed: number;
  /** Selling needs an open shift (phase S5). */
  shiftOpen: boolean;
  /** The open shift, for the shift bar (I3). */
  shift: ShiftBar | null;
  /** Their target, the ranking and the bonus on slow pieces (phase L). */
  goal: MyGoal | null;
};

export type ShiftBar = {
  openedAt: string;
  /** Sales in the shift. Never the expected cash: the count at closing is blind (S5). */
  sales: number;
  /** Past the owner's reminder hour: time to count the drawer and close. */
  closeNow: boolean;
};

/** Past the owner's hour (0: never), on the day the shift is running or any later day. */
export function closeReminder(openedAt: string, now: Date, hour: number): boolean {
  if (!hour) return false;
  if (dayKey(now) > openedAt.slice(0, 10)) return true;
  return now.getHours() >= hour;
}

function shiftBar(ctx: Ctx): ShiftBar | null {
  const open = ctx.actor ? openShiftOf(ctx, actorKey(ctx.actor)) : undefined;
  if (!open) return null;
  const t = shiftTotals(ctx, open);
  return {
    openedAt: open.openedAt,
    sales: t.sales,
    closeNow: closeReminder(open.openedAt, ctx.now(), getPolicies(ctx).shiftReminderHour),
  };
}

/** `people`: the employees of this system, for the ranking. */
export function readMySales(ctx: Ctx, people: Person[] = []): MySales {
  const now = ctx.now();
  return {
    date: now,
    rate: getRate(ctx),
    today: salesSummary(ctx, { day: dayKey(now) }),
    month: salesSummary(ctx, { month: monthKey(now) }),
    latest: listSales(ctx, {}, { limit: 5 }),
    owed: ctx.actor ? employeeStatement(ctx, actorKey(ctx.actor)).balance : 0,
    shiftOpen: ctx.actor ? !!openShiftOf(ctx, actorKey(ctx.actor)) : false,
    shift: shiftBar(ctx),
    goal: myGoal(ctx, people),
  };
}
