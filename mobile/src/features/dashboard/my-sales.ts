/**
 * An employee's home screen figures: only their own sales (the sales queries already show an
 * employee nothing else), and never cost, profit or the shop's totals.
 */
import type { Ctx } from '@/domain/context';
import { listSales, salesSummary, type Sale } from '@/domain/sales';
import { getRate } from '@/domain/settings';
import { employeeStatement } from '@/domain/staff-ledger';
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
};

export function readMySales(ctx: Ctx): MySales {
  const now = ctx.now();
  return {
    date: now,
    rate: getRate(ctx),
    today: salesSummary(ctx, { day: dayKey(now) }),
    month: salesSummary(ctx, { month: monthKey(now) }),
    latest: listSales(ctx, {}, { limit: 5 }),
    owed: ctx.actor ? employeeStatement(ctx, actorKey(ctx.actor)).balance : 0,
  };
}
