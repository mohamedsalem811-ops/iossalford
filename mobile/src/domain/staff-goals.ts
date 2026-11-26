/**
 * Staff targets and the bonus on slow pieces (phase L), per system like the sales they count.
 *
 * - One monthly target for every employee (the owner's). An employee's month is their sales,
 *   after discounts, less the refunds of returns of their sales made that month.
 * - The ranking shows each employee their place and everyone's % of the target, never amounts.
 * - The owner puts a bonus on slow pieces (no sale in 90 days). An employee who sells one earns it,
 *   kept on the sale line at checkout; a return of it, in the month of the return, takes it back.
 * - A month's bonus goes into each employee's account once, by the owner, after the month ends;
 *   the owner then records paying it out.
 */
import { addMonths, type MonthKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { actorKey } from '@/staff/model';

import { logAction } from './activity';
import { allow, allowView, nowMonth, nowStamp, RuleError, who, type Ctx } from './context';
import { getSetting, setSetting } from './settings';

/** A piece is slow, for the bonus, after this many days without a sale (the owner's choice). */
export const SLOW_BONUS_DAYS = 90;

export type Goals = {
  /** The monthly target of every employee, in dirhams; 0: no target. */
  target: number;
  /** The bonus offered first when the owner turns one on for a piece, in dirhams. */
  bonusDefault: number;
};
export const DEFAULT_GOALS: Goals = { target: 0, bonusDefault: 20_000 };
const KEY = 'staff.goals';

export function getGoals(ctx: Ctx): Goals {
  const raw = getSetting(ctx, KEY);
  if (!raw) return DEFAULT_GOALS;
  try {
    const v = JSON.parse(raw) as Partial<Goals>;
    const whole = (n: unknown, d: number) =>
      Number.isInteger(n) && (n as number) >= 0 ? (n as number) : d;
    return {
      target: whole(v.target, DEFAULT_GOALS.target),
      bonusDefault: whole(v.bonusDefault, DEFAULT_GOALS.bonusDefault) || DEFAULT_GOALS.bonusDefault,
    };
  } catch {
    return DEFAULT_GOALS;
  }
}

/** The owner sets the monthly target (0: none) or the first bonus offered. */
export function setGoals(ctx: Ctx, changes: Partial<Goals>): Goals {
  allow(ctx, 'settings.edit');
  const next = { ...getGoals(ctx), ...changes };
  if (!Number.isInteger(next.target) || next.target < 0) throw new RuleError('اكتب الهدف بالدينار');
  if (!Number.isInteger(next.bonusDefault) || next.bonusDefault <= 0)
    throw new RuleError('اكتب مبلغ المكافأة بالدينار');
  return ctx.db.transaction(() => {
    setSetting(ctx, KEY, JSON.stringify(next));
    logAction(
      ctx,
      'settings.goals',
      `الهدف الشهري ${next.target ? formatLyd(next.target) : 'بلا هدف'}، المكافأة ${formatLyd(next.bonusDefault)}`,
      { ...next },
    );
    return next;
  });
}

// ---------- A month per employee ----------

export type StaffMonth = {
  key: string;
  /** Sales and their total after discounts. */
  sales: number;
  total: number;
  pieces: number;
  /** Discounts the person gave (not the shop's rewards). */
  discounts: number;
  /** Returns this month of their sales, and what was refunded. */
  returns: number;
  refunds: number;
  /** Their total less the refunds: what counts toward the target. */
  net: number;
  /** New customers whose first sale was theirs this month. */
  newCustomers: number;
  /** The bonus earned on slow pieces, taken back by returns, and the month's net. */
  bonusEarned: number;
  bonusReturned: number;
  bonus: number;
};

const EMPTY = (key: string): StaffMonth => ({
  key,
  sales: 0,
  total: 0,
  pieces: 0,
  discounts: 0,
  returns: 0,
  refunds: 0,
  net: 0,
  newCustomers: 0,
  bonusEarned: 0,
  bonusReturned: 0,
  bonus: 0,
});

/** Every employee's month (keys "emp-…"), the owner's sales left out. No permission check. */
function staffMonths(ctx: Ctx, month: MonthKey): Map<string, StaffMonth> {
  const out = new Map<string, StaffMonth>();
  const of = (key: string) => {
    let m = out.get(key);
    if (!m) out.set(key, (m = EMPTY(key)));
    return m;
  };
  for (const r of ctx.db.all<{
    key: string;
    n: number;
    total: number;
    discount: number;
    pieces: number;
    bonus: number;
  }>(
    `SELECT s.seller key, count(*) n, sum(s.total) total, sum(s.discount) discount,
            coalesce(sum(l.pieces), 0) pieces, coalesce(sum(l.bonus), 0) bonus
       FROM sales s
       LEFT JOIN (SELECT sale_id, sum(quantity) pieces, sum(bonus * quantity) bonus
                    FROM sale_lines GROUP BY sale_id) l ON l.sale_id = s.id
      WHERE s.month = ? AND s.seller LIKE 'emp-%' GROUP BY s.seller`,
    [month],
  )) {
    const m = of(r.key);
    m.sales = r.n;
    m.total = r.total;
    m.discounts = r.discount;
    m.pieces = r.pieces;
    m.bonusEarned = r.bonus;
  }
  for (const r of ctx.db.all<{ key: string; n: number; refunds: number; bonus: number }>(
    `SELECT s.seller key, count(*) n, sum(r.refund) refunds, sum(l.bonus * r.quantity) bonus
       FROM returns r JOIN sale_lines l ON l.id = r.sale_line_id JOIN sales s ON s.id = l.sale_id
      WHERE r.month = ? AND s.seller LIKE 'emp-%' GROUP BY s.seller`,
    [month],
  )) {
    const m = of(r.key);
    m.returns = r.n;
    m.refunds = r.refunds;
    m.bonusReturned = r.bonus;
  }
  for (const r of ctx.db.all<{ key: string; n: number }>(
    `SELECT first.seller key, count(*) n FROM customers c
       JOIN sales first ON first.id = (SELECT min(id) FROM sales WHERE customer_id = c.id)
      WHERE substr(c.created_at, 1, 7) = ? AND first.month = ? AND first.seller LIKE 'emp-%'
      GROUP BY first.seller`,
    [month, month],
  ))
    of(r.key).newCustomers = r.n;
  for (const m of out.values()) {
    m.net = m.total - m.refunds;
    m.bonus = m.bonusEarned - m.bonusReturned;
  }
  return out;
}

const percentOf = (net: number, target: number) =>
  target > 0 ? Math.max(0, Math.floor((net * 100) / target)) : 0;

const daysIn = (month: MonthKey) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m, 0).getDate();
};

export type Person = { key: string; name: string };

export type RankRow = { key: string; name: string; percent: number; best: boolean };

/**
 * The ranking of a month (phase L): each person with their % of the target, best first, never an
 * amount. With no target, the order is by sales and no % is shown (percent 0). `best` marks the
 * best seller, once someone has sold.
 */
function rank(months: Map<string, StaffMonth>, people: Person[], target: number): RankRow[] {
  const rows = people.map((p) => {
    const net = months.get(p.key)?.net ?? 0;
    return { key: p.key, name: p.name, net, percent: percentOf(net, target) };
  });
  rows.sort((a, b) => b.net - a.net || a.name.localeCompare(b.name, 'ar'));
  return rows.map(({ key, name, percent, net }, i) => ({
    key,
    name,
    percent,
    best: i === 0 && net > 0,
  }));
}

export type MyGoal = {
  target: number;
  net: number;
  percent: number;
  /** What is left to reach the target (0 once reached). */
  left: number;
  /** Days left in the month, today included, and what a day needs to reach the target. */
  daysLeft: number;
  perDay: number;
  reached: boolean;
  /** Their place, of how many. */
  place: number;
  of: number;
  ranking: RankRow[];
  /** The bonus this month so far: earned, taken back by returns, net. */
  bonus: { earned: number; returned: number; net: number };
};

/**
 * The signed-in employee's month (phase L), for their home screen. It reads everyone's sales, but
 * gives only their own amounts: the others are names and % of the target.
 */
export function myGoal(ctx: Ctx, people: Person[]): MyGoal | null {
  const actor = ctx.actor;
  if (actor?.kind !== 'employee') return null;
  const me = actorKey(actor);
  const month = nowMonth(ctx);
  const { target } = getGoals(ctx);
  const months = staffMonths(ctx, month);
  const mine = months.get(me) ?? EMPTY(me);
  const everyone = people.some((p) => p.key === me)
    ? people
    : [...people, { key: me, name: actor.name }];
  const ranking = rank(months, everyone, target);
  const left = Math.max(0, target - mine.net);
  const daysLeft = daysIn(month) - ctx.now().getDate() + 1;
  return {
    target,
    net: mine.net,
    percent: percentOf(mine.net, target),
    left,
    daysLeft,
    perDay: left ? Math.ceil(left / daysLeft) : 0,
    reached: target > 0 && mine.net >= target,
    place: ranking.findIndex((r) => r.key === me) + 1,
    of: ranking.length,
    ranking,
    bonus: { earned: mine.bonusEarned, returned: mine.bonusReturned, net: mine.bonus },
  };
}

// ---------- The owner's monthly report ----------

export type StaffReportRow = StaffMonth & {
  name: string;
  percent: number;
  average: number;
  best: boolean;
  /** The month's bonus is already in their account. */
  credited: boolean;
};

export type StaffReport = {
  month: MonthKey;
  target: number;
  rows: StaffReportRow[];
  /** The month has ended, so its bonus can go into the accounts. */
  ended: boolean;
  /** Bonuses not in the accounts yet (people with a bonus this month, not credited). */
  toCredit: number;
};

/** The owner's monthly staff report (phase L): every employee, best seller first. */
export function staffReport(ctx: Ctx, month: MonthKey, people: Person[]): StaffReport {
  allowView(ctx, 'staff.manage');
  const { target } = getGoals(ctx);
  const months = staffMonths(ctx, month);
  // Someone no longer on the list who sold this month is still in the report.
  const named = new Map(people.map((p) => [p.key, p.name]));
  for (const key of months.keys())
    if (!named.has(key))
      named.set(
        key,
        ctx.db.get<{ n: string }>('SELECT max(seller_name) n FROM sales WHERE seller = ?', [key])
          ?.n ?? key,
      );
  const all = [...named].map(([key, name]) => ({ key, name }));
  const credited = creditedKeys(ctx, month);
  const rows = rank(months, all, target).map((r): StaffReportRow => {
    const m = months.get(r.key) ?? EMPTY(r.key);
    return {
      ...m,
      name: r.name,
      percent: r.percent,
      best: r.best,
      average: m.sales ? Math.round(m.total / m.sales) : 0,
      credited: credited.has(r.key),
    };
  });
  return {
    month,
    target,
    rows,
    ended: month < nowMonth(ctx),
    toCredit: rows.filter((r) => r.bonus !== 0 && !r.credited).length,
  };
}

const creditedKeys = (ctx: Ctx, month: MonthKey) =>
  new Set(
    ctx.db
      .all<{ employee: string }>('SELECT employee FROM staff_ledger WHERE bonus_month = ?', [month])
      .map((r) => r.employee),
  );

/**
 * The owner adds a month's bonus to each employee's account (phase L), once per person, after the
 * month ends: the shop owes it ('bonus'); when returns took back more than was earned, the
 * difference is owed by the employee ('bonus_back'). Returns how many accounts changed.
 */
export function creditBonuses(ctx: Ctx, month: MonthKey, people: Person[]): number {
  allow(ctx, 'staff.ledger');
  if (month >= nowMonth(ctx)) throw new RuleError('تُضاف مكافآت الشهر بعد نهايته');
  const names = new Map(people.map((p) => [p.key, p.name]));
  return ctx.db.transaction(() => {
    const done = creditedKeys(ctx, month);
    let n = 0;
    for (const m of staffMonths(ctx, month).values()) {
      if (m.bonus === 0 || done.has(m.key)) continue;
      const name =
        names.get(m.key) ??
        ctx.db.get<{ n: string }>('SELECT max(seller_name) n FROM sales WHERE seller = ?', [m.key])
          ?.n ??
        m.key;
      const kind = m.bonus > 0 ? 'bonus' : 'bonus_back';
      const id = ctx.db.run(
        `INSERT INTO staff_ledger (employee, employee_name, kind, amount, note, created_at, month, by, by_name, bonus_month)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          m.key,
          name,
          kind,
          Math.abs(m.bonus),
          `مكافآت القطع الراكدة ${month}`,
          nowStamp(ctx),
          nowMonth(ctx),
          ...who(ctx),
          month,
        ],
      ).lastInsertRowId;
      logAction(
        ctx,
        'ledger.bonus',
        `${kind === 'bonus' ? 'مكافآت' : 'إرجاع مكافآت'} ${name} لشهر ${month}: ${formatLyd(Math.abs(m.bonus))}`,
        { ledgerId: id, employee: m.key, month, amount: m.bonus },
      );
      n++;
    }
    return n;
  });
}

/** The last month that has ended: the one whose bonus is added next. */
export const lastMonth = (ctx: Ctx) => addMonths(nowMonth(ctx), -1);

// ---------- The bonus on pieces ----------

/** The owner turns a piece's bonus on (an amount per piece) or off (null). */
export function setProductBonus(ctx: Ctx, productId: number, amount: number | null): void {
  allow(ctx, 'products.edit');
  if (amount !== null && (!Number.isInteger(amount) || amount <= 0))
    throw new RuleError('اكتب مبلغ المكافأة بالدينار');
  ctx.db.transaction(() => {
    const p = ctx.db.get<{ name: string; bonus: number | null }>(
      'SELECT name, bonus FROM products WHERE id = ?',
      [productId],
    );
    if (!p) throw new RuleError('القطعة غير موجودة');
    ctx.db.run('UPDATE products SET bonus = ?, updated_at = ? WHERE id = ?', [
      amount,
      nowStamp(ctx),
      productId,
    ]);
    logAction(
      ctx,
      'product.bonus',
      amount ? `مكافأة ${formatLyd(amount)} لكل قطعة من «${p.name}»` : `إيقاف مكافأة «${p.name}»`,
      { productId, amount, was: p.bonus },
    );
  });
}

export type BonusPiece = {
  productId: number;
  name: string;
  size: string | null;
  stock: number;
  bonus: number;
};

/** The pieces with a bonus on them now, the biggest bonus first (the owner's slow-stock screen). */
export function bonusPieces(ctx: Ctx): BonusPiece[] {
  allowView(ctx, 'costs.view');
  return ctx.db.all<BonusPiece>(
    `SELECT id productId, name, size, stock, bonus FROM products
      WHERE bonus IS NOT NULL AND archived = 0 ORDER BY bonus DESC, name`,
  );
}

/** How many people have last month's bonus still to add to their account (the dashboard). */
export function bonusesToCredit(ctx: Ctx): number {
  allowView(ctx, 'staff.manage');
  const month = lastMonth(ctx);
  const done = creditedKeys(ctx, month);
  return [...staffMonths(ctx, month).values()].filter((m) => m.bonus !== 0 && !done.has(m.key))
    .length;
}
