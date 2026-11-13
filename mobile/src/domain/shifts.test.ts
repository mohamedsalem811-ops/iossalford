/**
 * @jest-environment node
 *
 * Shifts and the cash count (phase S5): selling only inside a shift (employees), cash in and out,
 * what should be in the drawer, the shortage in the person's name and on their account.
 */
import { OWNER } from '@/staff/model';

import { listActivity } from './activity';
import { addToCart, type CartLine } from './cart';
import { checkout, type PaymentMethod } from './checkout';
import { PermissionError } from './context';
import { recordPayment } from './debts';
import { getProduct, saveProduct } from './products';
import { addReturn, getSale } from './sales';
import {
  addCashMove,
  chargeShortage,
  closeShift,
  getShift,
  listShifts,
  NO_SHIFT,
  openShift,
  openShiftOf,
  shiftForReport,
  shiftTotals,
} from './shifts';
import { employeeStatement } from './staff-ledger';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
beforeEach(() => {
  ctx = makeCtx('jewelry', undefined, { autoShift: false });
  ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 100_000, stock: 20 });
});
afterEach(() => ctx.close());

function sell(method: PaymentMethod, qty = 1, customer?: { name: string; phone: string }) {
  const p = getProduct(ctx, ring)!;
  const cart = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: method, customer }).saleId;
}

describe('opening', () => {
  it('lets an employee sell, take returns and payments only inside an open shift', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => sell('cash')).toThrow(NO_SHIFT);
    openShift(ctx, 50_000);
    expect(() => openShift(ctx, 0)).toThrow('مفتوحة بالفعل');
    const saleId = sell('cash');
    expect(ctx.db.get('SELECT shift_id FROM sales WHERE id = ?', [saleId])).toEqual({
      shift_id: openShiftOf(ctx)!.id,
    });
  });

  it('lets the owner sell without a shift', () => {
    expect(() => sell('cash')).not.toThrow();
    expect(openShiftOf(ctx)).toBeUndefined();
  });

  it('refuses a wrong opening amount, and cash moves outside a shift', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => openShift(ctx, -1)).toThrow('النقد');
    expect(() => addCashMove(ctx, 'in', 1_000, 'فكة')).toThrow(NO_SHIFT);
    openShift(ctx, 0);
    expect(() => addCashMove(ctx, 'out', 1_000, ' ')).toThrow('سبب');
    expect(() => addCashMove(ctx, 'out', 0, 'مورّد')).toThrow('أكبر من صفر');
  });
});

describe('a full shift', () => {
  it('counts what should be in the drawer: the plan’s check, 5 د.ل short', () => {
    // A credit sale before the shift, paid back in cash during it.
    const credit = sell('credit', 1, { name: 'منى', phone: '0912345678' });
    const customerId = getSale(ctx, credit)!.customerId!;
    ctx.setActor(EMPLOYEE);
    const id = openShift(ctx, 50_000);
    const cash = sell('cash', 2); // +200
    sell('card'); // card: not in the drawer
    addReturn(ctx, {
      ...passing(ctx),
      saleLineId: getSale(ctx, cash)!.lines[0].id,
      quantity: 1,
    }); // −100 in cash
    recordPayment(ctx, { customerId, amount: 30_000, method: 'cash' }); // +30
    addCashMove(ctx, 'in', 20_000, 'فكة'); // +20
    addCashMove(ctx, 'out', 15_000, 'مورّد'); // −15
    const totals = shiftTotals(ctx, getShift(ctx, id)!);
    expect(totals).toMatchObject({
      byMethod: { cash: 200_000, card: 100_000, transfer: 0, credit: 0 },
      sales: 2,
      returns: 1,
      cashRefunds: 100_000,
      cashPayments: 30_000,
      expected: 50_000 + 200_000 + 30_000 + 20_000 - 15_000 - 100_000,
    });
    const closed = closeShift(ctx, 180_000);
    expect(closed).toMatchObject({ expected: 185_000, counted: 180_000, difference: -5_000 });
    expect(openShiftOf(ctx)).toBeUndefined();
    expect(() => sell('cash')).toThrow(NO_SHIFT);
    expect(listActivity(ctxOwner(), {}, { limit: 1 })[0].summary).toBe(
      'إغلاق وردية سارة: المعدود 180 د.ل، المتوقع 185 د.ل، عجز 5 د.ل',
    );

    // The owner puts the shortage on her account, once.
    chargeShortage(ctx, id);
    expect(() => chargeShortage(ctx, id)).toThrow('بالفعل');
    expect(employeeStatement(ctx, 'emp-e1')).toMatchObject({ balance: 5_000 });
  });

  it('does not count a credit sale’s return as cash given back', () => {
    ctx.setActor(EMPLOYEE);
    const id = openShift(ctx, 0);
    const credit = sell('credit', 1, { name: 'منى', phone: '0912345678' });
    addReturn(ctx, {
      ...passing(ctx),
      saleLineId: getSale(ctx, credit)!.lines[0].id,
      quantity: 1,
    });
    expect(shiftTotals(ctx, getShift(ctx, id)!)).toMatchObject({ cashRefunds: 0, expected: 0 });
  });

  it('refuses a charge when there is no shortage', () => {
    ctx.setActor(EMPLOYEE);
    const id = openShift(ctx, 10_000);
    closeShift(ctx, 12_000);
    expect(getShift(ctx, id)!.difference).toBe(2_000);
    ctx.setActor(OWNER);
    expect(() => chargeShortage(ctx, id)).toThrow('لا يوجد عجز');
  });
});

describe('who sees and closes', () => {
  it('lets the owner close a shift an employee left open', () => {
    ctx.setActor(EMPLOYEE);
    const id = openShift(ctx, 10_000);
    ctx.setActor(OWNER);
    expect(() => closeShift(ctx, 10_000)).toThrow('لا توجد وردية مفتوحة');
    closeShift(ctx, 10_000, { shiftId: id });
    expect(getShift(ctx, id)).toMatchObject({ difference: 0, closedByName: 'المالك' });
  });

  it('keeps others’ shifts from an employee', () => {
    const owners = openShift(ctx, 0);
    ctx.setActor(EMPLOYEE);
    const hers = openShift(ctx, 0);
    expect(() => closeShift(ctx, 0, { shiftId: owners })).toThrow(PermissionError);
    expect(shiftForReport(ctx, hers)?.id).toBe(hers);
    expect(() => shiftForReport(ctx, owners)).toThrow(PermissionError);
    expect(() => listShifts(ctx)).toThrow(PermissionError);
    ctx.setActor(OWNER);
    expect(listShifts(ctx).map((s) => s.id)).toEqual([hers, owners]);
  });
});

function ctxOwner() {
  ctx.setActor(OWNER);
  return ctx;
}
