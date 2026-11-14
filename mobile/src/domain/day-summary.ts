/**
 * The end-of-day summary: one page for one day of one system. Everything comes from records the
 * app already keeps: sales by payment method and by person, discounts and the owner's approvals,
 * returns, debt payments, customer credit paid back, cash moved in and out, expenses, and each
 * shift that ran that day with its count. Owner only (it shows every person's sales).
 */
import { PAYMENT_METHODS, type PaymentMethod } from './checkout';
import { allowView, type Ctx } from './context';
import { listShiftsOn, shiftTotals, type Shift, type ShiftTotals } from './shifts';

export type DayShift = { shift: Shift; totals: ShiftTotals };

export type DaySummary = {
  /** "2026-11-13" */
  day: string;
  sales: number;
  pieces: number;
  total: number;
  /** Paid in money, by method (the part paid with points is `points.paid`). */
  byMethod: Record<PaymentMethod, number>;
  /** Loyalty points (F3): what points paid that day, and the points earned and paid with. */
  points: { paid: number; earned: number; redeemed: number };
  /** Sales per person, the largest first. */
  bySeller: { name: string; sales: number; total: number }[];
  discounts: number;
  /** Visit rewards used that day (G2): how many and what they took off. */
  rewards: { count: number; off: number };
  approvals: number;
  returns: number;
  refunded: number;
  /** Refunds paid in cash (a return on a credit sale lowers the debt instead). */
  cashRefunds: number;
  payments: { cash: number; other: number };
  payouts: { cash: number; other: number };
  cashIn: number;
  cashOut: number;
  expenses: number;
  /**
   * Cash the day brought in, whatever the shifts: cash sales and debt payments, less cash refunds
   * and credit paid back in cash, plus cash put in and less cash taken out of the drawers.
   */
  cashNet: number;
  /** Shifts open at any time that day, oldest first. */
  shifts: DayShift[];
  /** Shortages and extras found in the counts of the shifts closed that day. */
  shortages: number;
  extras: number;
};

/** "2026-11-14" for "2026-11-13". */
export function nextDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const next = new Date(y, m - 1, d + 1);
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, '0')}-${String(next.getDate()).padStart(2, '0')}`;
}

/** "2026-11-12" for "2026-11-13". */
export function previousDay(day: string): string {
  const [y, m, d] = day.split('-').map(Number);
  const prev = new Date(y, m - 1, d - 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}-${String(prev.getDate()).padStart(2, '0')}`;
}

export function daySummary(ctx: Ctx, day: string): DaySummary {
  allowView(ctx, 'reports.view');
  // Times are local "2026-11-13T14:05:00": the day is every time from "2026-11-13" up to the next.
  const range = [day, nextDay(day)];
  const one = <T>(sql: string, fallback: T) => ctx.db.get<T>(sql, range) ?? fallback;

  const byMethod = Object.fromEntries(PAYMENT_METHODS.map((m) => [m, 0])) as Record<
    PaymentMethod,
    number
  >;
  for (const r of ctx.db.all<{ m: PaymentMethod; t: number }>(
    `SELECT payment_method m, sum(total - points_paid) t FROM sales
      WHERE created_at >= ? AND created_at < ? GROUP BY payment_method`,
    range,
  ))
    byMethod[r.m] = r.t;
  const sales = one(
    `SELECT count(*) n, coalesce(sum(total), 0) t, coalesce(sum(discount), 0) d, count(approved_by) a,
            count(nullif(reward_off, 0)) rn, coalesce(sum(reward_off), 0) ro
       FROM sales WHERE created_at >= ? AND created_at < ?`,
    { n: 0, t: 0, d: 0, a: 0, rn: 0, ro: 0 },
  );
  const pieces = one(
    `SELECT coalesce(sum(l.quantity), 0) q FROM sale_lines l JOIN sales s ON s.id = l.sale_id
      WHERE s.created_at >= ? AND s.created_at < ?`,
    { q: 0 },
  ).q;
  // Sales from before staff (no seller) are the owner's, as in the monthly report.
  const bySeller = ctx.db
    .all<{ name: string | null; n: number; t: number }>(
      `SELECT coalesce(seller_name, 'المالك') name, count(*) n, sum(total) t FROM sales
        WHERE created_at >= ? AND created_at < ?
        GROUP BY coalesce(seller, 'owner') ORDER BY t DESC`,
      range,
    )
    .map((r) => ({ name: r.name ?? 'المالك', sales: r.n, total: r.t }));
  const ret = one(
    `SELECT count(*) n, coalesce(sum(r.refund), 0) t,
            coalesce(sum(CASE WHEN s.payment_method = 'credit' THEN 0 ELSE r.refund END), 0) cash,
            count(r.approved_by) a
       FROM returns r LEFT JOIN sale_lines l ON l.id = r.sale_line_id
       LEFT JOIN sales s ON s.id = l.sale_id
      WHERE r.created_at >= ? AND r.created_at < ?`,
    { n: 0, t: 0, cash: 0, a: 0 },
  );
  const split = (table: 'payments' | 'payouts') =>
    one(
      `SELECT coalesce(sum(CASE WHEN method = 'cash' THEN amount END), 0) cash,
              coalesce(sum(CASE WHEN method <> 'cash' THEN amount END), 0) other
         FROM ${table} WHERE created_at >= ? AND created_at < ?`,
      { cash: 0, other: 0 },
    );
  const payments = split('payments');
  const payouts = split('payouts');
  const moves = one(
    `SELECT coalesce(sum(CASE kind WHEN 'in' THEN amount END), 0) i,
            coalesce(sum(CASE kind WHEN 'out' THEN amount END), 0) o
       FROM cash_moves WHERE created_at >= ? AND created_at < ?`,
    { i: 0, o: 0 },
  );
  const expenses = one(
    'SELECT coalesce(sum(amount), 0) t FROM expenses WHERE created_at >= ? AND created_at < ?',
    { t: 0 },
  ).t;

  const shifts = listShiftsOn(ctx, day, nextDay(day)).map((shift) => ({
    shift,
    totals: shiftTotals(ctx, shift),
  }));
  const closedToday = shifts.filter(
    (s) => s.shift.closedAt !== null && s.shift.closedAt >= day && s.shift.closedAt < nextDay(day),
  );
  const differences = closedToday.map((s) => s.shift.difference ?? 0);

  const pts = one(
    `SELECT coalesce((SELECT sum(points_paid) FROM sales WHERE created_at >= ?1 AND created_at < ?2), 0) paid,
            coalesce((SELECT sum(points) FROM loyalty_moves
                       WHERE kind = 'earn' AND created_at >= ?1 AND created_at < ?2), 0) earned,
            coalesce((SELECT -sum(points) FROM loyalty_moves
                       WHERE kind = 'redeem' AND created_at >= ?1 AND created_at < ?2), 0) redeemed`,
    { paid: 0, earned: 0, redeemed: 0 },
  );
  return {
    day,
    sales: sales.n,
    pieces,
    total: sales.t,
    byMethod,
    points: pts,
    bySeller,
    discounts: sales.d,
    rewards: { count: sales.rn, off: sales.ro },
    approvals: sales.a + ret.a,
    returns: ret.n,
    refunded: ret.t,
    cashRefunds: ret.cash,
    payments,
    payouts,
    cashIn: moves.i,
    cashOut: moves.o,
    expenses,
    cashNet: byMethod.cash + payments.cash - ret.cash - payouts.cash + moves.i - moves.o,
    shifts,
    shortages: -differences.filter((d) => d < 0).reduce((t, d) => t + d, 0),
    extras: differences.filter((d) => d > 0).reduce((t, d) => t + d, 0),
  };
}
