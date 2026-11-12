import type { PeriodSummary } from '@/domain/reports';

import { marginPercent, monthTiles } from './month-tiles';

const month = (o: Partial<PeriodSummary>): PeriodSummary => ({
  grossSales: 0,
  costOfSales: 0,
  grossProfit: 0,
  refunds: 0,
  returnedCost: 0,
  expenses: 0,
  transactions: 0,
  itemsSold: 0,
  itemsReturned: 0,
  netSales: 0,
  netProfit: 0,
  grossSalesUsd: 0,
  grossProfitUsd: 0,
  netProfitUsd: 0,
  ...o,
});

describe('ملخص الشهر', () => {
  const now = month({
    grossSales: 1_000_000,
    grossProfit: 770_000,
    netSales: 1_000_000,
    expenses: 50_000,
    refunds: 0,
    netProfit: 720_000,
    transactions: 1,
    itemsSold: 1,
    netProfitUsd: 10_286,
  });

  it('shows the four tiles of the old app, in order, with their lines', () => {
    const t = monthTiles(now, null, 'قطعة');
    expect(t.map((x) => x.label)).toEqual([
      'صافي المبيعات',
      'ربح المبيعات',
      'المصاريف والمرتجعات',
      'صافي الربح',
    ]);
    expect(t[0].sub).toBe('1 عملية • 1 قطعة');
    expect(t[1].sub).toBe('الهامش 77٪');
    expect(t[2]).toMatchObject({ value: 50_000, sub: 'مصاريف 50 • مرتجعات 0', tone: 'negative' });
    expect(t[3]).toMatchObject({ value: 720_000, sub: '$102.86', tone: 'positive' });
    // Nothing to compare with: every dot grey.
    expect(t.every((x) => x.trend === 'same')).toBe(true);
  });

  it('dots compare with the month before; for expenses and refunds less is better', () => {
    const before = month({
      netSales: 2_000_000,
      grossProfit: 500_000,
      expenses: 80_000,
      netProfit: 720_000,
    });
    expect(monthTiles(now, before, 'قطعة').map((x) => x.trend)).toEqual([
      'worse', // sales went down
      'better', // profit went up
      'better', // spent less
      'same', // net profit unchanged
    ]);
  });

  it('a loss shows net profit in red; no sales means a 0٪ margin', () => {
    expect(monthTiles(month({ netProfit: -50_000 }), null, 'وشاح')[3].tone).toBe('negative');
    expect(marginPercent({ grossProfit: 0, grossSales: 0 })).toBe(0);
  });
});
