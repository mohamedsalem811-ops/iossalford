/**
 * The pieces the deposit screens (I2) read: the delivery's own one-line cart at the agreed
 * price, the WhatsApp texts and the record of each one opened, stock less what is held for the
 * sale screen, and the order a sale delivered.
 */
import { OWNER } from '@/staff/model';

import { checkout } from './checkout';
import { PermissionError } from './context';
import { lastMessage, recordMessage } from './messages';
import {
  arrivedMessage,
  etaMessage,
  etaText,
  getOrder,
  orderCart,
  orderOfSale,
  takeOrder,
} from './orders';
import { getProduct, saveProduct } from './products';
import { forSale, listForSale, reservedCounts } from './reserved';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
const MONA = { name: 'منى', phone: '0912345678' };
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, {
    name: 'خاتم',
    brand: 'لازوردي',
    category: 'خواتم',
    price: 300_000,
    cost: 100_000,
    stock: 3,
  });
});
afterEach(() => ctx.close());

const hold = (quantity = 1) =>
  takeOrder(ctx, {
    kind: 'hold',
    customer: MONA,
    productId: ring,
    quantity,
    deposit: { amount: 100_000, method: 'cash' },
  });

describe('the delivery cart', () => {
  it('is the held piece at the agreed price, and sells with the deposit taken off', () => {
    const { orderId } = hold(2);
    // The price changes after the deposit: hers stays the one agreed.
    saveProduct(ctx, { ...getProduct(ctx, ring)!, price: 350_000 });
    const order = getOrder(ctx, orderId)!;
    const cart = orderCart(ctx, order)!;
    expect(cart).toHaveLength(1);
    expect(cart[0]).toMatchObject({ productId: ring, quantity: 2, unitPrice: 300_000 });
    const sold = checkout(ctx, { cart, paymentMethod: 'cash', customer: MONA, orderId });
    expect(getOrder(ctx, orderId)).toMatchObject({ status: 'delivered', saleId: sold.saleId });
    expect(orderOfSale(ctx, sold.saleId)).toBe(orderId);
  });

  it('is undefined for an order that has no piece yet', () => {
    const { orderId } = takeOrder(ctx, {
      kind: 'order',
      customer: MONA,
      description: 'سوار',
      unitPrice: 200_000,
      deposit: { amount: 100_000, method: 'cash' },
    });
    expect(orderCart(ctx, getOrder(ctx, orderId)!)).toBeUndefined();
    expect(orderOfSale(ctx, 999)).toBeUndefined();
  });
});

describe('stock on the sale screen', () => {
  it('leaves out what is held for customers', () => {
    hold(2);
    const p = getProduct(ctx, ring)!;
    expect(forSale(ctx, p).stock).toBe(1);
    expect(listForSale(reservedCounts(ctx), [p])[0].stock).toBe(1);
    // Nothing held: the same objects come back.
    const list = [p];
    expect(listForSale(new Map(), list)).toBe(list);
  });
});

describe('WhatsApp messages', () => {
  it('say the date, the piece and what is left, signed SALFORD', () => {
    const o = { id: 7, customerName: 'منى', description: 'سوار', eta: '2026-12-01' };
    expect(etaText('2026-12-01')).toBe('1/12/2026');
    expect(etaMessage(o)).toContain('1/12/2026');
    expect(etaMessage(o)).toContain('«سوار» (رقم 7)');
    const ready = arrivedMessage({ ...o, kind: 'order', remaining: 200_000 });
    expect(ready).toContain('الباقي');
    expect(ready).toMatch(/SALFORD$/);
    expect(arrivedMessage({ ...o, kind: 'hold', remaining: 0 })).not.toContain('الباقي');
  });

  it('are remembered and logged, for someone who sees the numbers only', () => {
    const { orderId } = hold();
    const customerId = getOrder(ctx, orderId)!.customerId;
    expect(lastMessage(ctx, customerId, 'order-arrived', orderId)).toBeNull();
    recordMessage(ctx, { customerId, kind: 'order-arrived', ref: orderId });
    expect(lastMessage(ctx, customerId, 'order-arrived', orderId)).toEqual(expect.any(String));
    // Another order's message is apart.
    expect(lastMessage(ctx, customerId, 'order-arrived', orderId + 1)).toBeNull();
    ctx.setActor(EMPLOYEE);
    expect(() => recordMessage(ctx, { customerId, kind: 'order-eta', ref: orderId })).toThrow(
      PermissionError,
    );
    ctx.setActor(OWNER);
  });
});
