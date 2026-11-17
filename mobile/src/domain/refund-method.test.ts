/**
 * How a refund is paid back (J2): كاش، بطاقة، تحويل، or رصيد للزبونة; a return of a sale on credit
 * lowers her debt. Only cash refunds leave the drawer.
 */
import { listActivity } from './activity';
import { addToCart, type CartLine } from './cart';
import { checkout, type PaymentMethod } from './checkout';
import { daySummary } from './day-summary';
import { balance, statement } from './debts';
import { exchange } from './exchange';
import { getProduct, saveProduct } from './products';
import {
  addReturn,
  addReturnWithoutSale,
  getReturn,
  getSale,
  listReturns,
  returnsSummary,
} from './sales';
import { getShift, openShift, shiftTotals } from './shifts';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';
import { dayKey } from '@/lib/dates';
import { OWNER } from '@/staff/model';

let ctx: TestCtx;
let ring: number;
const HUDA = { name: 'هدى', phone: '0912345678' };
beforeEach(() => {
  ctx = makeCtx('jewelry', undefined, { autoShift: false });
  ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 100_000, stock: 20 });
});
afterEach(() => ctx.close());

const cart = (): CartLine[] =>
  (addToCart([], getProduct(ctx, ring)!, 'خاتم', 1) as { cart: CartLine[] }).cart;
const sell = (method: PaymentMethod, customer?: typeof HUDA) =>
  checkout(ctx, { cart: cart(), paymentMethod: method, customer }).saleId;
const lineOf = (saleId: number) => getSale(ctx, saleId)!.lines[0].id;
const giveBack = (saleId: number, refundMethod?: Parameters<typeof addReturn>[1]['refundMethod']) =>
  addReturn(ctx, { ...passing(ctx), saleLineId: lineOf(saleId), quantity: 1, refundMethod });

/** The employee's shift with its opening cash; returns its id. */
const shift = () => {
  ctx.setActor(EMPLOYEE);
  return openShift(ctx, 50_000);
};
const expected = (id: number) => shiftTotals(ctx, getShift(ctx, id)!).expected;

describe('the refund method', () => {
  it('starts on how the sale was paid', () => {
    shift();
    expect(getReturn(ctx, giveBack(sell('cash')))!.refundMethod).toBe('cash');
    expect(getReturn(ctx, giveBack(sell('card')))!.refundMethod).toBe('card');
    expect(getReturn(ctx, giveBack(sell('transfer')))!.refundMethod).toBe('transfer');
  });

  it('takes only cash refunds out of the drawer', () => {
    const id = shift();
    const a = sell('cash');
    const b = sell('cash');
    const c = sell('cash', HUDA);
    expect(expected(id)).toBe(50_000 + 300_000);
    giveBack(a, 'cash');
    giveBack(b, 'card');
    giveBack(c, 'balance');
    const totals = shiftTotals(ctx, getShift(ctx, id)!);
    expect(totals).toMatchObject({
      returns: 3,
      refunded: 300_000,
      cashRefunds: 100_000,
      refundsBy: { cash: 100_000, card: 100_000, transfer: 0, balance: 100_000, debt: 0 },
      expected: 50_000 + 300_000 - 100_000,
    });
    ctx.setActor(OWNER);
    const day = daySummary(ctx, dayKey(ctx.now()));
    expect(day).toMatchObject({
      cashRefunds: 100_000,
      refundsBy: { cash: 100_000, card: 100_000, balance: 100_000 },
    });
  });

  it('puts a refund «رصيد للزبونة» on her balance, to use later', () => {
    shift();
    const saleId = sell('card', HUDA);
    const customerId = getSale(ctx, saleId)!.customerId!;
    giveBack(saleId, 'balance');
    expect(balance(ctx, customerId)).toBe(-100_000);
    expect(statement(ctx, customerId).at(-1)).toMatchObject({ kind: 'refund', amount: -100_000 });
  });

  it('needs a customer on the sale for «رصيد للزبونة»', () => {
    shift();
    expect(() => giveBack(sell('cash'), 'balance')).toThrow('رصيد');
  });

  it('lowers the debt for a sale on credit, with no other choice', () => {
    shift();
    const saleId = sell('credit', HUDA);
    const customerId = getSale(ctx, saleId)!.customerId!;
    expect(() => giveBack(saleId, 'cash')).toThrow('آجل');
    const id = giveBack(saleId);
    expect(getReturn(ctx, id)!.refundMethod).toBe('debt');
    expect(balance(ctx, customerId)).toBe(0);
    expect(() => giveBack(sell('cash'), 'debt')).toThrow('آجل');
  });

  it('says how it was paid back in the activity log', () => {
    shift();
    giveBack(sell('cash'), 'transfer');
    ctx.setActor(OWNER);
    expect(listActivity(ctx, {})[0].summary).toContain('تحويل');
  });

  it('lists the returns paid back one way', () => {
    shift();
    giveBack(sell('cash'), 'cash');
    giveBack(sell('cash'), 'card');
    giveBack(sell('cash'), 'card');
    expect(listReturns(ctx, undefined, undefined, 'card')).toHaveLength(2);
    expect(returnsSummary(ctx, undefined, 'card')).toEqual({ count: 2, total: 200_000 });
    expect(listReturns(ctx)).toHaveLength(3);
  });

  it('pays the difference of an exchange the chosen way', () => {
    const id = shift();
    const first = sell('cash');
    const before = expected(id);
    // The same price back on a card, the new piece paid in cash: the drawer takes the new piece.
    exchange(ctx, {
      ret: { ...passing(ctx), saleLineId: lineOf(first), quantity: 1, refundMethod: 'card' },
      sale: { cart: cart(), paymentMethod: 'cash' },
    });
    expect(expected(id)).toBe(before + 100_000);
  });

  it('pays back a return without a sale in cash, on a card or by transfer, never to a balance', () => {
    ctx.setActor(OWNER);
    const r = addReturnWithoutSale(ctx, {
      productId: ring,
      quantity: 1,
      refund: 80_000,
      photo: 'p.jpg',
      refundMethod: 'card',
    });
    expect(getReturn(ctx, r)!.refundMethod).toBe('card');
    expect(() =>
      addReturnWithoutSale(ctx, {
        productId: ring,
        quantity: 1,
        refund: 80_000,
        photo: 'p.jpg',
        refundMethod: 'balance',
      }),
    ).toThrow();
  });
});
