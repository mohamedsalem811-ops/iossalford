/**
 * The birthday discount (H1): off and with no cap until the owner sets it; from 3 days before to
 * 3 days after the birthday; once in any 12 months; a full return gives it back; a phone number is
 * needed; a birthday saved less than 30 days before it needs the owner; never with the visit
 * reward or another discount; on the receipt, the day summary, the report and the log.
 */
import { OWNER } from '@/staff/model';
import { receiptDoc } from '@/features/receipts/model';
import { receiptHtml } from '@/receipts/templates/html';

import { listActivity } from './activity';
import {
  birthdayStatus,
  birthdayWindow,
  getBirthday,
  nextWindow,
  setBirthday,
  windowText,
} from './birthday';
import { addToCart, type CartLine } from './cart';
import { BirthdayApprovalNeeded, checkout } from './checkout';
import { PermissionError, RuleError } from './context';
import { customerReport, mergeCustomers } from './customer-care';
import { customerByPhone, getCustomer, saveCustomer } from './customers';
import { daySummary } from './day-summary';
import { exchange } from './exchange';
import { getProduct, saveProduct } from './products';
import { getReceipt } from './receipts';
import { setRewards } from './rewards';
import { addReturn, getSale } from './sales';
import { getPolicies } from './policies';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
const PHONE = '0912345678';
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 100 });
});
afterEach(() => ctx.close());

const at = (y: number, m: number, d: number) => ctx.setNow(new Date(y, m - 1, d, 10, 0, 0));
const cart = (): CartLine[] =>
  (addToCart([], getProduct(ctx, ring)!, 'Ring', 1) as { cart: CartLine[] }).cart;
const sell = (extra: { birthday?: boolean; reward?: boolean; birthdayApproval?: string } = {}) =>
  checkout(ctx, { cart: cart(), paymentMethod: 'cash', customer: { phone: PHONE }, ...extra });
const huda = () => customerByPhone(ctx, PHONE)!.id;
/** هدى, born on 14 November, saved long ago (before database 11: trusted). */
const born = (month = 11, day = 14) => {
  const id = saveCustomer(ctx, { name: 'هدى', phone: PHONE, birthMonth: month, birthDay: day });
  ctx.db.run('UPDATE customers SET birthday_set_at = NULL WHERE id = ?', [id]);
  return id;
};
const turnOn = () => setBirthday(ctx, { enabled: true, maxOff: 200_000 });
const answers = () => Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true]));
const returnAll = (saleId: number) =>
  addReturn(ctx, {
    saleLineId: getSale(ctx, saleId)!.lines[0].id,
    quantity: 1,
    photo: 'p.jpg',
    answers: answers(),
  });

describe('the owner’s settings', () => {
  it('start off, 10% with no cap, and need the cap to be turned on', () => {
    expect(getBirthday(ctx)).toEqual({ enabled: false, percent: 10, maxOff: 0, minSale: 0 });
    expect(() => setBirthday(ctx, { enabled: true })).toThrow(/أكبر مبلغ/);
    expect(() => setBirthday(ctx, { percent: 60 })).toThrow(RuleError);
    expect(() => setBirthday(ctx, { maxOff: 200_500 })).toThrow(RuleError);
    turnOn();
    expect(getBirthday(ctx)).toMatchObject({ enabled: true, maxOff: 200_000 });
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'birthday.set' });
  });

  it('are the owner’s', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => turnOn()).toThrow(PermissionError);
    ctx.setActor(OWNER);
  });

  it('give nothing while off', () => {
    born();
    at(2026, 11, 14);
    expect(birthdayStatus(ctx, huda())).toBeNull();
    expect(() => sell({ birthday: true })).toThrow(/لا يوجد خصم عيد ميلاد/);
  });
});

describe('the birthday week', () => {
  it('is 3 days before to 3 days after', () => {
    const c = { birthMonth: 11, birthDay: 14 };
    expect(birthdayWindow(c, new Date(2026, 10, 10))).toBeNull();
    expect(birthdayWindow(c, new Date(2026, 10, 11))?.days).toBe(3);
    expect(birthdayWindow(c, new Date(2026, 10, 17))?.days).toBe(-3);
    expect(birthdayWindow(c, new Date(2026, 10, 18))).toBeNull();
    expect(windowText(birthdayWindow(c, new Date(2026, 10, 14))!)).toBe('من 11 إلى 17 نوفمبر');
  });

  it('goes over the year’s end', () => {
    const c = { birthMonth: 1, birthDay: 1 };
    const w = birthdayWindow(c, new Date(2026, 11, 30))!;
    expect(w.date).toEqual(new Date(2027, 0, 1));
    expect(windowText(w)).toBe('من 29 ديسمبر إلى 4 يناير');
    expect(birthdayWindow(c, new Date(2027, 0, 3))?.days).toBe(-2);
    expect(birthdayWindow({ birthMonth: 12, birthDay: 31 }, new Date(2027, 0, 2))?.days).toBe(-2);
  });

  it('puts 29 February on the 28th in other years', () => {
    const c = { birthMonth: 2, birthDay: 29 };
    expect(birthdayWindow(c, new Date(2027, 1, 28))?.days).toBe(0);
    expect(birthdayWindow(c, new Date(2028, 1, 29))?.days).toBe(0);
  });

  it('gives the next one ahead, for the message', () => {
    const w = nextWindow({ birthMonth: 11, birthDay: 20 }, new Date(2026, 10, 14))!;
    expect(w.days).toBe(6);
    expect(windowText(w)).toBe('من 17 إلى 23 نوفمبر');
  });
});

describe('at checkout', () => {
  beforeEach(() => {
    turnOn();
    born();
    at(2026, 11, 13);
  });

  it('takes 10% off, needs no approval and is kept apart from the visit reward', () => {
    ctx.setActor(EMPLOYEE);
    const r = sell({ birthday: true });
    ctx.setActor(OWNER);
    expect(r.total).toBe(900_000);
    expect(getSale(ctx, r.saleId)).toMatchObject({
      birthdayOff: 100_000,
      rewardOff: 0,
      discount: 0,
    });
    expect(getReceipt(ctx, r.receipt.id)?.birthdayOff).toBe(100_000);
    expect(receiptHtml(receiptDoc(getReceipt(ctx, r.receipt.id)!))).toContain(
      'Birthday gift / هدية عيد الميلاد',
    );
    expect(listActivity(ctx, {}).find((a) => a.action === 'sale.create')?.summary).toContain(
      'خصم عيد الميلاد 100 د.ل',
    );
    expect(daySummary(ctx, '2026-11-13').birthdays).toEqual({ count: 1, off: 100_000 });
    expect(customerReport(ctx).birthdays).toEqual({ count: 1, off: 100_000 });
  });

  it('stops at the owner’s cap', () => {
    setBirthday(ctx, { maxOff: 50_000 });
    expect(sell({ birthday: true }).total).toBe(950_000);
  });

  it('keeps to the minimum purchase', () => {
    setBirthday(ctx, { minSale: 2_000_000 });
    expect(() => sell({ birthday: true })).toThrow(/أو أكثر/);
  });

  it('is once in 12 months, and a full return gives it back', () => {
    const first = sell({ birthday: true });
    expect(birthdayStatus(ctx, huda())?.used).toBe(true);
    expect(() => sell({ birthday: true })).toThrow(/آخر 12 شهراً/);
    returnAll(first.saleId);
    expect(birthdayStatus(ctx, huda())?.used).toBe(false);
  });

  it('is once in 12 months even when the birthday is changed', () => {
    sell({ birthday: true });
    saveCustomer(ctx, { id: huda(), name: 'هدى', phone: PHONE, birthMonth: 1, birthDay: 2 });
    at(2026, 12, 31);
    expect(birthdayStatus(ctx, huda())?.used).toBe(true);
    at(2027, 11, 14);
    saveCustomer(ctx, { id: huda(), name: 'هدى', phone: PHONE, birthMonth: 11, birthDay: 14 });
    ctx.db.run('UPDATE customers SET birthday_set_at = NULL');
    expect(birthdayStatus(ctx, huda())?.used).toBe(false);
  });

  it('needs a phone number', () => {
    const id = saveCustomer(ctx, { name: 'منى', birthMonth: 11, birthDay: 14 });
    ctx.db.run('UPDATE customers SET birthday_set_at = NULL');
    expect(birthdayStatus(ctx, id)).toBeNull();
  });

  it('is never with the visit reward or another discount', () => {
    expect(() => sell({ birthday: true, reward: true })).toThrow(/مكافأة واحدة/);
    const agreed = cart().map((l) => ({ ...l, unitPrice: 900_000 }));
    expect(() =>
      checkout(ctx, {
        cart: agreed,
        paymentMethod: 'cash',
        customer: { phone: PHONE },
        birthday: true,
      }),
    ).toThrow(/أي خصم آخر/);
  });

  it('does not use up the visit reward, and the purchase counts as a visit', () => {
    ctx.db.run('UPDATE customers SET birthday_set_at = NULL');
    setRewards(ctx, { enabled: true, every: 1, minPurchase: 500_000 });
    at(2026, 11, 12);
    sell();
    at(2026, 11, 13);
    sell({ birthday: true });
    at(2026, 11, 14);
    // One visit before and the birthday purchase: the reward is still ready.
    expect(sell({ reward: true }).total).toBe(900_000);
  });

  it('is never used by an exchange', () => {
    const old = sell();
    const r = exchange(ctx, {
      ret: {
        saleLineId: getSale(ctx, old.saleId)!.lines[0].id,
        quantity: 1,
        photo: 'p',
        answers: answers(),
      },
      sale: { cart: cart(), paymentMethod: 'cash', customer: { phone: PHONE } },
    });
    expect(getSale(ctx, r.saleId)?.birthdayOff).toBe(0);
  });
});

describe('a birthday saved just before it', () => {
  beforeEach(() => {
    turnOn();
    at(2026, 11, 1);
  });

  it('needs the owner when saved less than 30 days before', () => {
    saveCustomer(ctx, { name: 'هدى', phone: PHONE, birthMonth: 11, birthDay: 5 });
    at(2026, 11, 5);
    expect(birthdayStatus(ctx, huda())?.needsOwner).toBe(true);
    ctx.setActor(EMPLOYEE);
    expect(() => sell({ birthday: true })).toThrow(BirthdayApprovalNeeded);
    expect(() => sell({ birthday: true, birthdayApproval: 'wrong' })).toThrow(
      BirthdayApprovalNeeded,
    );
    ctx.setActor(OWNER);
    // The owner selling: their own approval.
    expect(sell({ birthday: true }).total).toBe(900_000);
  });

  it('needs the owner for a birthday typed in at checkout', () => {
    at(2026, 11, 14);
    ctx.setActor(EMPLOYEE);
    expect(() =>
      checkout(ctx, {
        cart: cart(),
        paymentMethod: 'cash',
        customer: { name: 'هدى', phone: PHONE, details: { birthMonth: 11, birthDay: 14 } },
        birthday: true,
      }),
    ).toThrow(BirthdayApprovalNeeded);
    ctx.setActor(OWNER);
    // Nothing was saved: the sale and the new customer went back together.
    expect(customerByPhone(ctx, PHONE)).toBeUndefined();
  });

  it('is fine when saved 30 days or more before', () => {
    saveCustomer(ctx, { name: 'هدى', phone: PHONE, birthMonth: 12, birthDay: 1 });
    at(2026, 12, 1);
    expect(birthdayStatus(ctx, huda())?.needsOwner).toBe(false);
  });

  it('starts again when the birthday is changed, not when other details are', () => {
    const id = saveCustomer(ctx, { name: 'هدى', phone: PHONE, birthMonth: 12, birthDay: 1 });
    const first = getCustomer(ctx, id)!.birthdaySetAt;
    at(2026, 11, 20);
    saveCustomer(ctx, {
      id,
      name: 'هدى',
      phone: PHONE,
      birthMonth: 12,
      birthDay: 1,
      ringSize: '7',
    });
    expect(getCustomer(ctx, id)!.birthdaySetAt).toBe(first);
    saveCustomer(ctx, { id, name: 'هدى', phone: PHONE, birthMonth: 12, birthDay: 2 });
    expect(getCustomer(ctx, id)!.birthdaySetAt).not.toBe(first);
    saveCustomer(ctx, { id, name: 'هدى', phone: PHONE, birthMonth: null, birthDay: null });
    expect(getCustomer(ctx, id)!.birthdaySetAt).toBeNull();
  });

  it('keeps its date through a merge', () => {
    const keep = saveCustomer(ctx, { name: 'هدى', phone: PHONE });
    const drop = saveCustomer(ctx, {
      name: 'هدى',
      phone: '0922222222',
      birthMonth: 3,
      birthDay: 4,
    });
    const when = getCustomer(ctx, drop)!.birthdaySetAt;
    at(2026, 11, 25);
    mergeCustomers(ctx, keep, drop);
    expect(getCustomer(ctx, keep)).toMatchObject({
      birthMonth: 3,
      birthDay: 4,
      birthdaySetAt: when,
    });
  });
});
