/**
 * @jest-environment node
 *
 * The end-of-day summary: one day's sales, returns, payments, cash and shifts, from the records.
 */
import { addToCart, type CartLine } from './cart';
import { checkout, type PaymentMethod } from './checkout';
import { PermissionError, type Ctx } from './context';
import { daySummary, nextDay, previousDay } from './day-summary';
import { recordPayment } from './debts';
import { addExpense } from './expenses';
import { displayName, getProduct, saveProduct } from './products';
import { addReturn, getSale } from './sales';
import { addCashMove, closeShift, openShift } from './shifts';
import { listCustomers } from './customers';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';
import { OWNER } from '@/staff/model';

const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0, 0);

function sell(ctx: Ctx, productId: number, method: PaymentMethod, customer?: string) {
  const p = getProduct(ctx, productId)!;
  const cart = (addToCart([], p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart;
  return checkout(ctx, {
    cart,
    paymentMethod: method,
    customer: customer ? { name: customer, phone: '0917777777' } : undefined,
  }).saleId;
}

describe('the end-of-day summary', () => {
  let ctx: TestCtx;
  beforeEach(() => {
    ctx = makeCtx('jewelry', at(12, 9), { autoShift: false });
  });
  afterEach(() => ctx.close());

  it('adds up one day: sales by method and person, returns, payments, cash and the shift count', () => {
    const ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 350_000, stock: 9 });
    const chain = saveProduct(ctx, { name: 'سلسلة', category: 'سلاسل', price: 200_000, stock: 9 });
    const set = saveProduct(ctx, { name: 'طقم', category: 'أطقم', price: 500_000, stock: 9 });
    // The day before: not counted.
    sell(ctx, ring, 'cash');

    // The day: Sara opens her shift with 50, sells a ring in cash and a chain by card.
    ctx.setNow(at(13, 9));
    ctx.setActor(EMPLOYEE);
    openShift(ctx, 50_000);
    ctx.setNow(at(13, 10));
    sell(ctx, ring, 'cash');
    ctx.setNow(at(13, 11));
    const card = sell(ctx, chain, 'card');
    // The owner sells on credit and takes a payment in cash, without a shift.
    ctx.setActor(OWNER);
    ctx.setNow(at(13, 12));
    sell(ctx, set, 'credit', 'هدى');
    ctx.setNow(at(13, 13));
    const huda = listCustomers(ctx).find((c) => c.name === 'هدى')!.id;
    recordPayment(ctx, { customerId: huda, amount: 100_000, method: 'cash' });
    addExpense(ctx, { description: 'كهرباء', amount: 30_000 });
    // Sara takes back the chain (refunded from the drawer) and takes 20 out for coffee.
    ctx.setActor(EMPLOYEE);
    ctx.setNow(at(13, 14));
    addReturn(ctx, { ...passing(ctx), saleLineId: getSale(ctx, card)!.lines[0].id, quantity: 1 });
    addCashMove(ctx, 'out', 20_000, 'قهوة');
    // She counts 170; the drawer should hold 50 + 350 − 200 − 20 = 180: 10 short.
    ctx.setNow(at(13, 18));
    closeShift(ctx, 170_000);
    // The next day: not counted.
    ctx.setNow(at(14, 10));
    ctx.setActor(OWNER);
    sell(ctx, ring, 'transfer');

    const d = daySummary(ctx, '2026-11-13');
    expect(d).toMatchObject({
      day: '2026-11-13',
      sales: 3,
      pieces: 3,
      total: 1_050_000,
      byMethod: { cash: 350_000, card: 200_000, transfer: 0, credit: 500_000 },
      bySeller: [
        { name: 'سارة', sales: 2, total: 550_000 },
        { name: 'المالك', sales: 1, total: 500_000 },
      ],
      returns: 1,
      refunded: 200_000,
      cashRefunds: 200_000,
      payments: { cash: 100_000, other: 0 },
      payouts: { cash: 0, other: 0 },
      cashIn: 0,
      cashOut: 20_000,
      expenses: 30_000,
      // 350 cash sales + 100 debt payment − 200 refund − 20 out.
      cashNet: 230_000,
      shortages: 10_000,
      extras: 0,
    });
    expect(d.shifts).toHaveLength(1);
    expect(d.shifts[0].shift).toMatchObject({ personName: 'سارة', expectedCash: 180_000 });
    expect(d.shifts[0].totals.sales).toBe(2);

    // A day with nothing: zeros, no shifts.
    expect(daySummary(ctx, '2026-11-10')).toMatchObject({ sales: 0, total: 0, shifts: [] });
  });

  it('lists a shift still open, and one opened the day before', () => {
    ctx.setActor(EMPLOYEE);
    ctx.setNow(at(12, 20));
    openShift(ctx, 10_000);
    ctx.setActor(OWNER);
    expect(daySummary(ctx, '2026-11-13').shifts.map((s) => s.shift.closedAt)).toEqual([null]);
    expect(daySummary(ctx, '2026-11-11').shifts).toEqual([]);
  });

  it('is for the owner only', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => daySummary(ctx, '2026-11-13')).toThrow(PermissionError);
  });

  it('moves a day at a time across months and years', () => {
    expect(nextDay('2026-11-30')).toBe('2026-12-01');
    expect(nextDay('2026-12-31')).toBe('2027-01-01');
    expect(previousDay('2026-01-01')).toBe('2025-12-31');
    expect(previousDay('2028-03-01')).toBe('2028-02-29');
  });
});
