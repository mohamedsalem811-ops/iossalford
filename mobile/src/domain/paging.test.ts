/**
 * Long lists are read a page at a time: every page together gives exactly what one full read
 * gives (same sales, same lines, same order), and the counts, totals and months come from quick
 * queries that never read the rows.
 */
import { addToCart, type CartLine } from './cart';
import { checkout, type PaymentMethod } from './checkout';
import { saveCustomer } from './customers';
import { allBalances, balance, recordPayment } from './debts';
import { displayName, getProduct, saveProduct } from './products';
import { countReceipts, listReceipts, receiptMonths } from './receipts';
import {
  listReturns,
  listSales,
  addReturn,
  returnMonths,
  returnsSummary,
  saleMonths,
  salesSummary,
} from './sales';
import { makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;

function sell(ids: number[], method: PaymentMethod = 'cash') {
  let cart: CartLine[] = [];
  for (const id of ids) {
    const p = getProduct(ctx, id)!;
    const r = addToCart(cart, p, displayName(ctx, p), 1);
    if ('problem' in r) throw new Error('stock');
    cart = r.cart;
  }
  return checkout(ctx, {
    cart,
    paymentMethod: method,
    customer: method === 'credit' ? { name: 'سارة' } : undefined,
  });
}

beforeEach(() => {
  ctx = makeCtx('jewelry', new Date(2026, 8, 1, 10, 0));
  const a = saveProduct(ctx, {
    name: 'خاتم',
    brand: 'Pandora',
    category: 'خواتم',
    price: 100_000,
    cost: 50_000,
    stock: 500,
  });
  const b = saveProduct(ctx, {
    name: 'قلادة',
    brand: 'Swarovski',
    category: 'قلادات',
    price: 250_000,
    cost: 100_000,
    stock: 500,
  });
  // 3 months, 25 sales each, some with two lines, some on credit.
  for (let m = 0; m < 3; m++) {
    for (let i = 0; i < 25; i++) {
      ctx.setNow(new Date(2026, 8 + m, 1 + i, 12, 0));
      sell(i % 3 === 0 ? [a, b] : [a], i % 5 === 0 ? 'credit' : 'cash');
    }
  }
});
afterEach(() => ctx.close());

const readAll = <T>(read: (limit: number, offset: number) => T[], size: number) => {
  const all: T[] = [];
  for (let offset = 0; ; offset += size) {
    const page = read(size, offset);
    all.push(...page);
    if (page.length < size) return all;
  }
};

describe('sales history, a page at a time', () => {
  it('gives the same sales and lines as one full read, newest first', () => {
    const full = listSales(ctx);
    const paged = readAll((limit, offset) => listSales(ctx, {}, { limit, offset }), 7);
    expect(paged).toEqual(full);
    expect(full).toHaveLength(75);
    expect(full[0].id).toBeGreaterThan(full[1].id);
    expect(full.find((s) => s.lines.length === 2)).toBeTruthy();
  });

  it('pages a filtered list too', () => {
    const q = { month: '2026-10', paymentMethod: 'credit' as const };
    expect(readAll((limit, offset) => listSales(ctx, q, { limit, offset }), 2)).toEqual(
      listSales(ctx, q),
    );
  });

  it('counts and totals without reading the sales', () => {
    const all = listSales(ctx);
    expect(salesSummary(ctx)).toEqual({
      count: 75,
      total: all.reduce((t, s) => t + s.total, 0),
    });
    const credit = listSales(ctx, { paymentMethod: 'credit' });
    expect(salesSummary(ctx, { paymentMethod: 'credit' })).toEqual({
      count: credit.length,
      total: credit.reduce((t, s) => t + s.total, 0),
    });
  });

  it('lists the months with sales, newest first', () => {
    expect(saleMonths(ctx)).toEqual(['2026-11', '2026-10', '2026-09']);
  });

  it('never accepts anything but whole numbers as a page', () => {
    expect(listSales(ctx, {}, { limit: 2.7, offset: -3 })).toHaveLength(2);
  });
});

describe('receipts, a page at a time', () => {
  it('gives the same receipts and items as one full read, and counts them', () => {
    const full = listReceipts(ctx);
    expect(readAll((limit, offset) => listReceipts(ctx, {}, { limit, offset }), 10)).toEqual(full);
    expect(countReceipts(ctx)).toBe(75);
    expect(countReceipts(ctx, { month: '2026-09' })).toBe(25);
    expect(receiptMonths(ctx)).toEqual(['2026-11', '2026-10', '2026-09']);
    expect(full.find((r) => r.items.length === 2)).toBeTruthy();
  });
});

describe('returns, a page at a time', () => {
  it('gives the same returns as one full read, with count, total and months', () => {
    const sales = listSales(ctx);
    for (const s of sales.slice(0, 12)) {
      ctx.setNow(new Date(s.createdAt));
      addReturn(ctx, { saleLineId: s.lines[0].id, quantity: 1, refund: 10_000 });
    }
    expect(readAll((limit, offset) => listReturns(ctx, undefined, { limit, offset }), 5)).toEqual(
      listReturns(ctx),
    );
    expect(returnsSummary(ctx)).toEqual({ count: 12, total: 120_000 });
    expect(returnMonths(ctx)).toEqual(['2026-11']);
  });
});

describe('balances for lists, in one query', () => {
  it('match the balance of each customer, payments and refunds included', () => {
    const credit = listSales(ctx, { paymentMethod: 'credit' });
    addReturn(ctx, { saleLineId: credit[0].lines[0].id, quantity: 1, refund: 30_000 });
    const sara = credit[0].customerId!;
    recordPayment(ctx, { customerId: sara, amount: 50_000, method: 'cash' });
    const other = saveCustomer(ctx, { name: 'هدى', phone: '0911111111' });
    const all = allBalances(ctx);
    for (const id of [sara, other]) expect(all.get(id) ?? 0).toBe(balance(ctx, id));
    expect(all.has(other)).toBe(false);
  });
});
