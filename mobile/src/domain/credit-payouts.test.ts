/**
 * @jest-environment node
 *
 * Audit batch 3 (database 7): the shop's credit to a customer ("له رصيد") paid back (F-4), and
 * the indexes the owner's alerts use (F-5).
 */
import { OWNER } from '@/staff/model';

import { addToCart } from './cart';
import { checkout } from './checkout';
import {
  allBalances,
  balance,
  creditBalances,
  deleteCustomer,
  deletePayout,
  recordPayment,
  recordPayout,
  statement,
} from './debts';
import { getProduct, saveProduct } from './products';
import { addReturn, getSale } from './sales';
import { closeShift, getShift, openShift, shiftTotals } from './shifts';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let customer: number;
beforeEach(() => {
  ctx = makeCtx('jewelry');
  // Mona bought on credit, paid it all, then returned it: the shop owes her 350.
  const ring = getProduct(
    ctx,
    saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 350_000, cost: 1, stock: 5 }),
  )!;
  const r = addToCart([], ring, 'خاتم', 1);
  if (!('cart' in r)) throw new Error('cart');
  const sale = checkout(ctx, {
    cart: r.cart,
    paymentMethod: 'credit',
    customer: { name: 'منى', phone: '0912345678' },
  });
  customer = getSale(ctx, sale.saleId)!.customerId!;
  recordPayment(ctx, { customerId: customer, amount: 350_000, method: 'cash' });
  addReturn(ctx, {
    ...passing(ctx),
    saleLineId: getSale(ctx, sale.saleId)!.lines[0].id,
    quantity: 1,
  });
});
afterEach(() => ctx.close());

describe('F-4: paying back a customer’s credit', () => {
  it('pays part, then the rest, and the statement ends at zero', () => {
    expect(balance(ctx, customer)).toBe(-350_000);
    ctx.setNow(new Date(2026, 10, 9, 11, 0, 0));
    recordPayout(ctx, { customerId: customer, amount: 100_000, method: 'cash', note: 'نقداً' });
    expect(balance(ctx, customer)).toBe(-250_000);
    expect(allBalances(ctx).get(customer)).toBe(-250_000);
    recordPayout(ctx, { customerId: customer, amount: 250_000, method: 'transfer' });
    expect(balance(ctx, customer)).toBe(0);
    expect(creditBalances(ctx)).toEqual([]);
    const lines = statement(ctx, customer);
    // The sale, payment and return happened in the same minute; the payouts came later.
    expect(lines.slice(-2).map((l) => l.kind)).toEqual(['payout', 'payout']);
    expect(lines.map((l) => l.kind).sort()).toEqual([
      'payment',
      'payout',
      'payout',
      'refund',
      'sale',
    ]);
    expect(lines.at(-1)!.balance).toBe(0);
  });

  it('never pays back more than the shop owes, and not to someone who owes', () => {
    expect(() =>
      recordPayout(ctx, { customerId: customer, amount: 350_001, method: 'cash' }),
    ).toThrow('أكبر من رصيد الزبون');
    expect(() => recordPayout(ctx, { customerId: customer, amount: 0, method: 'cash' })).toThrow(
      'المبلغ المردود',
    );
  });

  it('is the owner’s, and a payout in cash comes out of the shift’s expected cash', () => {
    ctx.setActor(EMPLOYEE);
    expect(() =>
      recordPayout(ctx, { customerId: customer, amount: 1_000, method: 'cash' }),
    ).toThrow();
    ctx.setActor(OWNER);
    const shiftId = openShift(ctx, 500_000);
    recordPayout(ctx, { customerId: customer, amount: 100_000, method: 'cash' });
    recordPayout(ctx, { customerId: customer, amount: 50_000, method: 'card' });
    const t = shiftTotals(ctx, getShift(ctx, shiftId)!);
    expect(t.cashPayouts).toBe(100_000);
    expect(t.expected).toBe(400_000);
    expect(closeShift(ctx, 400_000).difference).toBe(0);
  });

  it('undoes a payout recorded by mistake, and keeps the customer while there are any', () => {
    const id = recordPayout(ctx, { customerId: customer, amount: 350_000, method: 'cash' });
    expect(balance(ctx, customer)).toBe(0);
    expect(() => deleteCustomer(ctx, customer)).toThrow('تعاملات آجلة');
    deletePayout(ctx, id);
    expect(balance(ctx, customer)).toBe(-350_000);
  });
});

describe('F-5: indexes for the alerts', () => {
  it('reads the last days of sales, returns and shifts by their time', () => {
    const plan = (sql: string) =>
      ctx.db
        .all<{ detail: string }>(`EXPLAIN QUERY PLAN ${sql}`, ['2026-11-01'])
        .map((r) => r.detail)
        .join(' ');
    expect(plan('SELECT * FROM sales WHERE created_at >= ?')).toContain('sales_created');
    expect(plan('SELECT * FROM returns WHERE created_at >= ?')).toContain('returns_created');
    expect(plan('SELECT * FROM shifts WHERE closed_at >= ?')).toContain('shifts_closed');
  });
});
