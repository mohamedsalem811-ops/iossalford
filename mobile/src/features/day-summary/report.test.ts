import type { DaySummary } from '@/domain/day-summary';

import { daySections, daySummaryHtml, dayTitle } from './report';

jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-file-system', () => ({}));

const quiet: DaySummary = {
  day: '2026-11-13',
  sales: 1,
  pieces: 1,
  total: 350_000,
  byMethod: { cash: 350_000, card: 0, transfer: 0, credit: 0 },
  points: { paid: 0, earned: 0, redeemed: 0 },
  bySeller: [{ name: 'المالك', sales: 1, total: 350_000 }],
  discounts: 0,
  rewards: { count: 0, off: 0 },
  birthdays: { count: 0, off: 0 },
  friends: { count: 0, off: 0 },
  offers: { count: 0, off: 0 },
  approvals: 0,
  returns: 0,
  refunded: 0,
  cashRefunds: 0,
  refundsBy: { cash: 0, card: 0, transfer: 0, balance: 0, debt: 0 },
  payments: { cash: 0, other: 0 },
  payouts: { cash: 0, other: 0 },
  deposits: { taken: { cash: 0, other: 0 }, refunded: { cash: 0, other: 0 }, used: 0, kept: 0 },
  cashIn: 0,
  cashOut: 0,
  expenses: 0,
  cashNet: 350_000,
  shifts: [],
  shortages: 0,
  extras: 0,
};

describe('the end-of-day page', () => {
  it('names the day in Arabic', () => {
    expect(dayTitle('2026-11-13')).toBe('الجمعة 13 نوفمبر 2026');
  });

  it('leaves out what did not happen, and shows what did', () => {
    const labels = daySections(quiet).flatMap((s) => s.rows.map((r) => r.label));
    expect(labels).not.toContain('الخصومات');
    expect(labels).not.toContain('عجز في العدّ');
    expect(daySections(quiet).map((s) => s.title)).toEqual(['المبيعات', 'النقد', 'أخرى']);
    const busy = daySections({
      ...quiet,
      discounts: 20_000,
      shortages: 5_000,
      bySeller: [...quiet.bySeller, { name: 'سارة', sales: 2, total: 100_000 }],
    });
    expect(busy.map((s) => s.title)).toContain('حسب البائع');
    expect(busy.flatMap((s) => s.rows)).toContainEqual({ label: 'عجز في العدّ', value: '−5 د.ل' });
  });

  it('says how the refunds went back, only the ways used (J2)', () => {
    const rows = daySections({
      ...quiet,
      returns: 2,
      refunded: 300_000,
      refundsBy: { cash: 0, card: 100_000, transfer: 0, balance: 200_000, debt: 0 },
    }).flatMap((s) => s.rows);
    expect(rows).toContainEqual({ label: '  منها بطاقة', value: '100 د.ل' });
    expect(rows).toContainEqual({ label: '  منها رصيد للزبون', value: '200 د.ل' });
    expect(rows.map((r) => r.label)).not.toContain('  منها كاش');
  });

  it('prints names safely', () => {
    const html = daySummaryHtml(
      { ...quiet, bySeller: [...quiet.bySeller, { name: '<b>x</b>', sales: 1, total: 1_000 }] },
      'SALFORD',
    );
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;');
    expect(html).toContain('لا ورديات في هذا اليوم');
  });
});
