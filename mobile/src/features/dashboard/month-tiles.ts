import type { PeriodSummary } from '@/domain/reports';
import { formatDinars, formatUsd } from '@/lib/money';

/** Compared with the month before: better (green dot), worse (red) or nothing to compare (grey). */
export type Trend = 'better' | 'worse' | 'same';

export type MonthTile = {
  key: 'net-sales' | 'profit' | 'out' | 'net-profit';
  label: string;
  /** The big amount, in dirhams. */
  value: number;
  /** The small gold line under it. */
  sub: string;
  tone: 'accent' | 'positive' | 'negative';
  trend: Trend;
};

/** More is better (sales, profit), or less is better (expenses and refunds). */
function trend(now: number, before: number | undefined, lessIsBetter = false): Trend {
  if (before === undefined || now === before) return 'same';
  return now > before !== lessIsBetter ? 'better' : 'worse';
}

/** "الهامش 43٪": sales profit as a share of sales, rounded. */
export const marginPercent = (s: Pick<PeriodSummary, 'grossProfit' | 'grossSales'>) =>
  s.grossSales > 0 ? Math.round((s.grossProfit / s.grossSales) * 100) : 0;

/**
 * The four tiles of "ملخص الشهر", in reading order (right to left, then down): net sales, sales
 * profit, expenses and refunds, net profit. `previous` is the month before (null: nothing to
 * compare, every dot grey).
 */
export function monthTiles(
  s: PeriodSummary,
  previous: PeriodSummary | null,
  piece: string,
): MonthTile[] {
  const out = s.expenses + s.refunds;
  return [
    {
      key: 'net-sales',
      label: 'صافي المبيعات',
      value: s.netSales,
      sub: `${s.transactions} عملية • ${s.itemsSold} ${piece}`,
      tone: 'accent',
      trend: trend(s.netSales, previous?.netSales),
    },
    {
      key: 'profit',
      label: 'ربح المبيعات',
      value: s.grossProfit,
      sub: `الهامش ${marginPercent(s)}٪`,
      tone: 'positive',
      trend: trend(s.grossProfit, previous?.grossProfit),
    },
    {
      key: 'out',
      label: 'المصاريف والمرتجعات',
      value: out,
      sub: `مصاريف ${formatDinars(s.expenses)} • مرتجعات ${formatDinars(s.refunds)}`,
      tone: 'negative',
      trend: trend(out, previous ? previous.expenses + previous.refunds : undefined, true),
    },
    {
      key: 'net-profit',
      label: 'صافي الربح',
      value: s.netProfit,
      sub: formatUsd(s.netProfitUsd),
      tone: s.netProfit < 0 ? 'negative' : 'positive',
      trend: trend(s.netProfit, previous?.netProfit),
    },
  ];
}

export const TREND_WORDS: Record<Trend, string> = {
  better: 'أفضل من الشهر الماضي',
  worse: 'أسوأ من الشهر الماضي',
  same: 'لا تغيير عن الشهر الماضي',
};
