/**
 * Profit by brand, category and piece (J4): from the price and cost each sale kept, after returns,
 * for a month, a quarter or a year; owner only. The brands add up to the sales profit of the
 * month summary.
 */
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { PermissionError } from './context';
import { getProduct, saveProduct } from './products';
import { periodMonths, periodTitle, profitRows, profitTotals, type ProfitPeriod } from './profits';
import { summary } from './reports';
import { addReturn, getSale } from './sales';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let chain: number;
let earring: number;
beforeEach(() => {
  ctx = makeCtx('jewelry', new Date(2026, 10, 10, 10));
  ring = saveProduct(ctx, {
    name: 'خاتم',
    brand: 'لازوردي',
    category: 'خواتم',
    price: 100_000,
    cost: 40_000,
    stock: 20,
  });
  chain = saveProduct(ctx, {
    name: 'سلسلة',
    brand: 'لازوردي',
    category: 'سلاسل',
    price: 50_000,
    cost: 30_000,
    stock: 20,
  });
  earring = saveProduct(ctx, {
    name: 'حلق',
    brand: 'سواروفسكي',
    category: 'أقراط',
    price: 200_000,
    cost: 50_000,
    stock: 20,
  });
});
afterEach(() => ctx.close());

const sell = (id: number, qty = 1) => {
  const p = getProduct(ctx, id)!;
  const cart = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: 'cash' }).saleId;
};
const NOV: ProfitPeriod = { kind: 'month', key: '2026-11' };

describe('profit by brand', () => {
  it('shows each brand’s sales, pieces, cost, profit and margin, by profit', () => {
    sell(ring, 2);
    sell(chain);
    sell(earring);
    const rows = profitRows(ctx, periodMonths(NOV));
    expect(rows.map((r) => r.key)).toEqual(['سواروفسكي', 'لازوردي']);
    expect(rows[1]).toMatchObject({
      label: 'لازوردي',
      netSales: 250_000,
      pieces: 3,
      cost: 110_000,
      profit: 140_000,
      margin: 56,
    });
    expect(rows[0]).toMatchObject({ netSales: 200_000, profit: 150_000, margin: 75 });
  });

  it('sorts by margin when asked', () => {
    sell(ring, 10);
    sell(earring);
    const byProfit = profitRows(ctx, periodMonths(NOV));
    const byMargin = profitRows(ctx, periodMonths(NOV), {}, 'margin');
    expect(byProfit[0].key).toBe('لازوردي');
    expect(byMargin[0].key).toBe('سواروفسكي');
  });

  it('takes returns off: the refund from the sales, the returned cost from the cost', () => {
    const saleId = sell(ring, 2);
    addReturn(ctx, {
      ...passing(ctx),
      saleLineId: getSale(ctx, saleId)!.lines[0].id,
      quantity: 1,
    });
    const [row] = profitRows(ctx, periodMonths(NOV));
    expect(row).toMatchObject({
      sales: 200_000,
      refunds: 100_000,
      netSales: 100_000,
      pieces: 1,
      cost: 40_000,
      profit: 60_000,
    });
  });

  it('keeps the past: a later cost or brand change does not change it', () => {
    sell(ring);
    saveProduct(ctx, { ...getProduct(ctx, ring)!, cost: 90_000, brand: 'تيفاني' });
    expect(profitRows(ctx, periodMonths(NOV))[0]).toMatchObject({
      key: 'لازوردي',
      profit: 60_000,
    });
  });

  it('adds up to the sales profit of the month summary', () => {
    sell(ring, 3);
    sell(chain, 2);
    const saleId = sell(earring, 2);
    addReturn(ctx, {
      ...passing(ctx),
      saleLineId: getSale(ctx, saleId)!.lines[0].id,
      quantity: 1,
    });
    const total = profitTotals(profitRows(ctx, periodMonths(NOV)));
    const s = summary(ctx, ['2026-11']);
    expect(total.profit).toBe(s.grossProfit - (s.refunds - s.returnedCost));
    expect(total.netSales).toBe(s.netSales);
  });
});

describe('opening a brand, then a category', () => {
  it('lists a brand’s categories, and a category’s pieces', () => {
    sell(ring, 2);
    sell(chain);
    const cats = profitRows(ctx, periodMonths(NOV), { brand: 'لازوردي' });
    expect(cats.map((r) => [r.key, r.profit])).toEqual([
      ['خواتم', 120_000],
      ['سلاسل', 20_000],
    ]);
    const pieces = profitRows(ctx, periodMonths(NOV), { brand: 'لازوردي', category: 'خواتم' });
    expect(pieces).toEqual([
      expect.objectContaining({ label: 'خاتم', productId: ring, pieces: 2, profit: 120_000 }),
    ]);
  });
});

describe('the period', () => {
  it('is a month, a quarter or a year', () => {
    expect(periodMonths({ kind: 'quarter', key: '2026-Q4' })).toEqual([
      '2026-10',
      '2026-11',
      '2026-12',
    ]);
    expect(periodMonths({ kind: 'year', key: '2026' })).toHaveLength(12);
    expect(periodTitle({ kind: 'year', key: '2026' })).toBe('سنة 2026');
    expect(periodTitle({ kind: 'quarter', key: '2026-Q4' })).toBe('الربع الرابع 2026');
  });

  it('counts only the sales in it', () => {
    sell(ring);
    ctx.setNow(new Date(2026, 11, 2, 10));
    sell(ring);
    expect(profitTotals(profitRows(ctx, periodMonths(NOV))).pieces).toBe(1);
    expect(
      profitTotals(profitRows(ctx, periodMonths({ kind: 'quarter', key: '2026-Q4' }))).pieces,
    ).toBe(2);
  });
});

it('is the owner’s only', () => {
  ctx.setActor(EMPLOYEE);
  expect(() => profitRows(ctx, periodMonths(NOV))).toThrow(PermissionError);
});
