/**
 * The visit reward, VIP double points and the receipt footer (phase G2): off until the owner
 * turns it on; counted from the sales and returns (a day is one purchase, from 500 د.ل); the 4th
 * purchase gets 10% off at most 250 د.ل on a sale of 250 د.ل or more; it waits, comes back on a
 * full return, never mixes with the quick discounts, and comes off before the points.
 */
import { OWNER } from '@/staff/model';
import { receiptDoc } from '@/features/receipts/model';
import { receiptHtml } from '@/receipts/templates/html';

import { listActivity } from './activity';
import { addToCart, percentOff, type CartLine } from './cart';
import { checkout, receiptFooter } from './checkout';
import { PermissionError, RuleError } from './context';
import { listCustomers } from './customers';
import { daySummary } from './day-summary';
import { exchange } from './exchange';
import { pointsBalance, redeemable, setLoyalty } from './loyalty';
import { getPolicies, setPolicies } from './policies';
import { getProduct, saveProduct } from './products';
import { getReceipt } from './receipts';
import { DEFAULT_REWARDS, getRewards, setRewards } from './rewards';
import { addReturn, getSale } from './sales';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';
import { rewardCart, rewardStatus } from './visit-reward';

let ctx: TestCtx;
let ring: number;
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 100 });
});
afterEach(() => ctx.close());

const day = (d: number, h = 10) => ctx.setNow(new Date(2026, 10, d, h, 0, 0));
const cart = (price = 1_000_000, qty = 1): CartLine[] => {
  const p = getProduct(ctx, ring)!;
  if (p.price !== price) saveProduct(ctx, { ...p, id: ring, brand: p.brand, price });
  return (addToCart([], getProduct(ctx, ring)!, 'Ring', qty) as { cart: CartLine[] }).cart;
};
const sell = (
  price = 1_000_000,
  extra: { reward?: boolean; points?: number; method?: 'cash' | 'credit' } = {},
) =>
  checkout(ctx, {
    cart: cart(price),
    paymentMethod: extra.method ?? 'cash',
    customer: { name: 'هدى', phone: '0912345678' },
    reward: extra.reward,
    points: extra.points,
  });
const huda = () => listCustomers(ctx)[0].id;
const status = () => rewardStatus(ctx, huda());
const answers = () => Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true]));
const returnAll = (saleId: number) =>
  addReturn(ctx, {
    saleLineId: getSale(ctx, saleId)!.lines[0].id,
    quantity: getSale(ctx, saleId)!.lines[0].quantity,
    photo: 'p.jpg',
    answers: answers(),
  });
/** Three counted purchases on the 1st, 2nd and 3rd; today is the 4th. */
const threeVisits = () => {
  for (const d of [1, 2, 3]) {
    day(d);
    sell(600_000);
  }
  day(4);
};

beforeEach(() => {
  day(1, 8);
});

describe('switched off', () => {
  it('has no status, and a reward is refused', () => {
    sell();
    expect(status()).toBeNull();
    expect(() => sell(1_000_000, { reward: true })).toThrow(RuleError);
    expect(getRewards(ctx)).toEqual(DEFAULT_REWARDS);
  });
});

describe('the owner’s rules', () => {
  it('are checked, logged, and start the count when turned on', () => {
    expect(() => setRewards(ctx, { percent: 0 })).toThrow(RuleError);
    expect(() => setRewards(ctx, { ranges: [] })).toThrow(RuleError);
    expect(() => setRewards(ctx, { maxOff: 500 })).toThrow(RuleError);
    const r = setRewards(ctx, { enabled: true, ranges: [2_000_000, 500_000, 500_000] });
    expect(r.startedAt).toBe('2026-11-01T08:00:00');
    expect(r.ranges).toEqual([500_000, 2_000_000]);
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'rewards.set' });
    // Saving again while on keeps the start.
    day(2);
    expect(setRewards(ctx, { percent: 15 }).startedAt).toBe('2026-11-01T08:00:00');
    ctx.setActor(EMPLOYEE);
    expect(() => setRewards(ctx, { percent: 10 })).toThrow(PermissionError);
    ctx.setActor(OWNER);
  });

  it('counts only purchases from the day they were turned on', () => {
    sell(600_000);
    day(2);
    setRewards(ctx, { enabled: true });
    sell(600_000);
    expect(status()).toMatchObject({ count: 1, every: 3, ready: false, dots: '●○○○' });
  });
});

describe('counting purchases', () => {
  beforeEach(() => {
    setRewards(ctx, { enabled: true });
  });

  it('adds up a day’s sales, and counts a day from 500 د.ل', () => {
    day(1, 9);
    sell(300_000);
    expect(status()?.count).toBe(0);
    day(1, 15);
    sell(300_000);
    expect(status()?.count).toBe(1);
    day(2);
    sell(400_000);
    expect(status()?.count).toBe(1);
  });

  it('is ready after three, on another day than the third', () => {
    for (const d of [1, 2, 3]) {
      day(d);
      sell(600_000);
    }
    // The third purchase was today: the reward waits for another day.
    expect(status()).toMatchObject({ count: 3, ready: false });
    day(4);
    expect(status()).toMatchObject({ count: 3, ready: true, dots: '●●● 🎁' });
  });

  it('does not count a sale returned whole or an exchange', () => {
    day(1);
    const first = sell(600_000).saleId;
    returnAll(first);
    expect(status()?.count).toBe(0);
    day(2);
    const { saleId } = sell(600_000);
    exchange(ctx, {
      ret: {
        saleLineId: getSale(ctx, saleId)!.lines[0].id,
        quantity: 1,
        photo: 'p',
        answers: answers(),
      },
      sale: { cart: cart(700_000), paymentMethod: 'cash', customer: { phone: '0912345678' } },
    });
    // The 2nd's sale was exchanged (returned whole) and the new sale is the exchange's.
    expect(status()?.count).toBe(0);
  });

  it('is only for a customer with a phone', () => {
    checkout(ctx, { cart: cart(600_000), paymentMethod: 'cash', customer: { name: 'منى' } });
    const mona = listCustomers(ctx).find((c) => c.name === 'منى')!.id;
    expect(rewardStatus(ctx, mona)).toBeNull();
  });

  it('an exchange never uses the reward', () => {
    threeVisits();
    const { saleId } = sell(1_000_000, { reward: true });
    returnAll(saleId);
    day(5);
    const old = sell(600_000).saleId;
    const r = exchange(ctx, {
      ret: {
        saleLineId: getSale(ctx, old)!.lines[0].id,
        quantity: 1,
        photo: 'p',
        answers: answers(),
      },
      sale: {
        cart: cart(1_000_000),
        paymentMethod: 'cash',
        customer: { phone: '0912345678' },
        reward: true,
      },
    });
    expect(getSale(ctx, r.saleId)?.rewardOff).toBe(0);
  });

  it('counts a credit sale when it is made', () => {
    sell(600_000, { method: 'credit' });
    expect(status()?.count).toBe(1);
  });
});

describe('using the reward', () => {
  beforeEach(() => {
    setRewards(ctx, { enabled: true });
  });

  it('takes 10% off the prices, logged, and starts counting again', () => {
    threeVisits();
    const r = sell(1_000_000, { reward: true });
    expect(r.total).toBe(900_000);
    const sale = getSale(ctx, r.saleId)!;
    expect(sale).toMatchObject({ rewardOff: 100_000, discount: 0 });
    expect(sale.lines[0]).toMatchObject({ unitPrice: 900_000, listPrice: 1_000_000 });
    expect(listActivity(ctx, {})[0].summary).toContain('مكافأة الزيارة 100 د.ل');
    // The reward purchase itself doesn't count.
    expect(status()).toMatchObject({ count: 0, ready: false });
    expect(() => sell(1_000_000, { reward: true })).toThrow(RuleError);
  });

  it('is at most 250 د.ل, and only on a sale of 250 د.ل or more', () => {
    threeVisits();
    expect(() => sell(200_000, { reward: true })).toThrow(/250 د.ل/);
    // Nothing was sold; the reward still waits.
    expect(status()?.ready).toBe(true);
    expect(sell(5_000_000, { reward: true }).total).toBe(4_750_000);
  });

  it('waits: a smaller sale meanwhile is not the reward purchase', () => {
    threeVisits();
    sell(200_000);
    day(10);
    expect(status()?.ready).toBe(true);
  });

  it('comes back when the reward purchase is returned whole', () => {
    threeVisits();
    const { saleId } = sell(1_000_000, { reward: true });
    expect(status()?.ready).toBe(false);
    returnAll(saleId);
    expect(status()?.ready).toBe(true);
  });

  // The owner's rule (H1): an agreed price under the list price is a discount, and rewards are
  // never used with another discount. The reward waits for the next purchase.
  it('is not used with an agreed price under the list price', () => {
    threeVisits();
    const agreed = cart().map((l) => ({ ...l, unitPrice: 800_000 }));
    expect(() =>
      checkout(ctx, {
        cart: agreed,
        paymentMethod: 'cash',
        customer: { phone: '0912345678' },
        reward: true,
      }),
    ).toThrow(/أي خصم آخر/);
    expect(status()?.ready).toBe(true);
  });

  it('is never used with a quick discount', () => {
    setPolicies(ctx, { ...getPolicies(ctx), quickDiscounts: [5] });
    threeVisits();
    const quick = percentOff(cart(), (id) => getProduct(ctx, id)?.price, 5).cart;
    expect(() =>
      checkout(ctx, {
        cart: quick,
        paymentMethod: 'cash',
        customer: { phone: '0912345678' },
        reward: true,
      }),
    ).toThrow(/الخصم السريع/);
  });

  it('needs no approval and is not in the employee’s discount limit', () => {
    threeVisits();
    const big = cart(5_000_000);
    ctx.setActor(EMPLOYEE);
    // 250 د.ل off is far over an employee's limit, but it is the owner's reward.
    const r = checkout(ctx, {
      cart: big,
      paymentMethod: 'cash',
      customer: { phone: '0912345678' },
      reward: true,
    });
    expect(getSale(ctx, r.saleId)).toMatchObject({ rewardOff: 250_000, approvedBy: null });
    ctx.setActor(OWNER);
  });

  it('can be used on a credit sale', () => {
    threeVisits();
    expect(sell(1_000_000, { reward: true, method: 'credit' }).total).toBe(900_000);
  });

  it('comes off before the points, which pay at most half of what is left', () => {
    setLoyalty(ctx, { enabled: true, minRedeem: 1 });
    threeVisits();
    // 3 × 600 earned 180 points (10 د.ل a point): plenty.
    expect(pointsBalance(ctx, huda())).toBe(180);
    expect(redeemable(ctx, huda(), 900_000)?.points).toBe(180);
    const r = sell(1_000_000, { reward: true, points: 180 });
    expect(getSale(ctx, r.saleId)).toMatchObject({
      total: 900_000,
      rewardOff: 100_000,
      pointsPaid: 18_000,
    });
    // Half of a 10 د.ل sale is 5 د.ل: 50 points at most, whatever the balance.
    expect(redeemable(ctx, huda(), 10_000)?.points).toBe(50);
  });

  it('spreads over the pieces and sets in whole dinars', () => {
    const lines: CartLine[] = [
      { key: 'a', productId: 1, name: 'A', quantity: 2, unitPrice: 333_000 },
      {
        key: 'b',
        productId: 2,
        name: 'B',
        quantity: 1,
        unitPrice: 500_500,
        lineTotal: 500_500,
        bundleGroup: 'g',
      },
    ];
    const r = rewardCart(lines, { percent: 10, maxOff: 250_000 });
    expect(r.off).toBe(116_000);
    const total = r.cart.reduce((s, l) => s + (l.lineTotal ?? l.unitPrice * l.quantity), 0);
    expect(total).toBe(1_166_500 - 116_000);
    expect(r.cart.every((l) => (l.lineTotal ?? l.unitPrice) % 500 === 0)).toBe(true);
  });
});

describe('VIP double points', () => {
  it('earns twice the points over 5,000 د.ل in the last 12 months', () => {
    setLoyalty(ctx, { enabled: true });
    sell(5_000_000);
    expect(pointsBalance(ctx, huda())).toBe(500);
    // Now over 5,000 with this sale: VIP, so this sale earns double.
    sell(1_000_000);
    expect(pointsBalance(ctx, huda())).toBe(700);
  });
});

describe('the receipt and the day', () => {
  it('prints the reward saved and the footer kept from the sale', () => {
    setLoyalty(ctx, { enabled: true });
    setRewards(ctx, { enabled: true });
    day(1);
    const first = sell(600_000);
    expect(getReceipt(ctx, first.receipt.id)?.footer).toBe(
      'Points / رصيد النقاط: 60\nبقي شراءان على مكافأة 10%',
    );
    day(2);
    sell(600_000);
    day(3);
    const third = sell(600_000);
    expect(getReceipt(ctx, third.receipt.id)?.footer).toContain('جاهزة في زيارتك القادمة');
    day(4);
    const r = sell(1_000_000, { reward: true });
    const receipt = getReceipt(ctx, r.receipt.id)!;
    expect(receipt.rewardOff).toBe(100_000);
    const html = receiptHtml(receiptDoc(receipt));
    expect(html).toContain('Visit reward / مكافأة الزيارة');
    expect(html).toContain('100.00 LYD');
    expect(html).toContain('بقي 3 مشتريات على مكافأة 10%');
    expect(receiptFooter(ctx, null)).toBeNull();
    expect(daySummary(ctx, '2026-11-04').rewards).toEqual({ count: 1, off: 100_000 });
  });
});
