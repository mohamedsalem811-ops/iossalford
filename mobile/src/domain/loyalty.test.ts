/**
 * Loyalty points (feature 34, phase F3): off until the owner turns them on; earned on money paid,
 * on a credit sale only as it is paid; paying part of a cash or card sale as its own line; a
 * return taking back its share; the owner's adjustments, logged.
 */
import { receiptDoc } from '@/features/receipts/model';
import { receiptHtml, receiptMoney } from '@/receipts/templates/html';

import { listActivity } from './activity';
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { PermissionError, RuleError } from './context';
import { saveCustomer } from './customers';
import { daySummary } from './day-summary';
import { deleteCustomer, deletePayment, recordPayment } from './debts';
import {
  adjustPoints,
  DEFAULT_LOYALTY,
  getLoyalty,
  loyaltyMoves,
  pointsBalance,
  redeemable,
  setLoyalty,
} from './loyalty';
import { getProduct, saveProduct } from './products';
import { getReceipt } from './receipts';
import { addReturn, deleteSale, getSale, maxRefund } from './sales';
import { openShift, openShiftOf, shiftTotals } from './shifts';
import { getPolicies } from './policies';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let huda: number;
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 10 });
  huda = saveCustomer(ctx, { name: 'هدى', phone: '0912345678' });
});
afterEach(() => ctx.close());

const cart = (price = 1_000_000, qty = 1): CartLine[] => {
  const p = getProduct(ctx, ring)!;
  if (p.price !== price) saveProduct(ctx, { ...p, id: ring, brand: p.brand, price });
  return (addToCart([], getProduct(ctx, ring)!, 'Ring', qty) as { cart: CartLine[] }).cart;
};
const sell = (method: 'cash' | 'credit' = 'cash', points = 0, price = 1_000_000) =>
  checkout(ctx, {
    cart: cart(price),
    paymentMethod: method,
    customer: { name: 'هدى', phone: '0912345678' },
    points,
  });
const answers = () => Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true]));
const returnAll = (saleId: number) => {
  const line = getSale(ctx, saleId)!.lines[0];
  return addReturn(ctx, { saleLineId: line.id, quantity: 1, photo: 'p.jpg', answers: answers() });
};

describe('switched off', () => {
  it('starts off: nothing is earned and points pay nothing', () => {
    expect(getLoyalty(ctx)).toEqual(DEFAULT_LOYALTY);
    expect(getLoyalty(ctx).enabled).toBe(false);
    sell();
    expect(pointsBalance(ctx, huda)).toBe(0);
    expect(redeemable(ctx, huda, 1_000_000)).toBeNull();
    expect(() => sell('cash', 10)).toThrow('متوقفة');
  });
});

describe('switched on', () => {
  beforeEach(() => {
    // One point per 10 dinars, a point pays 0.1 dinar, from 100 points, up to half a sale.
    setLoyalty(ctx, { enabled: true });
  });

  it('checks the rules and logs each change', () => {
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toContain('نقطة لكل 10 د.ل');
    expect(() => setLoyalty(ctx, { maxShare: 0 })).toThrow(RuleError);
    expect(() => setLoyalty(ctx, { maxShare: 101 })).toThrow(RuleError);
    expect(() => setLoyalty(ctx, { spendPerPoint: 0 })).toThrow(RuleError);
    expect(() => setLoyalty(ctx, { pointValue: 1.5 })).toThrow(RuleError);
    ctx.setActor(EMPLOYEE);
    expect(() => setLoyalty(ctx, { enabled: false })).toThrow(PermissionError);
  });

  it('earns on a cash sale, rounded down, for a registered customer only', () => {
    sell('cash', 0, 1_005_000); // 1005 dinars → 100 points
    expect(pointsBalance(ctx, huda)).toBe(100);
    checkout(ctx, { cart: cart(), paymentMethod: 'cash' }); // no customer
    expect(pointsBalance(ctx, huda)).toBe(100);
  });

  it('pays part of a sale as its own line, then earns on the money paid', () => {
    sell(); // 100 points
    expect(redeemable(ctx, huda, 300_000)).toEqual({ points: 100, value: 10_000, balance: 100 });
    const { saleId, receipt } = sell('cash', 100, 300_000);
    const sale = getSale(ctx, saleId)!;
    expect(sale).toMatchObject({ total: 300_000, pointsPaid: 10_000, discount: 0 });
    // 290 dinars paid in money → 29 points.
    expect(pointsBalance(ctx, huda)).toBe(29);
    expect(getReceipt(ctx, receipt.id)!.pointsPaid).toBe(10_000);
    const html = receiptHtml(receiptDoc(getReceipt(ctx, receipt.id)!));
    expect(html).toContain('مدفوع بالنقاط');
    expect(html).toContain(`${receiptMoney(290_000)} LYD`);
    // The drawer only counts money; the day shows what points paid.
    const day = daySummary(ctx, sale.createdAt.slice(0, 10));
    expect(day.byMethod.cash).toBe(1_000_000 + 290_000);
    expect(day.points).toEqual({ paid: 10_000, earned: 129, redeemed: 100 });
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toContain('مدفوع بالنقاط 10 د.ل');
  });

  it('refuses too many points, too few, no customer, or a credit sale', () => {
    sell(); // 100 points
    expect(() => sell('cash', 101, 300_000)).toThrow('100 نقطة على الأكثر');
    expect(() => sell('credit', 100, 300_000)).toThrow('الآجل');
    expect(() => checkout(ctx, { cart: cart(300_000), paymentMethod: 'cash', points: 50 })).toThrow(
      'زبون مسجل',
    );
    setLoyalty(ctx, { minRedeem: 500 });
    expect(redeemable(ctx, huda, 300_000)).toBeNull();
    expect(() => sell('cash', 100, 300_000)).toThrow('لا تكفي');
    expect(pointsBalance(ctx, huda)).toBe(100);
  });

  it('earns on a credit sale only as the debt is paid', () => {
    sell('credit');
    expect(pointsBalance(ctx, huda)).toBe(0);
    const p1 = recordPayment(ctx, { customerId: huda, amount: 400_000, method: 'cash' });
    expect(pointsBalance(ctx, huda)).toBe(40);
    recordPayment(ctx, { customerId: huda, amount: 600_000, method: 'cash' });
    expect(pointsBalance(ctx, huda)).toBe(100);
    // A payment deleted takes its points with it.
    deletePayment(ctx, p1);
    expect(pointsBalance(ctx, huda)).toBe(60);
  });

  it('a return takes back its share of the points earned', () => {
    const { saleId } = sell();
    expect(pointsBalance(ctx, huda)).toBe(100);
    returnAll(saleId);
    expect(pointsBalance(ctx, huda)).toBe(0);
    expect(loyaltyMoves(ctx, huda)[0]).toMatchObject({ kind: 'reverse', points: -100 });
  });

  it('a return of a sale paid partly with points gives those points back, and less money', () => {
    sell(); // 100 points
    const { saleId } = sell('cash', 100, 300_000); // −100, +29
    const line = getSale(ctx, saleId)!.lines[0];
    expect(maxRefund(line, 1)).toBe(290_000);
    const ret = returnAll(saleId);
    expect(
      ctx.db.get<{ refund: number }>('SELECT refund FROM returns WHERE id = ?', [ret])?.refund,
    ).toBe(290_000);
    // The 100 points come back, the 29 earned on it go.
    expect(pointsBalance(ctx, huda)).toBe(100);
  });

  it('never takes back points already spent below zero', () => {
    const first = sell(); // 100
    sell('cash', 100, 300_000); // spends them, earns 29
    returnAll(first.saleId);
    expect(pointsBalance(ctx, huda)).toBe(0);
  });

  it('a deleted sale takes its points with it', () => {
    const { saleId } = sell();
    deleteSale(ctx, saleId);
    expect(pointsBalance(ctx, huda)).toBe(0);
  });

  it('the shift counts only the money', () => {
    sell(); // 100 points, before the shift
    saveProduct(ctx, { ...getProduct(ctx, ring)!, id: ring, price: 300_000 });
    ctx.setActor(EMPLOYEE);
    // makeCtx opens a shift for the employee.
    const shift = openShiftOf(ctx) ?? { id: openShift(ctx, 0), openingCash: 0 };
    sell('cash', 0, 300_000); // 300 in money
    sell('cash', 100, 300_000); // 290 in money
    expect(shiftTotals(ctx, shift).byMethod.cash).toBe(590_000);
  });

  it('the owner adjusts a balance with a reason, logged; an employee may not', () => {
    adjustPoints(ctx, huda, 50, 'هدية عيد');
    expect(pointsBalance(ctx, huda)).toBe(50);
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toBe('إضافة 50 نقطة لـ «هدى»: هدية عيد');
    expect(() => adjustPoints(ctx, huda, -51, 'x')).toThrow('50 نقطة فقط');
    expect(() => adjustPoints(ctx, huda, 5, ' ')).toThrow('سبب');
    adjustPoints(ctx, huda, -20, 'تصحيح');
    expect(pointsBalance(ctx, huda)).toBe(30);
    ctx.setActor(EMPLOYEE);
    expect(() => adjustPoints(ctx, huda, 5, 'x')).toThrow(PermissionError);
  });

  it('a customer with points is not deleted; with none, the history goes too', () => {
    const lone = saveCustomer(ctx, { name: 'منى' });
    adjustPoints(ctx, lone, 10, 'هدية');
    expect(() => deleteCustomer(ctx, lone)).toThrow('10 نقطة');
    adjustPoints(ctx, lone, -10, 'تصحيح');
    deleteCustomer(ctx, lone);
    expect(ctx.db.all('SELECT * FROM loyalty_moves WHERE customer_id = ?', [lone])).toEqual([]);
  });
});
