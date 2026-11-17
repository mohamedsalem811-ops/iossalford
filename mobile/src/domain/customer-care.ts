/**
 * Looking after customers (G3, no database change): birthdays this week, customers who haven't
 * come back, WhatsApp links (a wa.me link: the app itself stays offline), the pieces a customer
 * asked for, duplicate customers and their merge, and the owner's customer report.
 */
import { monthKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { allow, allowView, clean, nowMonth, nowStamp, RuleError, type Ctx, who } from './context';
import {
  customersById,
  getCustomer,
  HEARD,
  listCustomers,
  phoneKey,
  type Customer,
  type Heard,
} from './customers';
import { nextWindow, type BirthdayWindow } from './birthday';
import { spendingByCustomer } from './customer-stats';
import { DEFAULT_TEMPLATES, fill } from './templates';

// ---------------------------------------------------------------- WhatsApp

/** "https://wa.me/218912345678?text=…": a Libyan number in international form, or null. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const key = phoneKey(phone);
  if (!key) return null;
  const digits = key.length <= 9 ? `218${key}` : key;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** The birthday message, with the birthday discount and its dates when it is on (H1). */
export const birthdayMessage = (
  c: Pick<Customer, 'name' | 'gender'>,
  gift: { percent: number; maxOff: number; when: string } | null,
  template = DEFAULT_TEMPLATES.birthday,
) =>
  fill(template, {
    الاسم: c.name,
    عزيزتنا: c.gender === 'male' ? 'عزيزنا' : 'عزيزتنا',
    الهدية: gift
      ? `\nهديتك عندنا: خصم ${gift.percent}% (بحد أقصى ${formatLyd(gift.maxOff)} للخصم) على مشترياتك ${gift.when}.`
      : '',
  });

// ---------------------------------------------------------------- birthdays and visits

/**
 * Customers whose birthday is in the next 7 days, or was in the last 3 (their birthday discount
 * is still on, H1): the earliest first. `days` is negative once it has passed.
 */
export function birthdaysThisWeek(
  ctx: Ctx,
): { customer: Customer; days: number; window: BirthdayWindow }[] {
  const ids = ctx.db
    .all<{ id: number }>('SELECT id FROM customers WHERE birth_month IS NOT NULL')
    .map((r) => r.id);
  return [...customersById(ctx, ids).values()]
    .map((customer) => ({ customer, window: nextWindow(customer, ctx.now()) }))
    .filter((x): x is { customer: Customer; window: BirthdayWindow } => !!x.window)
    .map((x) => ({ ...x, days: x.window.days }))
    .filter((x) => x.days <= 6)
    .sort((a, b) => a.days - b.days || a.customer.name.localeCompare(b.customer.name));
}

/** Customers who bought before but not in the last `days` days, the longest away first. */
export function notBack(ctx: Ctx, days = 90): { customer: Customer; last: string }[] {
  const cutoff = new Date(ctx.now());
  cutoff.setDate(cutoff.getDate() - days);
  const since = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  const rows = ctx.db.all<{ id: number; last: string }>(
    `SELECT customer_id id, max(created_at) last FROM sales WHERE customer_id IS NOT NULL
     GROUP BY customer_id HAVING max(created_at) < ? ORDER BY last`,
    [since],
  );
  const people = customersById(
    ctx,
    rows.map((r) => r.id),
  );
  return rows.flatMap((r) => {
    const customer = people.get(r.id);
    return customer ? [{ customer, last: r.last }] : [];
  });
}

// ---------------------------------------------------------------- wanted pieces

export type WantedPiece = {
  id: number;
  customerId: number;
  text: string;
  createdAt: string;
  doneAt: string | null;
};

type WantedRow = {
  id: number;
  customer_id: number;
  text: string;
  created_at: string;
  done_at: string | null;
};
const toWanted = (r: WantedRow): WantedPiece => ({
  id: r.id,
  customerId: r.customer_id,
  text: r.text,
  createdAt: r.created_at,
  doneAt: r.done_at,
});

/** What a customer asked for, the open ones first. */
export function listWanted(ctx: Ctx, customerId: number): WantedPiece[] {
  return ctx.db
    .all<WantedRow>(
      `SELECT id, customer_id, text, created_at, done_at FROM wanted_pieces WHERE customer_id = ?
       ORDER BY done_at IS NOT NULL, id DESC`,
      [customerId],
    )
    .map(toWanted);
}

export function addWanted(ctx: Ctx, customerId: number, text: string): number {
  allow(ctx, 'customers.edit');
  const t = clean(text);
  if (!t) throw new RuleError('اكتب القطعة التي يريدها الزبون');
  if (t.length > 200) throw new RuleError('النص أطول من 200 حرف.');
  const c = getCustomer(ctx, customerId);
  if (!c) throw new RuleError('الزبون غير موجود');
  return ctx.db.transaction(() => {
    const id = ctx.db.run(
      'INSERT INTO wanted_pieces (customer_id, text, created_at, month, by, by_name) VALUES (?, ?, ?, ?, ?, ?)',
      [customerId, t, nowStamp(ctx), nowMonth(ctx), ...who(ctx)],
    ).lastInsertRowId;
    logAction(ctx, 'wanted.add', `«${c.name}» تريد: ${t}`, { customerId, wantedId: id });
    return id;
  });
}

/** Marks a wanted piece found (or open again); logged. */
export function setWantedDone(ctx: Ctx, id: number, done: boolean) {
  allow(ctx, 'customers.edit');
  const w = ctx.db.get<{ text: string }>('SELECT text FROM wanted_pieces WHERE id = ?', [id]);
  if (!w) throw new RuleError('القطعة غير موجودة');
  ctx.db.transaction(() => {
    ctx.db.run('UPDATE wanted_pieces SET done_at = ? WHERE id = ?', [
      done ? nowStamp(ctx) : null,
      id,
    ]);
    logAction(ctx, 'wanted.done', `${done ? 'وُجدت' : 'لم تُوجد بعد'}: ${w.text}`, {
      wantedId: id,
    });
  });
}

/** Deletes a wanted piece; logged. */
export function deleteWanted(ctx: Ctx, id: number) {
  allow(ctx, 'customers.edit');
  const w = ctx.db.get<{ text: string }>('SELECT text FROM wanted_pieces WHERE id = ?', [id]);
  if (!w) return;
  ctx.db.transaction(() => {
    ctx.db.run('DELETE FROM wanted_pieces WHERE id = ?', [id]);
    logAction(ctx, 'wanted.delete', `حذف طلب: ${w.text}`, { wantedId: id });
  });
}

const words = (t: string) =>
  t
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((w) => w.length >= 3);

/**
 * The open wanted pieces a new product may answer: every word of 3 letters or more of the
 * product (name, brand, category, colour) that appears in what was asked for, at least one.
 */
export function wantedMatches(
  ctx: Ctx,
  product: { name: string; brand?: string | null; category?: string | null; color?: string | null },
): { piece: WantedPiece; customer: Customer }[] {
  const have = new Set(
    words([product.name, product.brand, product.category, product.color].filter(Boolean).join(' ')),
  );
  if (!have.size) return [];
  return ctx.db
    .all<WantedRow>(
      'SELECT id, customer_id, text, created_at, done_at FROM wanted_pieces WHERE done_at IS NULL',
    )
    .map(toWanted)
    .filter((w) => words(w.text).some((x) => have.has(x)))
    .map((piece) => ({ piece, customer: getCustomer(ctx, piece.customerId)! }));
}

// ---------------------------------------------------------------- duplicates and merge

/** Customers with the same name and two different phones: possibly one person twice. */
export function duplicateCustomers(ctx: Ctx): Customer[][] {
  const keys = ctx.db.all<{ k: string }>(
    `SELECT name_key k FROM customers WHERE name_key IS NOT NULL
     GROUP BY name_key HAVING count(*) > 1 AND count(DISTINCT coalesce(phone_key, '')) > 1`,
  );
  return keys.map((r) => {
    const ids = ctx.db
      .all<{ id: number }>('SELECT id FROM customers WHERE name_key = ? ORDER BY id', [r.k])
      .map((x) => x.id);
    const people = customersById(ctx, ids);
    return ids.flatMap((id) => people.get(id) ?? []);
  });
}

/**
 * The owner merges two customers into the one kept: the other one's purchases, debt payments,
 * credit paid back, points, wanted pieces, deposit orders, gifts, offers and messages move to it; the kept one's empty details are filled
 * from the other, the notes are joined; then the other is deleted. Logged.
 */
export function mergeCustomers(ctx: Ctx, keepId: number, dropId: number) {
  allow(ctx, 'customers.merge');
  if (keepId === dropId) throw new RuleError('اختر زبونين مختلفين');
  const keep = getCustomer(ctx, keepId);
  const drop = getCustomer(ctx, dropId);
  if (!keep || !drop) throw new RuleError('الزبون غير موجود');
  ctx.db.transaction(() => {
    for (const table of [
      'sales',
      'payments',
      'payouts',
      'loyalty_moves',
      'wanted_pieces',
      // Database 12 (I1, I4): orders, gifts, offers and the messages sent.
      'orders',
      'gifts',
      'offers',
      'message_log',
    ])
      ctx.db.run(`UPDATE ${table} SET customer_id = ? WHERE customer_id = ?`, [keepId, dropId]);
    // Bring a friend: the one who was sent keeps one record (the kept one's, if both have one);
    // the friends either of them sent now count for the kept one, never for herself.
    if (ctx.db.get('SELECT 1 FROM referrals WHERE friend_id = ?', [keepId]))
      ctx.db.run('DELETE FROM referrals WHERE friend_id = ?', [dropId]);
    else ctx.db.run('UPDATE referrals SET friend_id = ? WHERE friend_id = ?', [keepId, dropId]);
    ctx.db.run('UPDATE referrals SET referrer_id = ? WHERE referrer_id = ?', [keepId, dropId]);
    ctx.db.run('DELETE FROM referrals WHERE friend_id = referrer_id');
    ctx.db.run('UPDATE customers SET referred_by = ? WHERE referred_by = ?', [keepId, dropId]);
    ctx.db.run(
      `UPDATE customers SET referred_by = (SELECT referred_by FROM customers WHERE id = ?)
        WHERE id = ? AND referred_by IS NULL`,
      [dropId, keepId],
    );
    ctx.db.run('UPDATE customers SET referred_by = NULL WHERE id = ? AND referred_by = ?', [
      keepId,
      keepId,
    ]);
    const notes = [keep.notes, drop.notes].filter((n, i, all) => n && all.indexOf(n) === i);
    ctx.db.run(
      `UPDATE customers SET
         area = coalesce(area, ?), gender = coalesce(gender, ?), image_file = coalesce(image_file, ?),
         birth_month = coalesce(birth_month, ?), birth_day = CASE WHEN birth_month IS NULL THEN ? ELSE birth_day END,
         birthday_set_at = CASE WHEN birth_month IS NULL THEN ? ELSE birthday_set_at END,
         heard = coalesce(heard, ?), ring_size = coalesce(ring_size, ?), metal = coalesce(metal, ?),
         colours = coalesce(colours, ?), offers = max(offers, ?), vip = coalesce(vip, ?), notes = ?
       WHERE id = ?`,
      [
        drop.area,
        drop.gender,
        drop.imageFile,
        drop.birthMonth,
        drop.birthDay,
        drop.birthdaySetAt,
        drop.heard,
        drop.ringSize,
        drop.metal,
        drop.colours,
        drop.offers ? 1 : 0,
        drop.vip,
        notes.length ? notes.join('\n') : null,
        keepId,
      ],
    );
    // The kept one has no phone: it takes the other's.
    if (!keep.phone && drop.phone) {
      ctx.db.run('UPDATE customers SET phone = NULL, phone_key = NULL WHERE id = ?', [dropId]);
      ctx.db.run('UPDATE customers SET phone = ?, phone_key = ? WHERE id = ?', [
        drop.phone,
        phoneKey(drop.phone),
        keepId,
      ]);
    }
    ctx.db.run('UPDATE sales SET customer_name = ? WHERE customer_id = ? AND customer_name = ?', [
      keep.name,
      keepId,
      drop.name,
    ]);
    ctx.db.run('DELETE FROM customers WHERE id = ?', [dropId]);
    logAction(
      ctx,
      'customer.merge',
      `دمج «${drop.name}»${drop.phone ? ` (${drop.phone})` : ''} في «${keep.name}»`,
      { keepId, dropId },
    );
  });
}

// ---------------------------------------------------------------- the owner's report

export type CustomerReport = {
  /** Where customers come from, with what they brought in (all time, less returns). */
  bySource: { heard: Heard | null; customers: number; spent: number }[];
  topMonth: { customer: Customer; spent: number }[];
  topYear: { customer: Customer; spent: number }[];
  /** Customers who bought this year, and how many of them came on two days or more. */
  buyers: number;
  returning: number;
  /** Visit rewards this year: how many and what they took off. */
  rewards: { count: number; off: number };
  /** Birthday discounts this year (H1). */
  birthdays: { count: number; off: number };
  /** Bring a friend gifts and «نفتقدك» offers this year (I4). */
  friends: { count: number; off: number };
  offers: { count: number; off: number };
  /** Points this year: earned, and what the points paid. */
  points: { earned: number; paid: number };
};

export function customerReport(ctx: Ctx): CustomerReport {
  allowView(ctx, 'reports.view');
  const now = ctx.now();
  const month = monthKey(now);
  const year = String(now.getFullYear());
  const spent = spendingByCustomer(ctx);
  const customers = listCustomers(ctx);
  const bySource = ([...HEARD, null] as (Heard | null)[]).map((heard) => {
    const of = customers.filter((c) => c.heard === heard);
    return {
      heard,
      customers: of.length,
      spent: of.reduce((t, c) => t + (spent.get(c.id)?.spent ?? 0), 0),
    };
  });
  const top = (since: string) =>
    ctx.db
      .all<{ id: number; t: number }>(
        `SELECT customer_id id, sum(total) t FROM sales WHERE customer_id IS NOT NULL AND created_at >= ?
         GROUP BY customer_id ORDER BY t DESC LIMIT 10`,
        [since],
      )
      .map((r) => ({ customer: getCustomer(ctx, r.id)!, spent: r.t }))
      .filter((x) => !!x.customer);
  const yearStart = `${year}-01-01`;
  const yearBuyers = ctx.db.all<{ id: number }>(
    'SELECT DISTINCT customer_id id FROM sales WHERE customer_id IS NOT NULL AND created_at >= ?',
    [yearStart],
  );
  // Came back: bought on 2 days or more this year, not counting an exchange or a sale whose every
  // piece came back. One query for everyone (J1: one query per customer took 5 s with 10,000).
  const returning =
    ctx.db.get<{ n: number }>(
      `SELECT count(*) n FROM (
         SELECT s.customer_id FROM sales s
          WHERE s.customer_id IS NOT NULL AND s.created_at >= ?
            AND s.id NOT IN (SELECT exchange_sale_id FROM returns WHERE exchange_sale_id IS NOT NULL)
            AND NOT (
              coalesce((SELECT sum(quantity) FROM sale_lines WHERE sale_id = s.id), 0) > 0
              AND coalesce((SELECT sum(r.quantity) FROM returns r
                              JOIN sale_lines sl ON sl.id = r.sale_line_id
                             WHERE sl.sale_id = s.id), 0)
                  >= coalesce((SELECT sum(quantity) FROM sale_lines WHERE sale_id = s.id), 0)
            )
          GROUP BY s.customer_id HAVING count(DISTINCT substr(s.created_at, 1, 10)) >= 2)`,
      [yearStart],
    )?.n ?? 0;
  const rewards = ctx.db.get<{
    n: number;
    t: number;
    bn: number;
    bt: number;
    fn: number;
    ft: number;
    on_: number;
    ot: number;
  }>(
    `SELECT count(nullif(reward_off, 0)) n, coalesce(sum(reward_off), 0) t,
            count(nullif(birthday_off, 0)) bn, coalesce(sum(birthday_off), 0) bt,
            count(nullif(friend_off, 0)) fn, coalesce(sum(friend_off), 0) ft,
            count(nullif(offer_off, 0)) on_, coalesce(sum(offer_off), 0) ot
       FROM sales WHERE created_at >= ?`,
    [yearStart],
  )!;
  const points = ctx.db.get<{ e: number; p: number }>(
    `SELECT coalesce((SELECT sum(points) FROM loyalty_moves WHERE kind = 'earn' AND created_at >= ?1), 0) e,
            coalesce((SELECT sum(points_paid) FROM sales WHERE created_at >= ?1), 0) p`,
    [yearStart],
  )!;
  return {
    bySource,
    topMonth: top(`${month}-01`),
    topYear: top(yearStart),
    buyers: yearBuyers.length,
    returning,
    rewards: { count: rewards.n, off: rewards.t },
    birthdays: { count: rewards.bn, off: rewards.bt },
    friends: { count: rewards.fn, off: rewards.ft },
    offers: { count: rewards.on_, off: rewards.ot },
    points: { earned: points.e, paid: points.p },
  };
}
