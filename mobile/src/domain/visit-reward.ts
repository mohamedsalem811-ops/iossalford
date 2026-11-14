/**
 * The visit reward (G2): after `every` counted purchases, the next one gets `percent` off (at most
 * `maxOff`), on a sale of at least `minRewardSale`. Worked out from the sales and returns every
 * time, never stored as a number, so a return, a deleted sale or an exchange corrects it:
 *
 * - only a customer with a phone collects visits, from the day the owner turned rewards on;
 * - a day's sales by the customer are one purchase, counted when they reach `minPurchase`;
 * - an exchange's sale and a sale returned whole don't count;
 * - counting starts again after the last reward used (a reward sale returned whole gives the
 *   reward back, waiting);
 * - an unused reward waits and never expires; the purchase that completes the count can't also
 *   be the reward one, so the reward is ready only on a later day.
 */
import { dayKey } from '@/lib/dates';
import { DIRHAMS_PER_DINAR } from '@/lib/money';

import { lineTotal, type CartLine } from './cart';
import type { Ctx } from './context';
import { customerSales } from './customer-stats';
import { getRewards, type RewardRules } from './rewards';

export type RewardStatus = {
  /** Counted purchases towards the next reward, at most `every`. */
  count: number;
  every: number;
  /** The reward can be used on this customer's sale today (if it is big enough). */
  ready: boolean;
  /** "●●●○": the progress as dots (the last dot is the reward purchase). */
  dots: string;
};

export function rewardStatus(
  ctx: Ctx,
  customerId: number | null | undefined,
  rules: RewardRules = getRewards(ctx),
): RewardStatus | null {
  if (!rules.enabled || !customerId || !rules.startedAt) return null;
  // Only a registered customer with a phone collects visits.
  const phone = ctx.db.get<{ k: string | null }>('SELECT phone_key k FROM customers WHERE id = ?', [
    customerId,
  ]);
  if (!phone?.k) return null;
  const sales = customerSales(ctx, customerId).filter(
    (s) => s.createdAt >= rules.startedAt! && !s.exchange && !s.fullyReturned,
  );
  const lastReward = [...sales].reverse().find((s) => s.rewardOff > 0);
  const after = lastReward ? sales.filter((s) => s.id > lastReward.id) : sales;
  const byDay = new Map<string, number>();
  for (const s of after) if (s.rewardOff === 0) byDay.set(s.day, (byDay.get(s.day) ?? 0) + s.net);
  const counted = [...byDay].filter(([, net]) => net >= rules.minPurchase).map(([d]) => d);
  const count = Math.min(counted.length, rules.every);
  const today = dayKey(ctx.now());
  // The purchase that completes the count is today's: the reward waits for another day.
  const ready = counted.length >= rules.every && counted[rules.every - 1] !== today;
  return {
    count,
    every: rules.every,
    ready,
    dots: '●'.repeat(count) + '○'.repeat(Math.max(0, rules.every - count)) + (ready ? ' 🎁' : '○'),
  };
}

/**
 * The reward taken off the cart's prices, in whole dinars: `percent` of what the customer pays
 * now (an agreed price stays, the reward comes off it), at most `maxOff`, spread over the pieces
 * and sets in proportion. Returns the new cart and what came off.
 */
export function rewardCart(
  cart: CartLine[],
  rules: Pick<RewardRules, 'percent' | 'maxOff'>,
): { cart: CartLine[]; off: number } {
  // A set line is one unit at its line total; a piece is its price, once per piece.
  const units = cart.map((l, n) =>
    l.bundleGroup ? { n, value: lineTotal(l), qty: 1 } : { n, value: l.unitPrice, qty: l.quantity },
  );
  const total = units.reduce((s, u) => s + u.value * u.qty, 0);
  if (total <= 0 || !(rules.percent > 0)) return { cart, off: 0 };
  const dinars = Math.min(
    Math.floor((total * rules.percent) / 100 / DIRHAMS_PER_DINAR),
    Math.floor(rules.maxOff / DIRHAMS_PER_DINAR),
  );
  const shares = units.map((u) => {
    const exact = (dinars * u.value) / total;
    const most = Math.floor(u.value / DIRHAMS_PER_DINAR);
    const off = Math.min(Math.floor(exact), most);
    return { ...u, off, most, rest: exact - off };
  });
  let left = dinars - shares.reduce((s, x) => s + x.off * x.qty, 0);
  const order = [...shares].sort((a, b) => b.rest - a.rest);
  for (let moved = true; moved && left > 0;) {
    moved = false;
    for (const x of order) {
      if (x.qty <= left && x.off < x.most) {
        x.off += 1;
        left -= x.qty;
        moved = true;
      }
    }
  }
  const next = [...cart];
  for (const x of shares) {
    if (!x.off) continue;
    const l = cart[x.n];
    const cut = x.off * DIRHAMS_PER_DINAR;
    if (l.bundleGroup) {
      const lt = lineTotal(l) - cut;
      next[x.n] = { ...l, lineTotal: lt, unitPrice: Math.round(lt / l.quantity) };
    } else next[x.n] = { ...l, unitPrice: l.unitPrice - cut };
  }
  return { cart: next, off: (dinars - left) * DIRHAMS_PER_DINAR };
}
