/**
 * Marketing (I4): every message typed by the owner with fill-ins, the occasion calendar, gift
 * memory, bring a friend and "we miss you" offers. The app never sends anything itself: each
 * message opens WhatsApp ready and the person sends it (recordMessage remembers it).
 *
 * The money rules:
 * - bring a friend: a new customer names who sent her; her first purchase gets the owner's
 *   percent off (no minimum), a reward, so never with another discount or reward; the customer
 *   who sent her gets the points that purchase earns, times the owner's multiple, taken back if
 *   the purchase is fully returned. Needs loyalty points on.
 * - we miss you: the owner gives chosen customers a one-time discount (percent, cap, days), used
 *   at checkout like the birthday discount; the report shows who came back.
 */
import { countText, CUSTOMERS } from '@/lib/arabic-count';
import { dayKey, formatDayKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { allow, clean, nowMonth, nowStamp, RuleError, type Ctx, who } from './context';
import { customersById, getCustomer, type Customer } from './customers';
import { isVip, spendingByCustomer } from './customer-stats';
import { getRewards } from './rewards';
import { addReferralMove, getLoyalty, pointsBalance, pointsFor } from './loyalty';
import { getSetting, setSetting } from './settings';
import {
  DEFAULT_TEMPLATES,
  fill,
  OLD_DEFAULTS,
  TEMPLATE_LABELS,
  type TemplateKind,
} from './templates';

// ---------------------------------------------------------------- templates

export {
  DEFAULT_TEMPLATES,
  FILL_INS,
  fill,
  isAutoName,
  TEMPLATE_KINDS,
  TEMPLATE_LABELS,
  type TemplateKind,
} from './templates';

// ---------------------------------------------------------------- occasions

export type Occasion = {
  key: string;
  name: string;
  month: number;
  day: number;
  /** Null: the same date every year (Valentine's, Mother's Day). A year: typed for that year. */
  year: number | null;
};

export const DEFAULT_OCCASIONS: Occasion[] = [
  { key: 'valentine', name: 'عيد الحب', month: 2, day: 14, year: null },
  { key: 'mother', name: 'عيد الأم', month: 3, day: 21, year: null },
  // Typed each year by the owner (the dates move with the moon).
  { key: 'ramadan', name: 'رمضان', month: 0, day: 0, year: null },
  { key: 'fitr', name: 'عيد الفطر', month: 0, day: 0, year: null },
  { key: 'adha', name: 'عيد الأضحى', month: 0, day: 0, year: null },
];
/** The occasions whose date the owner types each year. */
export const MOVING = new Set(['ramadan', 'fitr', 'adha']);

/** The date as people read it ("14/2"), or null when a moving one isn't typed for this year. */
export function occasionDate(o: Occasion, year: number): string | null {
  if (!o.month || !o.day) return null;
  if (MOVING.has(o.key) && o.year !== year) return null;
  return `${o.day}/${o.month}`;
}

// ---------------------------------------------------------------- the owner's rules

export type MarketingRules = {
  templates: Record<TemplateKind, string>;
  occasions: Occasion[];
  /** Bring a friend: on only with loyalty points on. */
  friendEnabled: boolean;
  friendPercent: number;
  /** The points the sender gets: this many times what the friend's purchase earns. */
  friendTimes: number;
  /** We miss you: the offer given, and who is suggested. */
  offerPercent: number;
  /** The most it takes off, in dirhams. */
  offerCap: number;
  offerDays: number;
  /** Suggested: bought on at least this many days, and not for this many days. */
  missVisits: number;
  missDays: number;
};

export const DEFAULT_MARKETING: MarketingRules = {
  templates: DEFAULT_TEMPLATES,
  occasions: DEFAULT_OCCASIONS,
  friendEnabled: false,
  friendPercent: 2,
  friendTimes: 2,
  offerPercent: 10,
  offerCap: 50_000,
  offerDays: 14,
  missVisits: 3,
  missDays: 90,
};
export const MARKETING_KEY = 'marketing';

/** The saved templates over the defaults; an old default the owner never changed follows the new one. */
function savedTemplates(saved: Partial<Record<TemplateKind, string>> = {}) {
  const out = { ...DEFAULT_TEMPLATES };
  for (const k of Object.keys(DEFAULT_TEMPLATES) as TemplateKind[]) {
    const t = saved[k];
    if (typeof t === 'string' && t.trim() && !OLD_DEFAULTS[k]?.includes(t)) out[k] = t;
  }
  return out;
}

export function getMarketing(ctx: Ctx): MarketingRules {
  try {
    const saved = JSON.parse(getSetting(ctx, MARKETING_KEY) ?? '{}') as Partial<MarketingRules>;
    const occasions = DEFAULT_OCCASIONS.map(
      (d) => saved.occasions?.find((o) => o.key === d.key) ?? d,
    ).concat(
      (saved.occasions ?? []).filter((o) => !DEFAULT_OCCASIONS.some((d) => d.key === o.key)),
    );
    return {
      ...DEFAULT_MARKETING,
      ...saved,
      templates: savedTemplates(saved.templates),
      occasions,
    };
  } catch {
    return DEFAULT_MARKETING;
  }
}

const whole = (n: number, lo: number, hi: number) => Number.isInteger(n) && n >= lo && n <= hi;

/** The owner changes the templates, occasions and rules; logged. */
export function setMarketing(ctx: Ctx, changes: Partial<MarketingRules>): MarketingRules {
  allow(ctx, 'marketing.manage');
  const old = getMarketing(ctx);
  const next: MarketingRules = {
    ...old,
    ...changes,
    templates: { ...old.templates, ...changes.templates },
  };
  for (const k of Object.keys(next.templates) as TemplateKind[]) {
    next.templates[k] = next.templates[k].trim().slice(0, 600);
    if (!next.templates[k]) throw new RuleError(`اكتب رسالة «${TEMPLATE_LABELS[k]}»`);
  }
  if (!whole(next.friendPercent, 1, 20)) throw new RuleError('خصم الصديقة من 1 إلى 20%');
  if (!whole(next.friendTimes, 1, 5)) throw new RuleError('نقاط من أرسلها من ضعف واحد إلى 5');
  if (!whole(next.offerPercent, 1, 50)) throw new RuleError('خصم «نفتقدك» من 1 إلى 50%');
  if (!Number.isInteger(next.offerCap) || next.offerCap <= 0)
    throw new RuleError('اكتب أقصى خصم لعرض «نفتقدك»');
  if (!whole(next.offerDays, 1, 90)) throw new RuleError('مدة العرض من يوم إلى 90 يوماً');
  if (!whole(next.missVisits, 1, 50)) throw new RuleError('عدد الزيارات من 1 إلى 50');
  if (!whole(next.missDays, 14, 730)) throw new RuleError('مدة الغياب من 14 إلى 730 يوماً');
  for (const o of next.occasions) {
    if (!clean(o.name)) throw new RuleError('اكتب اسم المناسبة');
    if (o.month || o.day) {
      const days = new Date(2024, o.month, 0).getDate();
      if (!whole(o.month, 1, 12) || !whole(o.day, 1, days))
        throw new RuleError(`تاريخ «${o.name}» غير صحيح`);
    }
  }
  if (next.friendEnabled && !getLoyalty(ctx).enabled)
    throw new RuleError('«أرسلي صديقة» يحتاج نقاط الولاء: شغّل النقاط أولاً');
  ctx.db.transaction(() => {
    setSetting(ctx, MARKETING_KEY, JSON.stringify(next));
    logAction(ctx, 'marketing.rules', 'تعديل إعدادات التسويق', {
      friend: next.friendEnabled ? `${next.friendPercent}% ×${next.friendTimes}` : 'متوقف',
      offer: `${next.offerPercent}% بحد أقصى ${formatLyd(next.offerCap)} لمدة ${next.offerDays} يوماً`,
    });
  });
  return next;
}

/** Types this year's date of a moving occasion (Ramadan, the Eids), or any one; logged. */
export function setOccasionDate(ctx: Ctx, key: string, month: number, day: number) {
  const rules = getMarketing(ctx);
  const year = ctx.now().getFullYear();
  const occasions = rules.occasions.map((o) =>
    o.key === key ? { ...o, month, day, year: MOVING.has(key) ? year : null } : o,
  );
  if (!occasions.some((o) => o.key === key)) throw new RuleError('المناسبة غير موجودة');
  return setMarketing(ctx, { occasions });
}

// ---------------------------------------------------------------- who gets what

const withPhone = (c: Customer | undefined): c is Customer => !!c?.phone;

/** Customers who accept offers and have a phone: the ones an occasion or VIP message may go to. */
export function offerCustomers(ctx: Ctx, onlyVip = false): Customer[] {
  const ids = ctx.db
    .all<{ id: number }>(
      "SELECT id FROM customers WHERE offers = 1 AND phone IS NOT NULL AND phone <> '' ORDER BY name",
    )
    .map((r) => r.id);
  const people = customersById(ctx, ids);
  const list = ids.map((id) => people.get(id)).filter(withPhone);
  if (!onlyVip) return list;
  // Everyone's spending in one query, as the customers list shows VIP (G1).
  const rules = getRewards(ctx);
  const spent = spendingByCustomer(ctx, rules);
  return list.filter((c) => isVip(c.vip, spent.get(c.id)?.inWindow ?? 0, rules));
}

/** Suggested for "we miss you": bought on many days, not lately, with a phone, no offer running. */
export function missYouCandidates(
  ctx: Ctx,
  rules: MarketingRules = getMarketing(ctx),
): { customer: Customer; last: string; visits: number }[] {
  const cutoff = new Date(ctx.now());
  cutoff.setDate(cutoff.getDate() - rules.missDays);
  const rows = ctx.db.all<{ id: number; last: string; visits: number }>(
    `SELECT customer_id id, max(created_at) last, count(DISTINCT substr(created_at, 1, 10)) visits
       FROM sales WHERE customer_id IS NOT NULL
      GROUP BY customer_id HAVING max(created_at) < ? AND visits >= ? ORDER BY last`,
    [dayKey(cutoff), rules.missVisits],
  );
  const people = customersById(
    ctx,
    rows.map((r) => r.id),
  );
  return rows
    .map((r) => ({ customer: people.get(r.id), last: r.last, visits: r.visits }))
    .filter(
      (x): x is { customer: Customer; last: string; visits: number } =>
        withPhone(x.customer) && x.customer.offers,
    )
    .filter((x) => !activeOffer(ctx, x.customer.id));
}

// ---------------------------------------------------------------- gift memory

export type GiftInput = { forWhom: string; occasion?: string; month: number; day: number };

export type Gift = {
  id: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  /** She accepts messages (يقبل العروض): off, the reminder is shown without WhatsApp. */
  customerOffers: boolean;
  saleId: number | null;
  forWhom: string;
  occasion: string | null;
  month: number;
  day: number;
  doneYear: number | null;
  createdAt: string;
};

type GiftRow = {
  id: number;
  customer_id: number;
  name: string;
  phone: string | null;
  offers: number | null;
  sale_id: number | null;
  for_whom: string;
  occasion: string | null;
  occ_month: number;
  occ_day: number;
  done_year: number | null;
  created_at: string;
};
const toGift = (r: GiftRow): Gift => ({
  id: r.id,
  customerId: r.customer_id,
  customerName: r.name,
  customerPhone: r.phone,
  customerOffers: !!r.offers,
  saleId: r.sale_id,
  forWhom: r.for_whom,
  occasion: r.occasion,
  month: r.occ_month,
  day: r.occ_day,
  doneYear: r.done_year,
  createdAt: r.created_at,
});
const GIFT_SELECT = `SELECT g.*, c.name, c.phone, c.offers FROM gifts g JOIN customers c ON c.id = g.customer_id`;

/** Checks what was typed at checkout ("هدية لمن؟"), before the sale is saved. */
export function checkGift(g: GiftInput): GiftInput {
  const forWhom = clean(g.forWhom);
  if (!forWhom) throw new RuleError('اكتب لمن الهدية');
  const days = new Date(2024, g.month, 0).getDate();
  if (!whole(g.month, 1, 12) || !whole(g.day, 1, days))
    throw new RuleError('تاريخ المناسبة غير صحيح');
  return { forWhom, occasion: clean(g.occasion) ?? undefined, month: g.month, day: g.day };
}

/** Saves a gift to remind about next year; called inside checkout. */
export function saveGift(ctx: Ctx, customerId: number, saleId: number | null, g: GiftInput) {
  const v = checkGift(g);
  return ctx.db.run(
    `INSERT INTO gifts (customer_id, sale_id, for_whom, occasion, occ_month, occ_day, created_at, month, by, by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      customerId,
      saleId,
      v.forWhom,
      v.occasion ?? null,
      v.month,
      v.day,
      nowStamp(ctx),
      nowMonth(ctx),
      ...who(ctx),
    ],
  ).lastInsertRowId;
}

export const listGifts = (ctx: Ctx, customerId: number): Gift[] =>
  ctx.db
    .all<GiftRow>(`${GIFT_SELECT} WHERE g.customer_id = ? ORDER BY g.occ_month, g.occ_day`, [
      customerId,
    ])
    .map(toGift);

/** Days from today to the gift's date this year (negative once passed). */
export function daysTo(month: number, day: number, now: Date): number {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round(
    (onDay(now.getFullYear(), month, day).getTime() - today.getTime()) / 86_400_000,
  );
}

/** The date in a year: 29 February is the 28th in other years. */
function onDay(year: number, month: number, day: number): Date {
  const leap = new Date(year, 1, 29).getMonth() === 1;
  return new Date(year, month - 1, month === 2 && day === 29 && !leap ? 28 : day);
}

/** The gift's next date from today (today included): this year's, or next year's once passed. */
export function nextGiftDate(month: number, day: number, now: Date): { date: Date; days: number } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let date = onDay(today.getFullYear(), month, day);
  if (date < today) date = onDay(today.getFullYear() + 1, month, day);
  return { date, days: Math.round((date.getTime() - today.getTime()) / 86_400_000) };
}

/** A date this close after the purchase is the occasion she bought the gift for, not next year's. */
const SAME_OCCASION_DAYS = 300;

/**
 * The home row a week before (I4): gifts whose next date is in the next 7 days (today included),
 * a year on from the purchase (a gift bought on 30 December for 3 January is not reminded that
 * January), and not handled for that date yet; the nearest first.
 */
export function giftReminders(ctx: Ctx): (Gift & { days: number })[] {
  const now = ctx.now();
  return ctx.db
    .all<GiftRow>(GIFT_SELECT)
    .map(toGift)
    .map((g) => {
      const next = nextGiftDate(g.month, g.day, now);
      const bought = new Date(`${g.createdAt.slice(0, 10)}T00:00:00`);
      const after = Math.round((next.date.getTime() - bought.getTime()) / 86_400_000);
      const due =
        next.days <= 7 &&
        after > SAME_OCCASION_DAYS &&
        (g.doneYear === null || g.doneYear < next.date.getFullYear());
      return { ...g, days: next.days, due };
    })
    .filter((g) => g.due)
    .map(({ due: _due, ...g }) => g)
    .sort((a, b) => a.days - b.days || a.id - b.id);
}

/** The gift's reminder is handled for its coming date (the message opened, or not wanted); logged. */
export function markGiftDone(ctx: Ctx, giftId: number) {
  allow(ctx, 'customers.edit');
  ctx.db.transaction(() => {
    const g = ctx.db.get<GiftRow>(`${GIFT_SELECT} WHERE g.id = ?`, [giftId]);
    if (!g) throw new RuleError('الهدية غير موجودة');
    // The year of the date it is for: done on 28 December for 2 January counts for January's year.
    const year = nextGiftDate(g.occ_month, g.occ_day, ctx.now()).date.getFullYear();
    ctx.db.run('UPDATE gifts SET done_year = ? WHERE id = ?', [year, giftId]);
    logAction(ctx, 'gift.done', `تذكير هدية «${g.name}» لـ${g.for_whom}: تم لهذه السنة`, {
      giftId,
      year,
    });
  });
}

/** Removes a gift reminder (she doesn't want it any more); logged. */
export function deleteGift(ctx: Ctx, giftId: number) {
  allow(ctx, 'customers.edit');
  ctx.db.transaction(() => {
    const g = ctx.db.get<GiftRow>(`${GIFT_SELECT} WHERE g.id = ?`, [giftId]);
    if (!g) throw new RuleError('الهدية غير موجودة');
    ctx.db.run('DELETE FROM gifts WHERE id = ?', [giftId]);
    logAction(ctx, 'gift.delete', `حذف تذكير هدية «${g.name}» لـ${g.for_whom}`, { giftId });
  });
}

export const giftMessage = (template: string, g: Gift) =>
  fill(template, {
    الاسم: g.customerName,
    لمن: g.forWhom,
    المناسبة: g.occasion ?? 'المناسبة',
    التاريخ: `${g.day}/${g.month}`,
  });

// ---------------------------------------------------------------- bring a friend

export type FriendStatus = {
  referrerId: number;
  referrerName: string;
  percent: number;
  /** The gift is for her first purchase only: false once she has bought. */
  ready: boolean;
};

const hasSales = (ctx: Ctx, customerId: number) =>
  !!ctx.db.get('SELECT 1 FROM sales WHERE customer_id = ? LIMIT 1', [customerId]);

/** No purchase yet: "من أرسلك؟" is asked only then. */
export const firstPurchase = (ctx: Ctx, customerId: number) => !hasSales(ctx, customerId);

/** Bring a friend is on: the owner's rule and loyalty points both. */
export const friendOn = (ctx: Ctx, rules: MarketingRules = getMarketing(ctx)) =>
  rules.friendEnabled && getLoyalty(ctx).enabled;

/** Who sent this customer and whether her first-purchase gift waits; null when none. */
export function friendStatus(
  ctx: Ctx,
  customerId: number | null | undefined,
  rules: MarketingRules = getMarketing(ctx),
): FriendStatus | null {
  if (!customerId || !friendOn(ctx, rules)) return null;
  const r = ctx.db.get<{ referrer_id: number; name: string; sale_id: number | null }>(
    `SELECT f.referrer_id, c.name, f.sale_id FROM referrals f JOIN customers c ON c.id = f.referrer_id
      WHERE f.friend_id = ?`,
    [customerId],
  );
  if (!r) return null;
  return {
    referrerId: r.referrer_id,
    referrerName: r.name,
    percent: rules.friendPercent,
    ready: r.sale_id === null && !hasSales(ctx, customerId),
  };
}

/** Sets who sent a new customer, before her first purchase; logged. */
export function setReferrer(ctx: Ctx, friendId: number, referrerId: number) {
  allow(ctx, 'customers.edit');
  ctx.db.transaction(() => {
    const { friend, sender } = linkReferrer(ctx, friendId, referrerId);
    logAction(ctx, 'referral.set', `«${friend}» أرسلتها «${sender}»`, { friendId, referrerId });
  });
}

/** The same inside checkout (its own permission checked, the sale's log line names her). */
export function linkReferrer(ctx: Ctx, friendId: number, referrerId: number) {
  if (!friendOn(ctx)) throw new RuleError('«أرسلي صديقة» متوقف');
  if (friendId === referrerId) throw new RuleError('لا ترسل الزبونة نفسها');
  const friend = getCustomer(ctx, friendId);
  const sender = getCustomer(ctx, referrerId);
  if (!friend || !sender) throw new RuleError('الزبون غير موجود');
  if (hasSales(ctx, friendId))
    throw new RuleError(`«${friend.name}» اشترت من قبل: «من أرسلك؟» للزبونة الجديدة فقط`);
  const back = ctx.db.get<{ r: number | null }>(
    'SELECT referred_by r FROM customers WHERE id = ?',
    [referrerId],
  );
  if (back?.r === friendId) throw new RuleError('أرسلتها هي: لا ترسل كل منهما الأخرى');
  ctx.db.run('UPDATE customers SET referred_by = ? WHERE id = ?', [referrerId, friendId]);
  ctx.db.run(
    `INSERT INTO referrals (friend_id, referrer_id, created_at, by, by_name) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(friend_id) DO UPDATE SET referrer_id = excluded.referrer_id`,
    [friendId, referrerId, nowStamp(ctx), ...who(ctx)],
  );
  return { friend: friend.name, sender: sender.name };
}

/**
 * After the friend's first purchase is saved (inside checkout): the sender's points, the points
 * that purchase earns times the owner's multiple. Only her first purchase counts, whatever kind it
 * is (a deposit delivery too). On credit the points wait until her debt is paid, like her own
 * points (payReferral). Returns the points given now.
 */
export function rewardReferrer(
  ctx: Ctx,
  friendId: number,
  saleId: number,
  paid: number,
  opts: { credit?: boolean } = {},
): number {
  const rules = getMarketing(ctx);
  const loyalty = getLoyalty(ctx);
  const r = ctx.db.get<{ id: number; referrer_id: number }>(
    'SELECT id, referrer_id FROM referrals WHERE friend_id = ? AND sale_id IS NULL',
    [friendId],
  );
  if (!r) return 0;
  // Her first purchase only: one bought before (the referral named later) never counts.
  const earlier = ctx.db.get('SELECT 1 FROM sales WHERE customer_id = ? AND id <> ? LIMIT 1', [
    friendId,
    saleId,
  ]);
  if (earlier) return 0;
  const points = pointsFor(paid, loyalty) * rules.friendTimes;
  const friend = getCustomer(ctx, friendId);
  const moveId =
    points && !opts.credit
      ? addReferralMove(ctx, r.referrer_id, points, `أرسلت صديقة: ${friend?.name ?? ''}`)
      : null;
  ctx.db.run('UPDATE referrals SET sale_id = ?, points = ?, move_id = ? WHERE id = ?', [
    saleId,
    points,
    moveId,
    r.id,
  ]);
  return moveId ? points : 0;
}

/**
 * A debt payment from a friend whose first purchase was on credit (debts.ts): once she owes
 * nothing, her sender gets the points that waited. Returns the points given.
 */
export function payReferral(ctx: Ctx, friendId: number, settled: boolean): number {
  if (!settled) return 0;
  const r = ctx.db.get<{ id: number; referrer_id: number; points: number; name: string }>(
    `SELECT f.id, f.referrer_id, f.points, c.name FROM referrals f JOIN customers c ON c.id = f.friend_id
      WHERE f.friend_id = ? AND f.sale_id IS NOT NULL AND f.move_id IS NULL AND f.points > 0
        AND f.reversed_at IS NULL`,
    [friendId],
  );
  if (!r) return 0;
  const moveId = addReferralMove(ctx, r.referrer_id, r.points, `أرسلت صديقة: ${r.name}`);
  ctx.db.run('UPDATE referrals SET move_id = ? WHERE id = ?', [moveId, r.id]);
  return r.points;
}

/** An exchange of the friend's whole first purchase: the referral follows the new sale. */
export function moveReferral(ctx: Ctx, fromSaleId: number, toSaleId: number) {
  const left = ctx.db.get<{ n: number }>(
    `SELECT coalesce(sum(l.quantity), 0) - coalesce((SELECT sum(r.quantity) FROM returns r
        JOIN sale_lines x ON x.id = r.sale_line_id WHERE x.sale_id = ?1), 0) n
       FROM sale_lines l WHERE l.sale_id = ?1`,
    [fromSaleId],
  );
  if ((left?.n ?? 0) > 0) return;
  ctx.db.run('UPDATE referrals SET sale_id = ? WHERE sale_id = ? AND reversed_at IS NULL', [
    toSaleId,
    fromSaleId,
  ]);
}

/**
 * The friend's first purchase fully returned or deleted: the sender's points come back off (never
 * below zero). Deleted: the gift waits for her real first purchase again.
 */
export function reverseReferral(ctx: Ctx, saleId: number, how: 'returned' | 'deleted') {
  const r = ctx.db.get<{
    id: number;
    referrer_id: number;
    points: number;
    move_id: number | null;
    reversed_at: string | null;
    name: string;
  }>(
    `SELECT f.id, f.referrer_id, f.points, f.move_id, f.reversed_at, c.name FROM referrals f
       JOIN customers c ON c.id = f.friend_id WHERE f.sale_id = ?`,
    [saleId],
  );
  if (!r) return;
  // Points still waiting for her payment were never given: nothing to take back.
  if (!r.reversed_at && r.points > 0 && r.move_id !== null) {
    const take = Math.min(r.points, Math.max(0, pointsBalance(ctx, r.referrer_id)));
    if (take > 0) addReferralMove(ctx, r.referrer_id, -take, `أُعيدت مشتريات الصديقة: ${r.name}`);
  }
  if (how === 'deleted')
    ctx.db.run(
      'UPDATE referrals SET sale_id = NULL, points = 0, move_id = NULL, reversed_at = NULL WHERE id = ?',
      [r.id],
    );
  else ctx.db.run('UPDATE referrals SET reversed_at = ? WHERE id = ?', [nowStamp(ctx), r.id]);
}

/** The friends a customer sent, for her page. */
export function friendsOf(
  ctx: Ctx,
  customerId: number,
): { id: number; name: string; points: number; waiting: boolean }[] {
  return ctx.db
    .all<{ id: number; name: string; points: number; waiting: number }>(
      `SELECT c.id, c.name, CASE WHEN f.reversed_at IS NULL THEN f.points ELSE 0 END points,
              (f.sale_id IS NOT NULL AND f.move_id IS NULL AND f.points > 0 AND f.reversed_at IS NULL) waiting
       FROM referrals f JOIN customers c ON c.id = f.friend_id WHERE f.referrer_id = ? ORDER BY f.id`,
      [customerId],
    )
    .map((r) => ({ ...r, waiting: !!r.waiting }));
}

// ---------------------------------------------------------------- we miss you

export type Offer = {
  id: number;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  percent: number;
  cap: number;
  expiresAt: string;
  saleId: number | null;
  usedAt: string | null;
  createdAt: string;
};
type OfferRow = {
  id: number;
  customer_id: number;
  name: string;
  phone: string | null;
  percent: number;
  cap: number;
  expires_at: string;
  sale_id: number | null;
  used_at: string | null;
  created_at: string;
};
const toOffer = (r: OfferRow): Offer => ({
  id: r.id,
  customerId: r.customer_id,
  customerName: r.name,
  customerPhone: r.phone,
  percent: r.percent,
  cap: r.cap,
  expiresAt: r.expires_at,
  saleId: r.sale_id,
  usedAt: r.used_at,
  createdAt: r.created_at,
});
const OFFER_SELECT = `SELECT o.*, c.name, c.phone FROM offers o JOIN customers c ON c.id = o.customer_id`;

/** The customer's offer still to use (not used, not past its last day), if any. */
export function activeOffer(ctx: Ctx, customerId: number | null | undefined): Offer | undefined {
  if (!customerId) return undefined;
  const r = ctx.db.get<OfferRow>(
    `${OFFER_SELECT} WHERE o.customer_id = ? AND o.used_at IS NULL AND o.expires_at >= ?
      ORDER BY o.id DESC LIMIT 1`,
    [customerId, dayKey(ctx.now())],
  );
  return r ? toOffer(r) : undefined;
}

/** The owner gives the chosen customers the offer (each one with none running); logged. */
export function giveOffers(ctx: Ctx, customerIds: number[]): Offer[] {
  allow(ctx, 'marketing.manage');
  const rules = getMarketing(ctx);
  const until = new Date(ctx.now());
  until.setDate(until.getDate() + rules.offerDays);
  const expires = dayKey(until);
  return ctx.db.transaction(() => {
    const given: Offer[] = [];
    for (const id of [...new Set(customerIds)]) {
      const c = getCustomer(ctx, id);
      if (!c) throw new RuleError('الزبون غير موجود');
      if (activeOffer(ctx, id)) continue;
      const offerId = ctx.db.run(
        `INSERT INTO offers (customer_id, percent, cap, expires_at, created_at, month, by, by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          rules.offerPercent,
          rules.offerCap,
          expires,
          nowStamp(ctx),
          nowMonth(ctx),
          ...who(ctx),
        ],
      ).lastInsertRowId;
      given.push(toOffer(ctx.db.get<OfferRow>(`${OFFER_SELECT} WHERE o.id = ?`, [offerId])!));
    }
    if (given.length)
      logAction(
        ctx,
        'offer.give',
        `عرض «نفتقدك» ${rules.offerPercent}% بحد أقصى ${formatLyd(rules.offerCap)} لـ${countText(given.length, CUSTOMERS)}، حتى ${formatDayKey(expires)}`,
        { offers: given.map((o) => o.id), expires },
      );
    return given;
  });
}

/** The end day of an offer the owner cancelled. */
export const CANCELLED = '0000-00-00';

/** Ends an offer before its day (given by mistake); logged. */
export function cancelOffer(ctx: Ctx, offerId: number) {
  allow(ctx, 'marketing.manage');
  ctx.db.transaction(() => {
    const o = ctx.db.get<OfferRow>(`${OFFER_SELECT} WHERE o.id = ?`, [offerId]);
    if (!o) throw new RuleError('العرض غير موجود');
    if (o.used_at) throw new RuleError('استُخدم العرض في بيعة: لا يُلغى');
    ctx.db.run('UPDATE offers SET expires_at = ? WHERE id = ?', [CANCELLED, offerId]);
    logAction(ctx, 'offer.cancel', `إلغاء عرض «نفتقدك» لـ «${o.name}»`, { offerId });
  });
}

/** Inside checkout: the offer is used by this sale. */
export function spendOffer(ctx: Ctx, offerId: number, saleId: number) {
  ctx.db.run('UPDATE offers SET sale_id = ?, used_at = ? WHERE id = ?', [
    saleId,
    nowStamp(ctx),
    offerId,
  ]);
}

/** A deleted sale gives its offer back (it still ends on its own day). */
export function freeOffer(ctx: Ctx, saleId: number) {
  ctx.db.run('UPDATE offers SET sale_id = NULL, used_at = NULL WHERE sale_id = ?', [saleId]);
}

export const missYouText = (template: string, o: Offer) =>
  fill(template, {
    الاسم: o.customerName,
    الخصم: `${o.percent}%`,
    الحد: formatLyd(o.cap),
    حتى: o.expiresAt.split('-').reverse().join('/'),
  });

export type OffersReport = {
  given: number;
  used: number;
  /** What came off at checkout and what those sales came to. */
  off: number;
  sales: number;
  offers: Offer[];
};

/** Who got the offer and who came back with it (newest first). */
export function offersReport(ctx: Ctx, limit = 100): OffersReport {
  const totals = ctx.db.get<{ given: number; used: number; off: number; sales: number }>(
    `SELECT count(*) given, count(o.used_at) used, coalesce(sum(s.offer_off), 0) off,
            coalesce(sum(s.total), 0) sales
       FROM offers o LEFT JOIN sales s ON s.id = o.sale_id`,
  ) ?? { given: 0, used: 0, off: 0, sales: 0 };
  return {
    ...totals,
    offers: ctx.db
      .all<OfferRow>(`${OFFER_SELECT} ORDER BY o.id DESC LIMIT ?`, [limit])
      .map(toOffer),
  };
}
