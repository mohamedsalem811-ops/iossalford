/**
 * What the customer card shows (G1): a customer's purchases, visits, spending, VIP and birthday,
 * worked out from the sales and returns every time (nothing is stored), so a return, a deleted
 * sale or an exchange is always counted right.
 */
import { dayKey } from '@/lib/dates';

import { timestamp, type Ctx } from './context';
import { getCustomer, validBirthday, type Customer, type VipChoice } from './customers';
import { getRewards, type RewardRules } from './rewards';

/** One sale of a customer, with what was returned of it. */
export type CustomerSale = {
  id: number;
  createdAt: string;
  /** "2026-11-14": sales on the same day are one visit. */
  day: string;
  total: number;
  /** The total less the value of the pieces returned. */
  net: number;
  /** What the visit reward took off this sale (G2). */
  rewardOff: number;
  /** What the birthday discount took off this sale (H1). */
  birthdayOff: number;
  /** Every piece of it was returned. */
  fullyReturned: boolean;
  /** An exchange's new sale (S4): money spent, but not a new visit. */
  exchange: boolean;
};

type SaleRow = {
  id: number;
  created_at: string;
  total: number;
  reward_off: number;
  birthday_off: number | null;
  returned: number;
  pieces: number;
  returned_pieces: number;
  exchange: number;
};

const RETURNED_VALUE = `coalesce((SELECT sum(r.quantity * sl.line_total * 1.0 / sl.quantity)
  FROM returns r JOIN sale_lines sl ON sl.id = r.sale_line_id WHERE sl.sale_id = s.id), 0)`;

/** A customer's sales, oldest first. */
export function customerSales(ctx: Ctx, customerId: number): CustomerSale[] {
  return ctx.db
    .all<SaleRow>(
      `SELECT s.id, s.created_at, s.total, s.reward_off, s.birthday_off,
         ${RETURNED_VALUE} AS returned,
         coalesce((SELECT sum(quantity) FROM sale_lines WHERE sale_id = s.id), 0) AS pieces,
         coalesce((SELECT sum(r.quantity) FROM returns r JOIN sale_lines sl ON sl.id = r.sale_line_id
                   WHERE sl.sale_id = s.id), 0) AS returned_pieces,
         EXISTS (SELECT 1 FROM returns x WHERE x.exchange_sale_id = s.id) AS exchange
       FROM sales s WHERE s.customer_id = ? ORDER BY s.created_at, s.id`,
      [customerId],
    )
    .map((r) => ({
      id: r.id,
      createdAt: r.created_at,
      day: r.created_at.slice(0, 10),
      total: r.total,
      net: Math.max(0, r.total - Math.round(r.returned)),
      rewardOff: r.reward_off,
      birthdayOff: r.birthday_off ?? 0,
      fullyReturned: r.pieces > 0 && r.returned_pieces >= r.pieces,
      exchange: r.exchange === 1,
    }));
}

/** The start of the VIP window: `months` months before now. */
export function monthsAgo(now: Date, months: number): string {
  const d = new Date(now);
  d.setMonth(d.getMonth() - months);
  return timestamp(d);
}

/** VIP: the owner's choice first, else spent more than the rule in the window. */
export const isVip = (choice: VipChoice | null, spentInWindow: number, rules: RewardRules) =>
  choice === 'always' ? true : choice === 'never' ? false : spentInWindow > rules.vipSpend;

export type Badge = 'new' | 'returning' | 'vip';
export const BADGE_LABELS: Record<Badge, string> = {
  new: 'جديد',
  returning: 'عائد',
  vip: 'VIP',
};

export type CustomerStats = {
  /** Days the customer bought something (an exchange is not a visit). */
  visits: number;
  lastVisit: string | null;
  /** Everything spent, less returns. */
  spent: number;
  /** Spent in the VIP window (the last 12 months). */
  spentInWindow: number;
  vip: boolean;
  badge: Badge;
  /** The last purchases, newest first: the pieces' names. */
  lastPurchases: { id: number; createdAt: string; pieces: string }[];
};

/** Everything the customer card needs about one customer. */
export function customerStats(
  ctx: Ctx,
  customerId: number,
  rules: RewardRules = getRewards(ctx),
  customer: Customer | undefined = getCustomer(ctx, customerId),
): CustomerStats {
  const sales = customerSales(ctx, customerId);
  const since = monthsAgo(ctx.now(), rules.vipMonths);
  const counted = sales.filter((s) => !s.fullyReturned && !s.exchange);
  const days = new Set(counted.map((s) => s.day));
  const spent = sales.reduce((t, s) => t + s.net, 0);
  const spentInWindow = sales.filter((s) => s.createdAt >= since).reduce((t, s) => t + s.net, 0);
  const vip = isVip(customer?.vip ?? null, spentInWindow, rules);
  const last = [...counted].reverse().slice(0, 3);
  const names = last.length
    ? ctx.db.all<{ sale_id: number; names: string }>(
        `SELECT sale_id, group_concat(name, '، ') AS names FROM sale_lines
         WHERE sale_id IN (${last.map(() => '?').join(', ')}) GROUP BY sale_id`,
        last.map((s) => s.id),
      )
    : [];
  return {
    visits: days.size,
    lastVisit: counted.length ? counted[counted.length - 1].createdAt : null,
    spent,
    spentInWindow,
    vip,
    badge: vip ? 'vip' : days.size >= 2 ? 'returning' : 'new',
    lastPurchases: last.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      pieces: names.find((n) => n.sale_id === s.id)?.names ?? '',
    })),
  };
}

/**
 * Every customer's spending at once, for the customer list: all of it (`spent`) and in the VIP
 * window (`inWindow`).
 */
export function spendingByCustomer(
  ctx: Ctx,
  rules: RewardRules = getRewards(ctx),
): Map<number, { spent: number; inWindow: number }> {
  const since = monthsAgo(ctx.now(), rules.vipMonths);
  const rows = ctx.db.all<{ id: number; spent: number; in_window: number }>(
    `SELECT s.customer_id AS id,
       sum(s.total - ${RETURNED_VALUE}) AS spent,
       sum(CASE WHEN s.created_at >= ? THEN s.total - ${RETURNED_VALUE} ELSE 0 END) AS in_window
     FROM sales s WHERE s.customer_id IS NOT NULL GROUP BY s.customer_id`,
    [since],
  );
  return new Map(
    rows.map((r) => [
      r.id,
      { spent: Math.max(0, Math.round(r.spent)), inWindow: Math.max(0, Math.round(r.in_window)) },
    ]),
  );
}

/** "منذ 12 يوماً", "اليوم", "أمس": how long since a date. */
export function sinceText(stamp: string, now: Date): string {
  const days = Math.round(
    (Date.parse(`${dayKey(now)}T00:00:00`) - Date.parse(`${stamp.slice(0, 10)}T00:00:00`)) /
      86_400_000,
  );
  if (days <= 0) return 'اليوم';
  if (days === 1) return 'أمس';
  if (days === 2) return 'منذ يومين';
  if (days <= 10) return `منذ ${days} أيام`;
  return `منذ ${days} يوماً`;
}

/**
 * Days until the customer's next birthday (0 today), or null without one. 29 February is the
 * 28th in a year that has none.
 */
export function daysToBirthday(
  c: Pick<Customer, 'birthMonth' | 'birthDay'>,
  now: Date,
): number | null {
  const b = validBirthday(c.birthMonth, c.birthDay);
  if (!b) return null;
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const on = (year: number) => {
    const leap = new Date(year, 1, 29).getMonth() === 1;
    const day = b.month === 2 && b.day === 29 && !leap ? 28 : b.day;
    return new Date(year, b.month - 1, day);
  };
  let next = on(today.getFullYear());
  if (next < today) next = on(today.getFullYear() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/**
 * "عيد ميلادها اليوم 🎂", "عيد ميلاده بعد 3 أيام", "كان عيد ميلادها أمس 🎂" (up to 3 days after,
 * while the birthday discount is on), or null otherwise.
 */
export function birthdayNote(c: Customer, now: Date): string | null {
  const days = daysToBirthday(c, now);
  if (days === null) return null;
  const whose = c.gender === 'female' ? 'عيد ميلادها' : 'عيد ميلاده';
  for (const ago of [1, 2, 3]) {
    const then = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ago);
    if (daysToBirthday(c, then) === 0)
      return `كان ${whose} ${ago === 1 ? 'أمس' : ago === 2 ? 'قبل يومين' : 'قبل 3 أيام'} 🎂`;
  }
  if (days > 6) return null;
  if (days === 0) return `${whose} اليوم 🎂`;
  if (days === 1) return `${whose} غداً 🎂`;
  return `${whose} بعد ${days === 2 ? 'يومين' : `${days} أيام`} 🎂`;
}
