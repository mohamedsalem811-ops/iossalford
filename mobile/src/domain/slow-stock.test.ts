/**
 * Slow-moving stock (J5): pieces in stock with no sale in 60, 90 or 180 days (or never sold
 * since they came in), how long, and the money tied up in them, by brand; owner only. A tap
 * changes the price, logged.
 */
import { listActivity } from './activity';
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { PermissionError, RuleError } from './context';
import { adjustStock, getProduct, saveProduct } from './products';
import { setProductPrice, slowStock } from './slow-stock';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let chain: number;
let earring: number;
let sold: number;
const day = (d: number) => new Date(2026, 0, d, 10);
beforeEach(() => {
  ctx = makeCtx('jewelry', day(1));
  ring = saveProduct(ctx, {
    name: 'خاتم',
    brand: 'لازوردي',
    category: 'خواتم',
    price: 100_000,
    cost: 40_000,
    stock: 3,
  });
  chain = saveProduct(ctx, {
    name: 'سلسلة',
    brand: 'لازوردي',
    category: 'سلاسل',
    price: 50_000,
    cost: 30_000,
    stock: 10,
  });
  earring = saveProduct(ctx, {
    name: 'حلق',
    brand: 'سواروفسكي',
    category: 'أقراط',
    price: 200_000,
    cost: 50_000,
    stock: 1,
  });
  sold = saveProduct(ctx, {
    name: 'أسورة',
    category: 'أساور',
    price: 80_000,
    cost: 20_000,
    stock: 1,
  });
});
afterEach(() => ctx.close());

const sell = (id: number, qty = 1) => {
  const p = getProduct(ctx, id)!;
  const cart = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: 'cash' }).saleId;
};

describe('the slow pieces', () => {
  it('lists pieces in stock unsold for the days asked, by the money tied up', () => {
    ctx.setNow(day(20));
    sell(ring); // sold on day 20: idle since then
    sell(sold); // sold out: not in the list
    ctx.setNow(new Date(2026, 3, 1, 10)); // 1 April: 90 days after 1 January
    const s = slowStock(ctx, 60);
    expect(s.rows.map((r) => r.name)).toEqual(['سلسلة', 'خاتم', 'حلق']);
    expect(s.rows[0]).toMatchObject({
      productId: chain,
      brand: 'لازوردي',
      stock: 10,
      tiedUp: 300_000,
      days: 90,
      lastSold: null,
    });
    expect(s.rows[1]).toMatchObject({ stock: 2, tiedUp: 80_000, days: 71 });
    expect(s.rows[1].lastSold).not.toBeNull();
    expect(slowStock(ctx, 90).rows.map((r) => r.name)).toEqual(['سلسلة', 'حلق']);
    expect(slowStock(ctx, 180).rows).toEqual([]);
  });

  it('adds up the money by brand, the largest first, and in all', () => {
    ctx.setNow(new Date(2026, 6, 1, 10));
    const s = slowStock(ctx, 180);
    expect(s.brands).toEqual([
      { brand: 'لازوردي', pieces: 13, items: 2, tiedUp: 420_000 },
      { brand: 'سواروفسكي', pieces: 1, items: 1, tiedUp: 50_000 },
      { brand: 'بدون ماركة', pieces: 1, items: 1, tiedUp: 20_000 },
    ]);
    expect(s.total).toEqual({ pieces: 15, items: 4, tiedUp: 490_000 });
  });

  it('counts a new delivery of stock as coming in again', () => {
    ctx.setNow(new Date(2026, 3, 1, 10));
    adjustStock(ctx, earring, 2, 'وصلت شحنة');
    expect(slowStock(ctx, 60).rows.map((r) => r.name)).not.toContain('حلق');
  });

  it('leaves out archived pieces', () => {
    ctx.setNow(new Date(2026, 3, 1, 10));
    saveProduct(ctx, { ...getProduct(ctx, chain)!, brand: 'لازوردي' });
    ctx.db.run('UPDATE products SET archived = 1 WHERE id = ?', [chain]);
    expect(slowStock(ctx, 60).rows.map((r) => r.name)).not.toContain('سلسلة');
  });

  it('is the owner’s only', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => slowStock(ctx, 60)).toThrow(PermissionError);
  });
});

describe('changing a slow piece’s price', () => {
  it('changes only the price, and logs the old and new price', () => {
    setProductPrice(ctx, chain, 40_000);
    expect(getProduct(ctx, chain)).toMatchObject({ price: 40_000, cost: 30_000, stock: 10 });
    const line = listActivity(ctx).find((l) => l.action === 'product.price')!;
    expect(line.summary).toContain('سلسلة');
    expect(line.details).toMatchObject({ productId: chain, from: 50_000, to: 40_000 });
  });

  it('refuses a price that is not a positive amount', () => {
    expect(() => setProductPrice(ctx, chain, 0)).toThrow(RuleError);
    expect(() => setProductPrice(ctx, chain, -5)).toThrow(RuleError);
  });

  it('needs the right to edit pieces', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => setProductPrice(ctx, chain, 40_000)).toThrow(PermissionError);
  });
});
