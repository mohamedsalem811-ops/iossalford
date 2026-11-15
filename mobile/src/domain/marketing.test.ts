/**
 * Marketing (I4): the owner's messages and fill-ins, occasions, gift memory at checkout and its
 * reminder a year later, bring a friend (her first-purchase gift and the sender's points, taken
 * back when it is fully returned), and "we miss you" offers used at checkout.
 */
import { OWNER } from '@/staff/model';

import { listActivity } from './activity';
import { addToCart, type CartLine } from './cart';
import { checkout, type CheckoutInput } from './checkout';
import { PermissionError, RuleError } from './context';
import { getCustomer, saveCustomer } from './customers';
import { exchange } from './exchange';
import { setLoyalty, pointsBalance } from './loyalty';
import {
  activeOffer,
  cancelOffer,
  fill,
  friendStatus,
  friendsOf,
  getMarketing,
  giftReminders,
  giveOffers,
  listGifts,
  markGiftDone,
  missYouCandidates,
  missYouText,
  occasionDate,
  offerCustomers,
  offersReport,
  setMarketing,
  setOccasionDate,
  setReferrer,
} from './marketing';
import { getPolicies } from './policies';
import { getProduct, saveProduct } from './products';
import { addReturn, deleteSale, getSale } from './sales';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
const MONA = { name: 'منى', phone: '0912345678' };
const HUDA = { name: 'هدى', phone: '0927777777' };

beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, {
    name: 'خاتم',
    category: 'خواتم',
    price: 500_000,
    cost: 200_000,
    stock: 20,
  });
});
afterEach(() => ctx.close());

const cart = (qty = 1): CartLine[] =>
  (addToCart([], getProduct(ctx, ring)!, 'خاتم', qty) as { cart: CartLine[] }).cart;
const sell = (customer = MONA, extra: Partial<CheckoutInput> = {}, qty = 1) =>
  checkout(ctx, { cart: cart(qty), paymentMethod: 'cash', customer, ...extra });
const answers = () => Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true]));
const friendsOn = () => {
  setLoyalty(ctx, { enabled: true });
  setMarketing(ctx, { friendEnabled: true });
};

describe('the owner’s messages', () => {
  it('fill in what they know, and keep what they don’t', () => {
    expect(fill('أهلاً {الاسم}، {المناسبة} {غير}', { الاسم: 'منى', المناسبة: 'عيد الأم' })).toBe(
      'أهلاً منى، عيد الأم {غير}',
    );
  });

  it('are the owner’s to change, checked and logged', () => {
    setMarketing(ctx, { templates: { ...getMarketing(ctx).templates, thanks: 'شكراً {الاسم}' } });
    expect(getMarketing(ctx).templates.thanks).toBe('شكراً {الاسم}');
    expect(listActivity(ctx, {}, { limit: 1 })[0].action).toBe('marketing.rules');
    expect(() =>
      setMarketing(ctx, { templates: { ...getMarketing(ctx).templates, vip: ' ' } }),
    ).toThrow('اكتب رسالة');
    expect(() => setMarketing(ctx, { offerPercent: 0 })).toThrow('نفتقدك');
    // Bring a friend needs loyalty points.
    expect(() => setMarketing(ctx, { friendEnabled: true })).toThrow('نقاط الولاء');
    ctx.setActor(EMPLOYEE);
    expect(() => setMarketing(ctx, { offerDays: 10 })).toThrow(PermissionError);
  });

  it('keep the fixed occasions and this year’s date of the moving ones', () => {
    const occ = (key: string) => getMarketing(ctx).occasions.find((o) => o.key === key)!;
    expect(occasionDate(occ('valentine'), 2026)).toBe('14/2');
    expect(occasionDate(occ('fitr'), 2026)).toBeNull();
    setOccasionDate(ctx, 'fitr', 3, 20);
    expect(occasionDate(occ('fitr'), 2026)).toBe('20/3');
    // Next year it waits to be typed again.
    expect(occasionDate(occ('fitr'), 2027)).toBeNull();
    expect(() => setOccasionDate(ctx, 'fitr', 2, 30)).toThrow('غير صحيح');
  });

  it('go to customers who accept offers (VIP only for the first look)', () => {
    sell(MONA);
    saveCustomer(ctx, { ...HUDA, offers: true });
    const huda = getCustomer(ctx, 2);
    expect(huda?.offers).toBe(true);
    expect(offerCustomers(ctx).map((c) => c.name)).toEqual(['هدى']);
    expect(offerCustomers(ctx, true)).toEqual([]);
  });
});

describe('gift memory', () => {
  it('is saved with the sale and reminds a week before, next year only', () => {
    const { saleId } = sell(MONA, {
      gift: { forWhom: 'أمها', occasion: 'عيد ميلاد', month: 11, day: 14 },
    });
    const [g] = listGifts(ctx, getSale(ctx, saleId)!.customerId!);
    expect(g).toMatchObject({ forWhom: 'أمها', month: 11, day: 14, saleId });
    // Not this year (it was just bought).
    ctx.setNow(new Date(2026, 10, 10));
    expect(giftReminders(ctx)).toEqual([]);
    ctx.setNow(new Date(2027, 10, 6));
    expect(giftReminders(ctx)).toEqual([]);
    ctx.setNow(new Date(2027, 10, 8));
    expect(giftReminders(ctx)).toMatchObject([{ id: g.id, days: 6 }]);
    // Whether she still accepts messages decides the WhatsApp button (the row shows either way).
    ctx.db.run('UPDATE customers SET offers = 0 WHERE id = ?', [g.customerId]);
    expect(giftReminders(ctx)[0].customerOffers).toBe(false);
    ctx.db.run('UPDATE customers SET offers = 1 WHERE id = ?', [g.customerId]);
    expect(giftReminders(ctx)[0].customerOffers).toBe(true);
    markGiftDone(ctx, g.id);
    expect(giftReminders(ctx)).toEqual([]);
    // And again the year after.
    ctx.setNow(new Date(2028, 10, 10));
    expect(giftReminders(ctx)).toHaveLength(1);
  });

  it('needs a known customer and a real date; nothing is sold otherwise', () => {
    expect(() =>
      checkout(ctx, {
        cart: cart(),
        paymentMethod: 'cash',
        gift: { forWhom: 'أمها', month: 11, day: 14 },
      }),
    ).toThrow('لزبون مسجل');
    expect(() => sell(MONA, { gift: { forWhom: 'أمها', month: 2, day: 30 } })).toThrow('غير صحيح');
    expect(() => sell(MONA, { gift: { forWhom: ' ', month: 2, day: 3 } })).toThrow('لمن');
    expect(getProduct(ctx, ring)!.stock).toBe(20);
  });
});

describe('bring a friend', () => {
  it('gives her first purchase the owner’s percent and the sender twice its points', () => {
    friendsOn();
    sell(MONA);
    const mona = 1;
    const before = pointsBalance(ctx, mona);
    // Huda, new, says Mona sent her: 2% off her first purchase, no minimum.
    const { saleId } = sell(HUDA, { referrerId: mona, friend: true });
    const sale = getSale(ctx, saleId)!;
    expect(sale.total).toBe(490_000);
    // 490 دينار earns 49 points; Mona gets twice that.
    expect(pointsBalance(ctx, mona) - before).toBe(98);
    expect(friendsOf(ctx, mona)).toEqual([{ id: 2, name: 'هدى', points: 98 }]);
    expect(friendStatus(ctx, 2)).toMatchObject({ referrerName: 'منى', ready: false });
    // Only once.
    expect(() => sell(HUDA, { friend: true })).toThrow('لأول شراء فقط');
    expect(() => setReferrer(ctx, 2, mona)).toThrow('اشترت من قبل');
  });

  it('takes the sender’s points back when the purchase is fully returned', () => {
    friendsOn();
    sell(MONA);
    const { saleId } = sell(HUDA, { referrerId: 1, friend: true }, 2);
    const after = pointsBalance(ctx, 1);
    const [line] = getSale(ctx, saleId)!.lines;
    addReturn(ctx, { saleLineId: line.id, quantity: 1, photo: 'p.jpg', answers: answers() });
    expect(pointsBalance(ctx, 1)).toBe(after);
    addReturn(ctx, { saleLineId: line.id, quantity: 1, photo: 'p.jpg', answers: answers() });
    expect(pointsBalance(ctx, 1)).toBeLessThan(after);
    expect(friendsOf(ctx, 1)[0].points).toBe(0);
  });

  it('waits for her real first purchase again when that sale is deleted', () => {
    friendsOn();
    sell(MONA);
    const before = pointsBalance(ctx, 1);
    const { saleId } = sell(HUDA, { referrerId: 1, friend: true });
    deleteSale(ctx, saleId);
    expect(pointsBalance(ctx, 1)).toBe(before);
    expect(friendStatus(ctx, 2)).toMatchObject({ ready: true });
  });

  it('is one reward: never with another reward or discount; never in an exchange', () => {
    friendsOn();
    sell(MONA);
    giveOffers(ctx, [1]);
    expect(() => sell(MONA, { offer: true, birthday: true })).toThrow('مكافأة واحدة');
    expect(() => sell(HUDA, { referrerId: 1, friend: true, offer: true })).toThrow('مكافأة واحدة');
    const lower = cart().map((l) => ({ ...l, unitPrice: l.unitPrice - 10_000 }));
    expect(() =>
      checkout(ctx, {
        cart: lower,
        paymentMethod: 'cash',
        customer: HUDA,
        referrerId: 1,
        friend: true,
      }),
    ).toThrow('أي خصم آخر');
    expect(getProduct(ctx, ring)!.stock).toBe(19);
  });

  it('is off without the owner’s rule; the sender can’t be herself', () => {
    setLoyalty(ctx, { enabled: true });
    sell(MONA);
    expect(() => sell(HUDA, { referrerId: 1, friend: true })).toThrow('متوقف');
    setMarketing(ctx, { friendEnabled: true });
    saveCustomer(ctx, HUDA);
    expect(() => setReferrer(ctx, 2, 2)).toThrow(RuleError);
  });
});

describe('we miss you', () => {
  it('suggests frequent buyers who haven’t come back', () => {
    for (const d of [1, 2, 3]) {
      ctx.setNow(new Date(2026, 1, d, 10));
      sell(MONA);
    }
    ctx.setNow(new Date(2026, 1, 1, 10));
    sell(HUDA);
    ctx.setNow(new Date(2026, 10, 9, 10));
    expect(missYouCandidates(ctx).map((x) => x.customer.name)).toEqual(['منى']);
    giveOffers(ctx, [1]);
    expect(missYouCandidates(ctx)).toEqual([]);
  });

  it('is a one-time discount with a cap, used at checkout, back if the sale is deleted', () => {
    sell(MONA);
    setMarketing(ctx, { offerPercent: 10, offerCap: 30_000, offerDays: 14 });
    const [o] = giveOffers(ctx, [1, 1]);
    expect(o).toMatchObject({ percent: 10, cap: 30_000, expiresAt: '2026-11-23' });
    expect(missYouText(getMarketing(ctx).templates.missYou, o)).toContain('10%');
    // 10% of 500 is 50, capped at 30.
    const { saleId } = sell(MONA, { offer: true });
    expect(getSale(ctx, saleId)!.total).toBe(470_000);
    expect(activeOffer(ctx, 1)).toBeUndefined();
    expect(() => sell(MONA, { offer: true })).toThrow('نفتقدك');
    expect(offersReport(ctx)).toMatchObject({ given: 1, used: 1, off: 30_000, sales: 470_000 });
    deleteSale(ctx, saleId);
    expect(activeOffer(ctx, 1)?.id).toBe(o.id);
  });

  it('ends on its day, or when the owner cancels it; the owner’s only', () => {
    sell(MONA);
    const [o] = giveOffers(ctx, [1]);
    ctx.setNow(new Date(2026, 10, 24, 10));
    expect(activeOffer(ctx, 1)).toBeUndefined();
    ctx.setNow(new Date(2026, 10, 9, 10));
    cancelOffer(ctx, o.id);
    expect(activeOffer(ctx, 1)).toBeUndefined();
    ctx.setActor(EMPLOYEE);
    expect(() => giveOffers(ctx, [1])).toThrow(PermissionError);
    ctx.setActor(OWNER);
  });

  it('never applies in an exchange', () => {
    const { saleId } = sell(MONA);
    giveOffers(ctx, [1]);
    const [line] = getSale(ctx, saleId)!.lines;
    const r = exchange(ctx, {
      ret: { saleLineId: line.id, quantity: 1, photo: 'p.jpg', answers: answers() },
      sale: { cart: cart(), paymentMethod: 'cash', customer: MONA, offer: true },
    });
    expect(getSale(ctx, r.saleId)!.total).toBe(500_000);
    expect(activeOffer(ctx, 1)).toBeDefined();
  });
});
