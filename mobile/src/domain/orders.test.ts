/**
 * Deposit orders (I1): the minimum deposit and the owner's approval, the stages (only the owner
 * buys and types the date), pieces held for their customer, delivery at checkout with the
 * deposit, cancelling (her balance, a refund the way she paid, or kept by the shop), and the
 * money in the shift, the day summary, debts, reports, closing, receipts, backups and merge.
 */
import { OWNER } from '@/staff/model';
import { receiptDoc } from '@/features/receipts/model';
import { receiptHtml } from '@/receipts/templates/html';

import { listActivity } from './activity';
import { exportBackup, restoreBackup } from './backup';
import { addToCart, type CartLine } from './cart';
import { CheckoutError, checkout } from './checkout';
import { closeQuarter } from './closing';
import { PermissionError, RuleError, type Ctx } from './context';
import { mergeCustomers } from './customer-care';
import { customerByPhone, saveCustomer } from './customers';
import { daySummary } from './day-summary';
import { balance, deleteCustomer, deletePayment, payments, statement } from './debts';
import {
  addOrderPayment,
  CancelApprovalNeeded,
  cancelOrder,
  depositsHeld,
  DepositApprovalNeeded,
  getOrder,
  listOrders,
  markArrived,
  markPurchased,
  orderPayments,
  orderReminders,
  parseEta,
  setDepositRules,
  setEta,
  takeOrder,
  type TakeOrderInput,
} from './orders';
import { photoInUse } from './photos';
import { adjustStock, deleteProduct, getProduct, saveProduct, type Product } from './products';
import { deleteReceipt, getReceipt, updateReceipt } from './receipts';
import { summary } from './reports';
import { addReturn, deleteSale, getSale, ReturnRefused } from './sales';
import { openShiftOf, shiftTotals } from './shifts';
import { reservedCounts } from './reserved';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

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
    stock: 1,
  });
});
afterEach(() => ctx.close());

/** The owner's approval on the spot, for one purpose. */
const approving = (purpose: string): Ctx => ({
  ...ctx,
  actor: ctx.actor,
  approvals: { take: (token, p) => token === 'ok' && p === purpose },
});

const order = (extra: Partial<TakeOrderInput> = {}, as: Ctx = ctx) =>
  takeOrder(as, {
    kind: 'order',
    customer: MONA,
    description: 'سوار تيفاني',
    brand: 'Tiffany',
    unitPrice: 1_000_000,
    deposit: { amount: 500_000, method: 'cash' },
    ...extra,
  } as TakeOrderInput);
const hold = (amount = 150_000, method: 'cash' | 'card' = 'cash') =>
  takeOrder(ctx, { kind: 'hold', customer: MONA, productId: ring, deposit: { amount, method } });
const cartOf = (p: Product, qty = 1): CartLine[] =>
  (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
/** The order's piece in the cart, as the order page puts it (at the agreed price). */
const orderCart = (orderId: number) => {
  const o = getOrder(ctx, orderId)!;
  const p = getProduct(ctx, o.productId!)!;
  return cartOf({ ...p, price: o.price / o.quantity, stock: o.quantity }, o.quantity);
};
const arrived = () => {
  const { orderId } = order();
  markPurchased(ctx, orderId, { cost: 450_000, eta: '2026-11-20' });
  const productId = markArrived(ctx, orderId);
  return { orderId, productId };
};
const drawer = () => {
  const shift = openShiftOf(ctx, 'emp-e1')!;
  return shiftTotals(ctx, shift);
};
const dump = () =>
  JSON.stringify(
    ['orders', 'order_payments', 'receipts', 'payments', 'customers', 'activity'].map((t) =>
      ctx.db.all(`SELECT * FROM ${t} ORDER BY rowid`),
    ),
  );

describe('taking a deposit', () => {
  it('saves the order at the agreed price and issues a deposit receipt with the policy', () => {
    const { orderId, receipt } = order();
    const o = getOrder(ctx, orderId)!;
    expect(o).toMatchObject({
      kind: 'order',
      status: 'waiting',
      customerName: 'منى',
      price: 1_000_000,
      paid: 500_000,
      remaining: 500_000,
      approvedBy: null,
    });
    expect(receipt).toMatchObject({ kind: 'deposit', orderId, deposit: 500_000, total: 1_000_000 });
    expect(receipt.footer).toContain('العربون يُسترد قبل طلب القطعة من المورد');
    expect(receipt.footer).toContain(`طلب رقم ${orderId}`);
    // The receipt prints the deposit paid and what is left.
    const html = receiptHtml(receiptDoc(receipt));
    expect(html).toContain('العربون المدفوع');
    expect(html).toContain('الباقي');
    expect(listActivity(ctx).filter((a) => a.action === 'order.take')).toHaveLength(1);
  });

  it('needs a name and a phone, a deposit no larger than the price, and a known way to pay', () => {
    expect(() => order({ customer: { name: 'منى', phone: '' } })).toThrow('رقم هاتف');
    expect(() => order({ customer: { name: ' ', phone: MONA.phone } })).toThrow('اسم الزبون');
    expect(() => order({ deposit: { amount: 1_000_001, method: 'cash' } })).toThrow('أكبر من');
    expect(() => order({ deposit: { amount: 500_000, method: 'credit' as 'cash' } })).toThrow(
      'طريقة الدفع',
    );
    expect(() => order({ description: '' } as Partial<TakeOrderInput>)).toThrow('القطعة');
  });

  it('asks the owner for a deposit under the minimum, and writes nothing until approved', () => {
    ctx.setActor(EMPLOYEE);
    const before = dump();
    expect(() => order({ deposit: { amount: 400_000, method: 'cash' } })).toThrow(
      DepositApprovalNeeded,
    );
    expect(dump()).toBe(before);
    const { orderId } = order(
      { deposit: { amount: 400_000, method: 'cash' }, approval: 'ok' },
      approving('deposit'),
    );
    expect(getOrder(ctx, orderId)!.approvedBy).toBe('owner');
    // The owner's own deposit needs nobody.
    ctx.setActor(OWNER);
    expect(
      getOrder(ctx, order({ deposit: { amount: 1_000, method: 'cash' } }).orderId)!,
    ).toMatchObject({ approvedBy: null, paid: 1_000 });
    // The owner can change the minimum.
    setDepositRules(ctx, { minPercent: 30 });
    ctx.setActor(EMPLOYEE);
    expect(() => order({ deposit: { amount: 300_000, method: 'card' } })).not.toThrow();
  });

  it('takes more payments up to the price, each with its receipt and in the shift', () => {
    ctx.setActor(EMPLOYEE);
    const { orderId } = order();
    const r = addOrderPayment(ctx, orderId, { amount: 200_000, method: 'card' });
    expect(r).toMatchObject({ kind: 'deposit', deposit: 700_000 });
    expect(() => addOrderPayment(ctx, orderId, { amount: 300_001, method: 'cash' })).toThrow(
      'أكبر من الباقي',
    );
    expect(getOrder(ctx, orderId)!.remaining).toBe(300_000);
    expect(drawer()).toMatchObject({ deposits: 700_000, cashDeposits: 500_000, expected: 500_000 });
    expect(orderPayments(ctx, orderId).map((p) => p.receiptNo)).toHaveLength(2);
  });
});

describe('the stages', () => {
  it('lets only the owner buy it (cost, expected date) and change the date', () => {
    const { orderId } = order();
    ctx.setActor(EMPLOYEE);
    expect(() => markPurchased(ctx, orderId, { cost: 1, eta: '2026-12-01' })).toThrow(
      PermissionError,
    );
    ctx.setActor(OWNER);
    expect(() => markArrived(ctx, orderId)).toThrow('بعد شرائها');
    expect(() => markPurchased(ctx, orderId, { cost: 1, eta: '2026-11-01' })).toThrow('قبل اليوم');
    markPurchased(ctx, orderId, { costUsd: 7_000, eta: '٢٠٢٦/١٢/٠١' });
    expect(getOrder(ctx, orderId)).toMatchObject({
      status: 'purchased',
      eta: '2026-12-01',
      costUsd: 7_000,
    });
    setEta(ctx, orderId, '2026-12-05');
    expect(getOrder(ctx, orderId)!.eta).toBe('2026-12-05');
    ctx.setActor(EMPLOYEE);
    expect(() => setEta(ctx, orderId, '2026-12-09')).toThrow(PermissionError);
  });

  it('reads typed dates and refuses impossible ones', () => {
    expect(parseEta('2026-2-3')).toBe('2026-02-03');
    expect(() => parseEta('2026-02-30')).toThrow();
    expect(() => parseEta('غداً')).toThrow();
  });

  it('turns an arrived piece into a product held for her, that nobody else can buy or change', () => {
    const { orderId, productId } = arrived();
    expect(getProduct(ctx, productId)).toMatchObject({
      name: 'سوار تيفاني',
      brand: 'Tiffany',
      price: 1_000_000,
      cost: 450_000,
      stock: 1,
      category: 'أخرى',
    });
    expect(getOrder(ctx, orderId)!.status).toBe('arrived');
    expect(reservedCounts(ctx).get(productId)).toBe(1);
    const p = getProduct(ctx, productId)!;
    // Another customer can't buy it: none is available to her.
    expect(() =>
      checkout(ctx, { cart: cartOf(p), paymentMethod: 'cash', customer: { name: 'هدى' } }),
    ).toThrow(CheckoutError);
    expect(() => saveProduct(ctx, { ...p, price: 1 })).toThrow('محجوزة لـ «منى»');
    expect(() => deleteProduct(ctx, productId)).toThrow('محجوزة');
    expect(() => adjustStock(ctx, productId, 1, 'وصلت')).toThrow('محجوزة');
  });
});

describe('a hold', () => {
  it('holds a piece in stock at its price: others can’t buy it, stock can’t go under it', () => {
    hold();
    expect(() => hold()).toThrow('غير متوفرة للحجز');
    const p = getProduct(ctx, ring)!;
    expect(() => checkout(ctx, { cart: cartOf(p), paymentMethod: 'cash' })).toThrow(CheckoutError);
    expect(() => adjustStock(ctx, ring, -1, 'كسر')).toThrow('محجوزة');
    expect(() => saveProduct(ctx, { ...p, stock: 0 })).toThrow('لا يقل المخزون');
    expect(() => deleteProduct(ctx, ring)).toThrow('محجوزة');
    // Editing the price is allowed: her price stays the one agreed.
    saveProduct(ctx, { ...p, price: 350_000 });
    adjustStock(ctx, ring, 2, 'توريد');
    expect(() =>
      checkout(ctx, { cart: cartOf(getProduct(ctx, ring)!), paymentMethod: 'cash' }),
    ).not.toThrow();
  });

  it('delivers at the agreed price, which is not a discount (no approval, rewards allowed)', () => {
    const { orderId } = hold();
    saveProduct(ctx, { ...getProduct(ctx, ring)!, price: 350_000 });
    ctx.setActor(EMPLOYEE);
    const sold = checkout(ctx, {
      cart: orderCart(orderId),
      paymentMethod: 'cash',
      customer: MONA,
      orderId,
    });
    const sale = getSale(ctx, sold.saleId)!;
    expect(sale).toMatchObject({
      total: 300_000,
      discount: 0,
      approvedBy: null,
      depositUsed: 150_000,
    });
    expect(sale.lines[0]).toMatchObject({ listPrice: 300_000, unitPrice: 300_000 });
    expect(getOrder(ctx, orderId)).toMatchObject({ status: 'delivered', saleId: sold.saleId });
    expect(getProduct(ctx, ring)!.stock).toBe(0);
    // The drawer: the deposit when it was paid (by the owner, outside her shift) is not hers;
    // what she took now is the rest.
    expect(drawer()).toMatchObject({ expected: 150_000 });
    expect(drawer().byMethod.cash).toBe(150_000);
  });
});

describe('delivery', () => {
  it('uses the deposit: the receipt prints it with its receipt number', () => {
    const { orderId } = arrived();
    const first = orderPayments(ctx, orderId)[0].receiptNo!;
    const sold = checkout(ctx, {
      cart: orderCart(orderId),
      paymentMethod: 'card',
      customer: MONA,
      orderId,
    });
    expect(sold.receipt).toMatchObject({ deposit: 500_000, orderId });
    expect(sold.receipt.footer).toContain(first);
    const html = receiptHtml(receiptDoc(sold.receipt));
    expect(html).toContain('العربون المدفوع مسبقاً');
    expect(html).toContain('المدفوع الآن');
    expect(daySummary(ctx, '2026-11-09')).toMatchObject({
      byMethod: { cash: 0, card: 500_000, transfer: 0, credit: 0 },
      deposits: { taken: { cash: 500_000, other: 0 }, used: 500_000, kept: 0 },
      cashNet: 500_000,
    });
    // Revenue is the whole price, on the day it was delivered.
    expect(summary(ctx, ['2026-11'])).toMatchObject({
      grossSales: 1_000_000,
      grossProfit: 550_000,
    });
    expect(depositsHeld(ctx)).toEqual({ orders: 0, amount: 0 });
  });

  it('refuses another customer, a cart without the piece, and an order not ready', () => {
    const { orderId } = order();
    expect(() =>
      checkout(ctx, {
        cart: cartOf(getProduct(ctx, ring)!),
        paymentMethod: 'cash',
        customer: MONA,
        orderId,
      }),
    ).toThrow('لم يصل بعد');
    const ready = arrived().orderId;
    expect(() =>
      checkout(ctx, {
        cart: orderCart(ready),
        paymentMethod: 'cash',
        customer: { name: 'هدى', phone: '0923333333' },
        orderId: ready,
      }),
    ).toThrow('اختر الزبون نفسه');
    expect(() =>
      checkout(ctx, {
        cart: cartOf(getProduct(ctx, ring)!),
        paymentMethod: 'cash',
        customer: MONA,
        orderId: ready,
      }),
    ).toThrow('أضف قطعة الطلب');
  });

  it('on credit, she owes the price less the deposit', () => {
    const { orderId } = arrived();
    const sold = checkout(ctx, {
      cart: orderCart(orderId),
      paymentMethod: 'credit',
      customer: MONA,
      orderId,
    });
    const id = customerByPhone(ctx, MONA.phone)!.id;
    expect(balance(ctx, id)).toBe(500_000);
    expect(statement(ctx, id).at(-1)).toMatchObject({ saleId: sold.saleId, amount: 500_000 });
  });

  it('can be returned under the normal rules (24 hours): the deposit is money she paid', () => {
    const { orderId } = arrived();
    ctx.setActor(EMPLOYEE);
    const sold = checkout(ctx, {
      cart: orderCart(orderId),
      paymentMethod: 'credit',
      customer: MONA,
      orderId,
    });
    const line = getSale(ctx, sold.saleId)!.lines[0].id;
    ctx.setNow(new Date(2026, 10, 10, 11, 0, 0));
    expect(() => addReturn(ctx, { ...passing(ctx), saleLineId: line, quantity: 1 })).toThrow(
      ReturnRefused,
    );
    ctx.setNow(new Date(2026, 10, 10, 9, 0, 0));
    addReturn(ctx, { ...passing(ctx), saleLineId: line, quantity: 1 });
    // On credit: the price less the deposit was owed; the whole price came back, so the shop
    // owes her the deposit (له رصيد).
    expect(balance(ctx, customerByPhone(ctx, MONA.phone)!.id)).toBe(-500_000);
  });

  it('puts the order back when its sale is deleted', () => {
    const { orderId, productId } = arrived();
    const sold = checkout(ctx, {
      cart: orderCart(orderId),
      paymentMethod: 'cash',
      customer: MONA,
      orderId,
    });
    deleteSale(ctx, sold.saleId);
    expect(getOrder(ctx, orderId)).toMatchObject({
      status: 'arrived',
      saleId: null,
      paid: 500_000,
    });
    expect(getProduct(ctx, productId)!.stock).toBe(1);
    expect(reservedCounts(ctx).get(productId)).toBe(1);
  });
});

describe('cancelling', () => {
  it('before buying: an employee needs the owner, then the deposit goes back the way she paid', () => {
    ctx.setActor(EMPLOYEE);
    const { orderId } = order();
    addOrderPayment(ctx, orderId, { amount: 100_000, method: 'card' });
    const before = dump();
    expect(() => cancelOrder(ctx, orderId, { how: 'refund' })).toThrow(CancelApprovalNeeded);
    expect(dump()).toBe(before);
    expect(() => cancelOrder(ctx, orderId, { how: 'keep' })).toThrow('يُسترد');
    cancelOrder(approving('orderCancel'), orderId, { how: 'refund', approval: 'ok' });
    expect(getOrder(ctx, orderId)).toMatchObject({
      status: 'cancelled',
      cancelHow: 'refund',
      settled: 600_000,
      paid: 0,
      cancelApprovedBy: 'owner',
    });
    expect(
      orderPayments(ctx, orderId)
        .filter((p) => p.kind === 'refund')
        .map((p) => [p.method, p.amount]),
    ).toEqual([
      ['card', 100_000],
      ['cash', 500_000],
    ]);
    // In then out of her drawer.
    expect(drawer()).toMatchObject({ deposits: 0, cashDeposits: 0, expected: 0, approvals: 0 });
    ctx.setActor(OWNER);
    expect(daySummary(ctx, '2026-11-09')).toMatchObject({
      deposits: {
        taken: { cash: 500_000, other: 100_000 },
        refunded: { cash: 500_000, other: 100_000 },
      },
      cashNet: 0,
      approvals: 1,
    });
  });

  it('before buying, to her balance: a payment that is not money, used like any credit', () => {
    const { orderId } = hold();
    cancelOrder(ctx, orderId, { how: 'balance' });
    const id = customerByPhone(ctx, MONA.phone)!.id;
    expect(balance(ctx, id)).toBe(-150_000);
    const p = payments(ctx, id)[0];
    expect(p).toMatchObject({
      method: 'order',
      amount: 150_000,
      note: `عربون الحجز رقم ${orderId}`,
    });
    expect(() => deletePayment(ctx, p.id)).toThrow('لا يُحذف');
    // The held piece is free again; the drawer is not touched by the move.
    expect(reservedCounts(ctx).get(ring)).toBeUndefined();
    expect(daySummary(ctx, '2026-11-09').payments).toEqual({ cash: 0, other: 0 });
  });

  it('after buying: only the owner, who keeps it (income) or moves it to her balance', () => {
    const { orderId } = order();
    markPurchased(ctx, orderId, { cost: 450_000, eta: '2026-11-20' });
    ctx.setActor(EMPLOYEE);
    expect(() =>
      cancelOrder(approving('orderCancel'), orderId, { how: 'keep', approval: 'ok' }),
    ).toThrow(PermissionError);
    ctx.setActor(OWNER);
    expect(() => cancelOrder(ctx, orderId, { how: 'refund' })).toThrow('لا يُسترد');
    cancelOrder(ctx, orderId, { how: 'keep' });
    expect(summary(ctx, ['2026-11'])).toMatchObject({ otherIncome: 500_000, netProfit: 500_000 });
    expect(daySummary(ctx, '2026-11-09').deposits.kept).toBe(500_000);
    expect(closeQuarter(ctx, { year: 2026, quarter: 4 })).toMatchObject({
      otherIncome: 500_000,
      netProfit: 500_000,
    });
    // The owner's exception on another one: to her balance.
    const second = order().orderId;
    markPurchased(ctx, second, { cost: 1, eta: '2026-11-20' });
    cancelOrder(ctx, second, { how: 'balance' });
    expect(balance(ctx, customerByPhone(ctx, MONA.phone)!.id)).toBe(-500_000);
  });

  it('an arrived piece stays in stock as the shop’s own when cancelled', () => {
    const { orderId, productId } = arrived();
    cancelOrder(ctx, orderId, { how: 'keep' });
    expect(reservedCounts(ctx).get(productId)).toBeUndefined();
    expect(() =>
      checkout(ctx, { cart: cartOf(getProduct(ctx, productId)!), paymentMethod: 'cash' }),
    ).not.toThrow();
    expect(() => cancelOrder(ctx, orderId, { how: 'keep' })).toThrow('مُغلق');
  });
});

describe('records that stay', () => {
  it('protects a deposit receipt: no delete, no change of its pieces; its design can change', () => {
    const { receipt } = order();
    expect(() => deleteReceipt(ctx, receipt.id)).toThrow('لا يُحذف');
    expect(() =>
      updateReceipt(ctx, receipt.id, { items: [{ name: 'شيء آخر', quantity: 1, price: 1 }] }),
    ).toThrow('إيصال العربون');
    updateReceipt(ctx, receipt.id, {
      items: receipt.items,
      customer: receipt.customer,
      template: 'salford_light',
    });
    expect(getReceipt(ctx, receipt.id)!.template).toBe('salford_light');
  });

  it('keeps a customer with orders, and moves her orders when merged', () => {
    const { orderId } = order();
    const id = customerByPhone(ctx, MONA.phone)!.id;
    expect(() => deleteCustomer(ctx, id)).toThrow('طلبات بعربون');
    const twin = saveCustomer(ctx, { name: 'منى', phone: '0919999999' });
    mergeCustomers(ctx, twin, id);
    expect(getOrder(ctx, orderId)!.customerId).toBe(twin);
  });

  it('goes into backups with its photo, and comes back', () => {
    const { orderId } = order({ imageFile: 'jewelry-order.jpg' } as Partial<TakeOrderInput>);
    expect(photoInUse(ctx, 'jewelry-order.jpg')).toBe(true);
    const copy = exportBackup(ctx);
    expect(copy.tables.orders).toHaveLength(1);
    expect(copy.tables.order_payments).toHaveLength(1);
    cancelOrder(ctx, orderId, { how: 'refund' });
    restoreBackup(ctx, copy);
    expect(getOrder(ctx, orderId)).toMatchObject({ status: 'waiting', paid: 500_000 });
  });

  it('lists open orders by date and reminds about the ones that need someone', () => {
    const waiting = order().orderId;
    const late = order({ description: 'قلادة' } as Partial<TakeOrderInput>).orderId;
    markPurchased(ctx, late, { cost: 1, eta: '2026-11-10' });
    const ready = arrived().orderId;
    // Open orders: no date first (they need one), then by expected date.
    expect(listOrders(ctx).map((o) => o.id)).toEqual([waiting, late, ready]);
    expect(listOrders(ctx, { search: 'قلادة' }).map((o) => o.id)).toEqual([late]);
    ctx.setNow(new Date(2026, 10, 24, 10, 0, 0));
    const r = orderReminders(ctx);
    expect(r.noDate.map((o) => o.id)).toEqual([waiting]);
    expect(r.late.map((o) => o.id)).toEqual([late]);
    expect(r.waiting.map((o) => o.id)).toEqual([ready]);
    expect(depositsHeld(ctx)).toEqual({ orders: 3, amount: 1_500_000 });
  });

  it('logs every step', () => {
    const { orderId } = arrived();
    checkout(ctx, { cart: orderCart(orderId), paymentMethod: 'cash', customer: MONA, orderId });
    const actions = listActivity(ctx).map((a) => a.action);
    for (const a of ['order.take', 'order.purchase', 'order.arrive', 'sale.create'])
      expect(actions).toContain(a);
  });
});

it('refuses for nobody signed in', () => {
  ctx.setActor(null);
  expect(() => order()).toThrow(RuleError);
});
