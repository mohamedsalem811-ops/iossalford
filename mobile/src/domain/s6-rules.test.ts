/**
 * @jest-environment node
 *
 * Phase S6: the owner's alerts (each one caused, with its limit, and hidden once seen) and the
 * blind stock count (the sheet shows no stock; the owner sees the differences and applies them
 * as "جرد" stock changes; sales during the count are not differences).
 */
import { OWNER } from '@/staff/model';

import { listActivity, recordClockBack, recordLogBroken, recordWrongPin } from './activity';
import { acknowledgeAlert, allAlerts, ownerAlerts } from './alerts';
import { addToCart, setUnitPrice, type CartLine } from './cart';
import { checkout } from './checkout';
import { PermissionError } from './context';
import { getPolicies, setPolicies } from './policies';
import { getProduct, saveProduct, stockHistory } from './products';
import { addReturn, getSale } from './sales';
import { closeShift } from './shifts';
import {
  applyCount,
  cancelCount,
  countPiece,
  countProgress,
  countResult,
  countSheet,
  listCounts,
  openCount,
  startCount,
  submitCount,
} from './stock-count';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let chain: number;
let granted: Set<string>;

beforeEach(() => {
  ctx = makeCtx();
  granted = new Set();
  ctx.approvals = { take: (t, p) => granted.delete(`${p}:${t}`) };
  ring = saveProduct(ctx, {
    name: 'خاتم',
    category: 'خواتم',
    price: 100_000,
    cost: 40_000,
    stock: 10,
  });
  chain = saveProduct(ctx, { name: 'سلسلة', category: 'سلاسل', price: 50_000, stock: 5 });
});
afterEach(() => ctx.close());

function cart(id: number, qty = 1, price?: number): CartLine[] {
  const p = getProduct(ctx, id)!;
  let c = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  if (price !== undefined) c = setUnitPrice(c, c[0].key, price);
  return c;
}

const kinds = () => ownerAlerts(ctx).map((a) => a.kind);
const at = (h: number, m = 0) => new Date(2026, 10, 9, h, m, 0);

describe('the owner’s alerts', () => {
  it('has limits in the rules, with defaults, and logs a change', () => {
    expect(getPolicies(ctx)).toMatchObject({
      alertDiscounts: 3,
      alertApprovals: 3,
      alertReturnMinutes: 30,
      alertWrongPins: 3,
      alertShortage: 0,
      alertDays: 7,
    });
    setPolicies(ctx, { alertDiscounts: 5 });
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toContain('تنبيه الخصومات 5');
    expect(() => setPolicies(ctx, { alertDays: 0 })).toThrow('مدة التنبيهات');
    expect(() => setPolicies(ctx, { alertWrongPins: -1 })).toThrow('حدود التنبيهات');
  });

  it('warns of many discounts by one employee in a day, not the owner’s', () => {
    setPolicies(ctx, { discountPerPiece: 50_000, discountPerSale: 50_000 });
    ctx.setActor(EMPLOYEE);
    for (let i = 0; i < 2; i++)
      checkout(ctx, { cart: cart(chain, 1, 45_000), paymentMethod: 'cash', discountReason: 'عرض' });
    ctx.setActor(OWNER);
    expect(kinds()).not.toContain('discounts');
    for (let i = 0; i < 3; i++)
      checkout(ctx, { cart: cart(chain, 1, 45_000), paymentMethod: 'cash' });
    expect(kinds()).not.toContain('discounts');
    ctx.setActor(EMPLOYEE);
    checkout(ctx, { cart: cart(ring, 1, 95_000), paymentMethod: 'cash', discountReason: 'عرض' });
    ctx.setActor(OWNER);
    const [a] = ownerAlerts(ctx).filter((x) => x.kind === 'discounts');
    expect(a.title).toBe('سارة: 3 مبيعات بخصم في يوم');
    expect(a.detail).toContain('15 د.ل');
  });

  it('warns of many approvals by one employee in a day', () => {
    setPolicies(ctx, { alertApprovals: 2 });
    ctx.setActor(EMPLOYEE);
    for (const t of ['a', 'b']) {
      granted.add(`discount:${t}`);
      checkout(ctx, {
        cart: cart(ring, 1, 90_000),
        paymentMethod: 'cash',
        discountReason: 'زبون دائم',
        approval: t,
      });
    }
    ctx.setActor(OWNER);
    expect(ownerAlerts(ctx).find((a) => a.kind === 'approvals')?.title).toBe(
      'سارة: 2 موافقات منك في يوم',
    );
  });

  it('warns of a return minutes after its sale, by an employee', () => {
    ctx.setActor(EMPLOYEE);
    ctx.setNow(at(10));
    const sale = checkout(ctx, { cart: cart(ring), paymentMethod: 'cash' }).saleId;
    const line = getSale(ctx, sale)!.lines[0].id;
    ctx.setNow(at(10, 12));
    const ret = addReturn(ctx, { ...passing(ctx), saleLineId: line, quantity: 1 });
    ctx.setActor(OWNER);
    const a = ownerAlerts(ctx).find((x) => x.kind === 'quickReturn')!;
    expect(a.title).toBe('مرتجع بعد 12 دقيقة من البيع');
    expect(a.target).toEqual({ screen: 'return', id: ret });
    // Past the limit: no alert.
    setPolicies(ctx, { alertReturnMinutes: 10 });
    expect(kinds()).not.toContain('quickReturn');
  });

  it('warns of repeated wrong PINs, a shortage, the clock and the log', () => {
    for (let i = 0; i < 3; i++) recordWrongPin(ctx, EMPLOYEE);
    ctx.setActor(EMPLOYEE);
    const shift = closeShift(ctx, 0, {}).shiftId;
    ctx.setActor(OWNER);
    expect(kinds()).not.toContain('shortage');
    // A shift 5 د.ل short (opening cash 5, nothing counted).
    ctx.db.run('UPDATE shifts SET expected_cash = 5000 WHERE id = ?', [shift]);
    recordClockBack(ctx, at(12), at(11));
    recordLogBroken(ctx, 4);
    expect(kinds().sort()).toEqual(['clock', 'log', 'shortage', 'wrongPins']);
    expect(ownerAlerts(ctx).find((a) => a.kind === 'shortage')).toMatchObject({
      title: 'عجز 5 د.ل في وردية سارة',
      target: { screen: 'shift', id: shift },
    });
    // A larger limit: no shortage alert.
    setPolicies(ctx, { alertShortage: 10_000 });
    expect(kinds()).not.toContain('shortage');
  });

  it('hides an alert once seen, logs it, and keeps the window', () => {
    for (let i = 0; i < 3; i++) recordWrongPin(ctx, EMPLOYEE);
    const [a] = ownerAlerts(ctx);
    acknowledgeAlert(ctx, a);
    expect(ownerAlerts(ctx)).toHaveLength(0);
    expect(allAlerts(ctx)).toHaveLength(1);
    expect(listActivity(ctx, {}, { limit: 1 })[0]).toMatchObject({ action: 'alert.seen' });
    // Eight days later it is out of the 7-day window.
    ctx.setNow(new Date(2026, 10, 17, 10));
    expect(allAlerts(ctx)).toHaveLength(0);
  });

  it('is the owner’s only', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => ownerAlerts(ctx)).toThrow(PermissionError);
    expect(() => acknowledgeAlert(ctx, { key: 'x', title: 'x' })).toThrow(PermissionError);
  });
});

describe('the stock count', () => {
  it('lets an employee count blind, and only the owner see and apply the differences', () => {
    ctx.setActor(EMPLOYEE);
    const id = startCount(ctx);
    expect(() => startCount(ctx)).toThrow('يوجد جرد جارٍ');
    const sheet = countSheet(ctx, id);
    expect(sheet.map((r) => r.name).sort()).toEqual(['خاتم', 'سلسلة']);
    // Blind: no stock on the sheet.
    for (const r of sheet) expect(Object.keys(r)).not.toContain('stock');
    countPiece(ctx, id, ring, 9);
    countPiece(ctx, id, ring, 8); // corrected
    expect(countSheet(ctx, id, 'خاتم')[0].counted).toBe(8);
    expect(countProgress(ctx, id)).toEqual({ counted: 1, total: 2 });
    expect(() => countResult(ctx, id)).toThrow(PermissionError);
    submitCount(ctx, id);
    expect(() => countPiece(ctx, id, chain, 5)).toThrow('أُرسل');
    expect(() => applyCount(ctx, id)).toThrow(PermissionError);

    ctx.setActor(OWNER);
    const r = countResult(ctx, id)!;
    expect(r.lines[0]).toMatchObject({ name: 'خاتم', expected: 10, counted: 8, difference: -2 });
    expect(r).toMatchObject({
      missingPieces: 2,
      extraPieces: 0,
      uncounted: 1,
      costDifference: -80_000,
    });
    expect(applyCount(ctx, id)).toEqual({ changed: 1, missing: 2, extra: 0 });
    expect(getProduct(ctx, ring)!.stock).toBe(8);
    expect(getProduct(ctx, chain)!.stock).toBe(5); // not counted: left as it was
    expect(stockHistory(ctx, ring)[0]).toMatchObject({
      delta: -2,
      kind: 'adjust',
      reason: `جرد رقم ${id}`,
    });
    expect(() => applyCount(ctx, id)).toThrow('طُبّق');
    expect(listCounts(ctx)[0]).toMatchObject({ id, status: 'applied', pieces: 1 });
  });

  it('does not count a sale made after the piece was counted as missing', () => {
    const id = startCount(ctx);
    countPiece(ctx, id, ring, 10); // all there
    checkout(ctx, { cart: cart(ring, 3), paymentMethod: 'cash' }); // 7 left
    submitCount(ctx, id);
    expect(countResult(ctx, id)!.lines[0].difference).toBe(0);
    applyCount(ctx, id);
    expect(getProduct(ctx, ring)!.stock).toBe(7);
  });

  it('never takes the stock below zero', () => {
    const id = startCount(ctx);
    countPiece(ctx, id, chain, 0); // 5 expected, 0 found
    checkout(ctx, { cart: cart(chain, 5), paymentMethod: 'cash' }); // all sold since
    submitCount(ctx, id);
    expect(applyCount(ctx, id)).toEqual({ changed: 0, missing: 0, extra: 0 });
    expect(getProduct(ctx, chain)!.stock).toBe(0);
  });

  it('refuses an empty count, wrong numbers, and lets the owner cancel', () => {
    const id = startCount(ctx);
    expect(() => submitCount(ctx, id)).toThrow('لم تُعدّ');
    expect(() => countPiece(ctx, id, ring, -1)).toThrow('عدد القطع');
    expect(() => countPiece(ctx, id, ring, 1.5)).toThrow('عدد القطع');
    cancelCount(ctx, id);
    expect(openCount(ctx)).toBeUndefined();
    expect(getProduct(ctx, ring)!.stock).toBe(10);
    expect(() => cancelCount(ctx, id)).toThrow('أُلغي');
    expect(listActivity(ctx, {}, { limit: 1 })[0]).toMatchObject({ action: 'count.cancel' });
  });
});
