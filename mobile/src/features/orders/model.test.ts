import type { Order, OrderReminders } from '@/domain/orders';

import {
  depositHint,
  emptyOrderForm,
  formPrice,
  moneyLine,
  needsAttention,
  orderFormProblem,
  reminderRows,
  statusLine,
  type OrderForm,
} from './model';

const form = (over: Partial<OrderForm> = {}): OrderForm => ({
  ...emptyOrderForm('order'),
  name: 'منى',
  phone: '0912345678',
  description: 'سوار',
  price: '500',
  deposit: '250',
  ...over,
});

describe('the deposit form', () => {
  it('prices the whole order: per piece × pieces, or the held piece', () => {
    expect(formPrice(form({ quantity: 2 }), null)).toBe(1_000_000);
    expect(formPrice(form({ kind: 'hold', price: '' }), 300_000)).toBe(300_000);
    expect(formPrice(form({ price: '' }), null)).toBeNull();
  });

  it('says what is missing, in order', () => {
    expect(orderFormProblem(form({ name: ' ' }), null)).toBe('اكتب اسم الزبون');
    expect(orderFormProblem(form({ phone: '' }), null)).toMatch(/رقم هاتف/);
    expect(orderFormProblem(form({ kind: 'hold' }), null)).toBe('اختر القطعة المحجوزة');
    expect(orderFormProblem(form({ description: '' }), null)).toBe('اكتب القطعة المطلوبة');
    expect(orderFormProblem(form({ price: '0' }), null)).toBe('اكتب السعر المتفق عليه');
    expect(orderFormProblem(form({ deposit: '' }), null)).toBe('اكتب مبلغ العربون');
    expect(orderFormProblem(form({ deposit: '600' }), null)).toMatch(/أكبر من السعر/);
    expect(orderFormProblem(form(), null)).toBeNull();
  });

  it('shows the minimum, and warns an employee under it', () => {
    const rules = { minPercent: 50 };
    expect(depositHint(form({ deposit: '250' }), null, rules, false)).toEqual({
      text: expect.stringContaining('أقل عربون 50%'),
      warn: false,
    });
    const under = depositHint(form({ deposit: '100' }), null, rules, false)!;
    expect(under.warn).toBe(true);
    expect(under.text).toMatch(/موافقة المالك/);
    expect(depositHint(form({ deposit: '100' }), null, rules, true)!.text).not.toMatch(/موافقة/);
    expect(depositHint(form({ price: '' }), null, rules, false)).toBeNull();
  });
});

const o = (over: Partial<Order> = {}) =>
  ({
    id: 1,
    status: 'waiting',
    eta: null,
    price: 1_000_000,
    paid: 500_000,
    remaining: 500_000,
    ...over,
  }) as Order;

describe('an order in a list', () => {
  it('reads its stage, late or not', () => {
    const today = '2026-11-15';
    expect(statusLine(o(), today)).toBe('بانتظار الشراء');
    expect(statusLine(o({ status: 'purchased', eta: '2026-12-01' }), today)).toMatch(/1\/12\/2026/);
    expect(statusLine(o({ status: 'purchased', eta: '2026-11-01' }), today)).toMatch(/^متأخر/);
    expect(needsAttention(o(), today)).toBe(true);
    expect(needsAttention(o({ status: 'arrived' }), today)).toBe(false);
  });

  it('reads its money', () => {
    expect(moneyLine(o())).toMatch(/الباقي/);
    expect(moneyLine(o({ paid: 1_000_000, remaining: 0 }))).toMatch(/مدفوع بالكامل/);
  });
});

describe('the home reminders', () => {
  const r: OrderReminders = { noDate: [o()], late: [], waiting: [o({ id: 2 }), o({ id: 3 })] };
  it('show the not-bought ones to the owner only, and skip what is empty', () => {
    expect(reminderRows(r, true).map((x) => x.key)).toEqual(['noDate', 'waiting']);
    expect(reminderRows(r, false).map((x) => x.key)).toEqual(['waiting']);
    expect(reminderRows({ noDate: [], late: [], waiting: [] }, true)).toEqual([]);
  });
});
