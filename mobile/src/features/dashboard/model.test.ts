import { cashVsCredit, chartBars, monthChoices, ranked } from './model';

describe('the dashboard rules', () => {
  it('offers this month and every month with sales, newest first', () => {
    const now = new Date(2026, 10, 12);
    expect(monthChoices(['2026-09', '2026-10'], now)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(monthChoices([], now)).toEqual(['2026-11']);
    const many = Array.from(
      { length: 40 },
      (_, i) => `20${23 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, '0')}`,
    );
    expect(monthChoices(many, now)).toHaveLength(24);
  });

  it('ranks rows with bars, and adds the rest up as "أخرى" so the total stays right', () => {
    const rows = [
      { key: 'A', total: 100, quantity: 1 },
      { key: 'B', total: 400, quantity: 4 },
      { key: 'C', total: 50, quantity: 2 },
      { key: 'D', total: 25, quantity: 1 },
      { key: '', total: 200, quantity: 2 },
      { key: 'zero', total: 0, quantity: 0 },
    ];
    const r = ranked(rows, 3);
    expect(r.map((x) => [x.key, x.total, x.share])).toEqual([
      ['B', 400, 1],
      ['بدون', 200, 0.5],
      ['A', 100, 0.25],
      ['أخرى', 75, 0.1875],
    ]);
    expect(r.reduce((t, x) => t + x.total, 0)).toBe(775);
  });

  it("draws each day as a share of the best day, and knows the month's total", () => {
    const { bars, best, total } = chartBars([
      { day: 1, total: 0 },
      { day: 2, total: 500 },
      { day: 3, total: 250 },
    ]);
    expect(bars.map((b) => b.share)).toEqual([0, 1, 0.5]);
    expect(best).toBe(2);
    expect(total).toBe(750);
    expect(chartBars([{ day: 1, total: 0 }]).best).toBeNull();
  });

  it('puts cash, card and transfer together against credit', () => {
    expect(cashVsCredit({ cash: 10, card: 5, transfer: 1, credit: 7 })).toEqual({
      paid: 16,
      credit: 7,
    });
  });
});
