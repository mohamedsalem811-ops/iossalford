/**
 * An employee's home screen figures: only their own sales (the sales queries already show an
 * employee nothing else), and never cost, profit or the shop's totals.
 */
import type { Ctx } from '@/domain/context';
import { listSales, salesSummary, type Sale } from '@/domain/sales';
import { getRate } from '@/domain/settings';
import { dayKey, monthKey } from '@/lib/dates';

export type MySales = {
  date: Date;
  rate: number;
  today: { count: number; total: number };
  month: { count: number; total: number };
  latest: Sale[];
};

export function readMySales(ctx: Ctx): MySales {
  const now = ctx.now();
  return {
    date: now,
    rate: getRate(ctx),
    today: salesSummary(ctx, { day: dayKey(now) }),
    month: salesSummary(ctx, { month: monthKey(now) }),
    latest: listSales(ctx, {}, { limit: 5 }),
  };
}
