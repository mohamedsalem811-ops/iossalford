/**
 * "Today" on the home screen and the sales list's one-day filter (J1, from the full check): a
 * day is a time range on the sale's time, read with the index, not every sale ever made.
 */
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { getProduct, saveProduct } from './products';
import { today } from './reports';
import { listSales } from './sales';
import { makeCtx, type TestCtx } from './testing/ctx';
import { nextDayKey } from '@/lib/dates';

let ctx: TestCtx;
let ring: number;
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 100 });
});
afterEach(() => ctx.close());

const sellAt = (at: Date) => {
  ctx.setNow(at);
  const cart = (addToCart([], getProduct(ctx, ring)!, 'Ring', 1) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: 'cash' }).saleId;
};

/** Every query a call runs, with how SQLite reads it. */
function plans(run: () => void) {
  const seen: string[] = [];
  const db = ctx.db as unknown as Record<string, (...a: unknown[]) => unknown>;
  const spies = (['get', 'all'] as const).map((m) => {
    const real = db[m].bind(ctx.db);
    return jest.spyOn(ctx.db, m).mockImplementation(((sql: string, params?: unknown[]) => {
      if (/FROM sales/.test(sql) && !sql.startsWith('EXPLAIN'))
        seen.push(
          (ctx.db.all as (s: string, p?: unknown[]) => { detail: string }[])(
            `EXPLAIN QUERY PLAN ${sql}`,
            params,
          )
            .map((r) => r.detail)
            .join(' | '),
        );
      return real(sql, params);
    }) as never);
  });
  try {
    run();
  } finally {
    spies.forEach((s) => s.mockRestore());
  }
  return seen;
}

describe('a day of sales', () => {
  it('counts from midnight to the last second, not the next day', () => {
    sellAt(new Date(2026, 10, 16, 23, 59, 59));
    sellAt(new Date(2026, 10, 17, 0, 0, 0));
    sellAt(new Date(2026, 10, 17, 23, 59, 59));
    sellAt(new Date(2026, 10, 18, 0, 0, 0));
    ctx.setNow(new Date(2026, 10, 17, 12));
    expect(today(ctx)).toMatchObject({ sales: 2, pieces: 2, total: 2_000_000 });
    expect(listSales(ctx, { day: '2026-11-17' })).toHaveLength(2);
    expect(listSales(ctx, { day: '2026-11-16' })).toHaveLength(1);
  });

  it('reads the day with the index on the sale time', () => {
    sellAt(new Date(2026, 10, 17, 10));
    const readsEverySale = (p: string) => /SCAN s(ales)?\b(?! USING)/.test(p);
    const home = plans(() => today(ctx));
    expect(home.length).toBeGreaterThan(0);
    expect(home.filter(readsEverySale)).toEqual([]);
    const list = plans(() => listSales(ctx, { day: '2026-11-17' }));
    expect(list.some((p) => p.includes('sales_created'))).toBe(true);
  });

  it('knows the next day across a month and a year', () => {
    expect(nextDayKey('2026-11-17')).toBe('2026-11-18');
    expect(nextDayKey('2026-11-30')).toBe('2026-12-01');
    expect(nextDayKey('2026-12-31')).toBe('2027-01-01');
    expect(nextDayKey('2028-02-28')).toBe('2028-02-29');
  });
});
