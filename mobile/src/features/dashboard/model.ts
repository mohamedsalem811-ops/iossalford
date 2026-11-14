/**
 * The dashboard's figures, read in one go, and the pure rules that shape them (tested): which
 * months can be chosen, ranked rows with bars, the daily chart's bars, cash against credit.
 */
import { copyOverdueDays, copyReminder } from '@/backup/model';
import { PAYMENT_LABELS, type PaymentMethod } from '@/domain/checkout';
import { ownerAlerts, type OwnerAlert } from '@/domain/alerts';
import type { Ctx } from '@/domain/context';
import { allBalances } from '@/domain/debts';
import {
  breakdown,
  dailySales,
  lowStock,
  stockBySize,
  stockSummary,
  summary,
  today,
  topProducts,
  type BreakdownRow,
  type PeriodSummary,
  type Today,
} from '@/domain/reports';
import { listSales, saleMonths, type Sale } from '@/domain/sales';
import { getRate } from '@/domain/settings';
import { addMonths, monthKey, type MonthKey } from '@/lib/dates';
import { healthProblem } from '@/db/health';

/** Months the picker offers: this month and every month with sales, newest first (24 at most). */
export function monthChoices(withSales: MonthKey[], now: Date, max = 24): MonthKey[] {
  return [...new Set([monthKey(now), ...withSales])].sort().reverse().slice(0, max);
}

export type RankedRow = { key: string; total: number; quantity: number; share: number };

/**
 * The first `limit` rows, each with its share of the largest (for the bar), and the rest added up
 * as "أخرى" so the list's total stays right.
 */
export function ranked(
  rows: Pick<BreakdownRow, 'key' | 'total' | 'quantity'>[],
  limit = 6,
  other = 'أخرى',
): RankedRow[] {
  const sorted = [...rows].filter((r) => r.total > 0).sort((a, b) => b.total - a.total);
  const top = sorted.slice(0, limit);
  const rest = sorted.slice(limit);
  if (rest.length)
    top.push({
      key: other,
      total: rest.reduce((t, r) => t + r.total, 0),
      quantity: rest.reduce((t, r) => t + r.quantity, 0),
    });
  const max = Math.max(1, ...top.map((r) => r.total));
  return top.map((r) => ({ ...r, key: r.key || 'بدون', share: r.total / max }));
}

/** Each day's bar as a share of the best day (0 to 1), and which day was the best. */
export function chartBars(days: { day: number; total: number }[]) {
  const max = Math.max(0, ...days.map((d) => d.total));
  return {
    bars: days.map((d) => ({ ...d, share: max > 0 ? d.total / max : 0 })),
    best: max > 0 ? days.find((d) => d.total === max)!.day : null,
    total: days.reduce((t, d) => t + d.total, 0),
  };
}

/** Today's money: paid now (cash, card, transfer) and on credit (آجل). */
export function cashVsCredit(byMethod: Record<PaymentMethod, number>) {
  return { paid: byMethod.cash + byMethod.card + byMethod.transfer, credit: byMethod.credit };
}

export type DashboardData = {
  date: Date;
  rate: number;
  today: Today;
  month: MonthKey;
  months: MonthKey[];
  summary: PeriodSummary;
  /** The month before, for the dot on each tile. */
  previous: PeriodSummary;
  daily: { day: number; total: number }[];
  attention: {
    low: { id: number; name: string; size: string | null; stock: number }[];
    lowCount: number;
    outCount: number;
    owed: number;
    debtors: number;
    /** Days since a copy left the device, once 7 or more (null before), and the line under it. */
    backupReminder: { days: number; text: string } | null;
    /** The weekly check found a problem in the database file. */
    dataProblem: boolean;
    /** The owner's alerts not seen yet (phase S6). */
    alerts: OwnerAlert[];
  };
  byCategory: RankedRow[];
  byBrand: RankedRow[];
  byPayment: RankedRow[];
  /** Scarves: sales and stock per size. */
  bySize: (RankedRow & { stock: number })[];
  top: RankedRow[];
  /** Sales per person (the owner, each employee). */
  bySeller: RankedRow[];
  latest: Sale[];
  stock: ReturnType<typeof stockSummary>;
};

function backupReminder(lastCopied: Date | null, now: Date, firstBackup: Date | null) {
  const days = copyOverdueDays(lastCopied, now, firstBackup);
  const text = copyReminder(lastCopied, now, firstBackup);
  return days === null || text === null ? null : { days, text };
}

export function readDashboard(
  ctx: Ctx,
  month: MonthKey,
  backup: { lastCopied: Date | null; firstBackup: Date | null },
): DashboardData {
  const now = ctx.now();
  const stock = stockSummary(ctx);
  const balances = [...allBalances(ctx).values()].filter((b) => b > 0);
  const sizeStock = new Map(stockBySize(ctx).map((s) => [s.size, s.pieces]));
  return {
    date: now,
    rate: getRate(ctx),
    today: today(ctx),
    month,
    months: monthChoices(saleMonths(ctx), now),
    summary: summary(ctx, [month]),
    previous: summary(ctx, [addMonths(month, -1)]),
    daily: dailySales(ctx, month),
    attention: {
      low: lowStock(ctx),
      lowCount: stock.low,
      outCount: stock.out,
      owed: balances.reduce((t, b) => t + b, 0),
      debtors: balances.length,
      backupReminder: backupReminder(backup.lastCopied, now, backup.firstBackup),
      dataProblem: healthProblem(ctx.db) !== null,
      alerts: ownerAlerts(ctx),
    },
    byCategory: ranked(breakdown(ctx, [month], 'category')),
    byBrand: ranked(breakdown(ctx, [month], 'brand')),
    byPayment: ranked(
      breakdown(ctx, [month], 'payment').map((r) => ({
        ...r,
        key: PAYMENT_LABELS[r.key as PaymentMethod] ?? r.key,
      })),
    ),
    bySize:
      ctx.system === 'scarves'
        ? ranked(breakdown(ctx, [month], 'size'), 8).map((r) => ({
            ...r,
            stock: sizeStock.get(r.key) ?? 0,
          }))
        : [],
    top: ranked(topProducts(ctx, [month], 5), 5),
    bySeller: ranked(breakdown(ctx, [month], 'seller')),
    latest: listSales(ctx, {}, { limit: 5 }),
    stock,
  };
}
