/**
 * Looking after customers (G3, no database change): birthdays this week, customers who haven't
 * come back, WhatsApp links (a wa.me link: the app itself stays offline), the pieces a customer
 * asked for, duplicate customers and their merge, and the owner's customer report.
 */
import { monthKey } from '@/lib/dates';

import { logAction } from './activity';
import { allow, allowView, clean, nowMonth, nowStamp, RuleError, type Ctx, who } from './context';
import {
  getCustomer,
  HEARD,
  listCustomers,
  phoneKey,
  type Customer,
  type Heard,
} from './customers';
import { customerSales, daysToBirthday, spendingByCustomer } from './customer-stats';

// ---------------------------------------------------------------- WhatsApp

/** "https://wa.me/218912345678?text=…": a Libyan number in international form, or null. */
export function waLink(phone: string | null | undefined, text: string): string | null {
  const key = phoneKey(phone);
  if (!key) return null;
  const digits = key.length <= 9 ? `218${key}` : key;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export const birthdayMessage = (c: Pick<Customer, 'name' | 'gender'>, gift: string) =>
  `${c.gender === 'male' ? 'عزيزنا' : 'عزيزتنا'} ${c.name}، كل عام وأنت بخير بمناسبة عيد ميلادك 🎂${
    gift ? `\nهديتك عندنا هذا الأسبوع: ${gift}` : ''
  }\nSALFORD`;

export const missYouMessage = (c: Pick<Customer, 'name' | 'gender'>) =>
  `${c.gender === 'male' ? 'عزيزنا' : 'عزيزتنا'} ${c.name}، اشتقنا لزيارتك! وصلتنا قطع جديدة قد تعجبك.\nSALFORD`;

// ---------------------------------------------------------------- birthdays and visits

/** Customers whose birthday is in the next 7 days (today first). */
export function birthdaysThisWeek(ctx: Ctx): { customer: Customer; days: number }[] {
  return ctx.db
    .all<{ id: number }>('SELECT id FROM customers WHERE birth_month IS NOT NULL')
    .map((r) => getCustomer(ctx, r.id)!)
    .map((customer) => ({ customer, days: daysToBirthday(customer, ctx.now()) }))
    .filter((x): x is { customer: Customer; days: number } => x.days !== null && x.days <= 6)
    .sort((a, b) => a.days - b.days || a.customer.name.localeCompare(b.customer.name));
}

/** Customers who bought before but not in the last `days` days, the longest away first. */
export function notBack(ctx: Ctx, days = 90): { customer: Customer; last: string }[] {
  const cutoff = new Date(ctx.now());
  cutoff.setDate(cutoff.getDate() - days);
  const since = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}-${String(cutoff.getDate()).padStart(2, '0')}`;
  return ctx.db
    .all<{ id: number; last: string }>(
      `SELECT customer_id id, max(created_at) last FROM sales WHERE customer_id IS NOT NULL
       GROUP BY customer_id HAVING max(created_at) < ? ORDER BY last`,
      [since],
    )
    .map((r) => ({ customer: getCustomer(ctx, r.id)!, last: r.last }))
    .filter((x) => !!x.customer);
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
  return keys.map((r) =>
    ctx.db
      .all<{ id: number }>('SELECT id FROM customers WHERE name_key = ? ORDER BY id', [r.k])
      .map((x) => getCustomer(ctx, x.id)!),
  );
}

/**
 * The owner merges two customers into the one kept: the other one's purchases, debt payments,
 * credit paid back, points and wanted pieces move to it; the kept one's empty details are filled
 * from the other, the notes are joined; then the other is deleted. Logged.
 */
export function mergeCustomers(ctx: Ctx, keepId: number, dropId: number) {
  allow(ctx, 'customers.merge');
  if (keepId === dropId) throw new RuleError('اختر زبونين مختلفين');
  const keep = getCustomer(ctx, keepId);
  const drop = getCustomer(ctx, dropId);
  if (!keep || !drop) throw new RuleError('الزبون غير موجود');
  ctx.db.transaction(() => {
    for (const table of ['sales', 'payments', 'payouts', 'loyalty_moves', 'wanted_pieces'])
      ctx.db.run(`UPDATE ${table} SET customer_id = ? WHERE customer_id = ?`, [keepId, dropId]);
    const notes = [keep.notes, drop.notes].filter((n, i, all) => n && all.indexOf(n) === i);
    ctx.db.run(
      `UPDATE customers SET
         area = coalesce(area, ?), gender = coalesce(gender, ?), image_file = coalesce(image_file, ?),
         birth_month = coalesce(birth_month, ?), birth_day = CASE WHEN birth_month IS NULL THEN ? ELSE birth_day END,
         heard = coalesce(heard, ?), ring_size = coalesce(ring_size, ?), metal = coalesce(metal, ?),
         colours = coalesce(colours, ?), offers = max(offers, ?), vip = coalesce(vip, ?), notes = ?
       WHERE id = ?`,
      [
        drop.area,
        drop.gender,
        drop.imageFile,
        drop.birthMonth,
        drop.birthDay,
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
  const returning = yearBuyers.filter(
    (b) =>
      new Set(
        customerSales(ctx, b.id)
          .filter((s) => s.createdAt >= yearStart && !s.exchange && !s.fullyReturned)
          .map((s) => s.day),
      ).size >= 2,
  ).length;
  const rewards = ctx.db.get<{ n: number; t: number }>(
    'SELECT count(nullif(reward_off, 0)) n, coalesce(sum(reward_off), 0) t FROM sales WHERE created_at >= ?',
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
    points: { earned: points.e, paid: points.p },
  };
}
