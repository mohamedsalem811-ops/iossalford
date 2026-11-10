import { barShares, checkExpense, monthWindow, recentQuarters } from './model';

describe('money model', () => {
  it('checks an expense, Arabic digits too', () => {
    expect(checkExpense('إيجار', '١٥٠٠')).toEqual({ ok: true, amount: 1_500_000 });
    expect(checkExpense(' ', '10')).toEqual({ ok: false, message: 'اكتب وصف المصروف' });
    expect(checkExpense('إيجار', '0')).toEqual({ ok: false, message: 'أدخل مبلغ المصروف' });
  });

  it('lists the current quarter and the ones before it, across years', () => {
    expect(recentQuarters(new Date(2026, 1, 10), 3)).toEqual([
      { year: 2026, quarter: 1 },
      { year: 2025, quarter: 4 },
      { year: 2025, quarter: 3 },
    ]);
  });

  it('gives the window of the last months, oldest first', () => {
    expect(monthWindow(new Date(2026, 1, 10), 6)).toEqual({ from: '2025-09', to: '2026-02' });
    expect(monthWindow(new Date(2026, 10, 1), 1)).toEqual({ from: '2026-11', to: '2026-11' });
  });

  it('sizes bars by the largest value, losses too', () => {
    expect(barShares([100, 50, -25, 0])).toEqual([1, 0.5, 0.25, 0]);
    expect(barShares([0, 0])).toEqual([0, 0]);
  });
});
