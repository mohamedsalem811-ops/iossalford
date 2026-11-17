/**
 * Profit by brand, category and piece (J4), the owner's: for a month, a quarter or a year, each
 * brand's sales, pieces, cost, profit and margin after returns; a brand opens into its
 * categories, a category into its pieces.
 *
 * Everything comes from what each sale kept (the line's price, cost, brand and category at the
 * time of sale), so a later price, cost or brand change never changes the past. A return counts
 * in the month it was made (as in the month summary): its refund comes off the sales, the cost
 * of the piece back in stock off the cost. A return without a sale goes to the piece's brand and
 * category today. The brands add up to the summary's sales profit (gross profit less refunds
 * plus the returned cost).
 */
import {
  parseMonthKey,
  quarterMonths,
  quarterTitle,
  monthTitle,
  type MonthKey,
  type Quarter,
} from '@/lib/dates';

import { allowView, type Ctx } from './context';

export type ProfitPeriod =
  | { kind: 'month'; key: MonthKey }
  | { kind: 'quarter'; key: string }
  | { kind: 'year'; key: string };

const quarterOfKey = (key: string): Quarter => {
  const [y, q] = key.split('-Q').map(Number);
  return { year: y, quarter: q as Quarter['quarter'] };
};

/** The months of a period, oldest first. */
export function periodMonths(p: ProfitPeriod): MonthKey[] {
  if (p.kind === 'month') return [p.key];
  if (p.kind === 'quarter') return quarterMonths(quarterOfKey(p.key));
  return Array.from({ length: 12 }, (_, i) => `${p.key}-${String(i + 1).padStart(2, '0')}`);
}

/** "نوفمبر 2026", "الربع الرابع 2026", "سنة 2026". */
export function periodTitle(p: ProfitPeriod): string {
  if (p.kind === 'month') return monthTitle(p.key);
  if (p.kind === 'quarter') return quarterTitle(quarterOfKey(p.key));
  return `سنة ${p.key}`;
}

/** The period just before or after (`delta` −1 or +1). */
export function shiftPeriod(p: ProfitPeriod, delta: number): ProfitPeriod {
  if (p.kind === 'year') return { kind: 'year', key: String(Number(p.key) + delta) };
  if (p.kind === 'quarter') {
    const q = quarterOfKey(p.key);
    const n = q.year * 4 + (q.quarter - 1) + delta;
    return { kind: 'quarter', key: `${Math.floor(n / 4)}-Q${(n % 4) + 1}` };
  }
  const m = parseMonthKey(p.key)!;
  const d = new Date(m.year, m.month - 1 + delta, 1);
  return {
    kind: 'month',
    key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
  };
}

/** The period of a kind that holds this month. */
export function periodOf(kind: ProfitPeriod['kind'], month: MonthKey): ProfitPeriod {
  const m = parseMonthKey(month)!;
  if (kind === 'year') return { kind, key: String(m.year) };
  if (kind === 'quarter') return { kind, key: `${m.year}-Q${Math.floor((m.month - 1) / 3) + 1}` };
  return { kind, key: month };
}

export type ProfitRow = {
  /** The brand, category or piece as kept by the sales ('' when none). */
  key: string;
  label: string;
  /** At the piece level. */
  productId?: number;
  /** Sold before returns. */
  sales: number;
  refunds: number;
  netSales: number;
  /** Pieces sold less pieces returned. */
  pieces: number;
  /** The cost of what was sold less the cost of what came back. */
  cost: number;
  profit: number;
  /** Profit as a percent of net sales, rounded (0 when nothing was sold). */
  margin: number;
};

export type ProfitSort = 'profit' | 'margin';

const NO_BRAND = 'بدون ماركة';
const NO_CATEGORY = 'بدون فئة';

/**
 * The rows of a period: by brand, or (with `brand`) by category of that brand, or (with both) by
 * piece. Sorted by profit (the default) or by margin, the largest first.
 */
export function profitRows(
  ctx: Ctx,
  months: MonthKey[],
  open: { brand?: string; category?: string } = {},
  sort: ProfitSort = 'profit',
): ProfitRow[] {
  allowView(ctx, 'costs.view');
  const list = months.map(() => '?').join(', ') || "''";
  // One movement per sold line and per return, with the brand and category it belongs to.
  const moves = `
    SELECT coalesce(l.brand, '') brand, coalesce(l.category, '') category, l.product_id pid,
           l.name name, l.line_total sales, l.quantity q, l.line_cost cost,
           0 refund, 0 rcost, 0 rq
      FROM sale_lines l JOIN sales s ON s.id = l.sale_id WHERE s.month IN (${list})
    UNION ALL
    SELECT CASE WHEN l.id IS NOT NULL THEN coalesce(l.brand, '') ELSE coalesce(b.name, '') END,
           CASE WHEN l.id IS NOT NULL THEN coalesce(l.category, '') ELSE coalesce(p.category, '') END,
           r.product_id, coalesce(l.name, r.name), 0, 0, 0, r.refund, r.cost, r.quantity
      FROM returns r LEFT JOIN sale_lines l ON l.id = r.sale_line_id
      LEFT JOIN products p ON p.id = r.product_id LEFT JOIN brands b ON b.id = p.brand_id
     WHERE r.month IN (${list})`;
  const where: string[] = [];
  const params: (string | number)[] = [...months, ...months];
  if (open.brand !== undefined) {
    where.push('brand = ?');
    params.push(open.brand);
  }
  if (open.brand !== undefined && open.category !== undefined) {
    where.push('category = ?');
    params.push(open.category);
  }
  const level =
    open.brand === undefined ? 'brand' : open.category === undefined ? 'category' : 'piece';
  const group = level === 'piece' ? 'pid' : level;
  const rows = ctx.db.all<{
    key: string;
    pid: number;
    name: string;
    sales: number;
    q: number;
    cost: number;
    refund: number;
    rcost: number;
    rq: number;
  }>(
    `SELECT ${level === 'piece' ? 'max(name)' : group} key, pid, sum(sales) sales, sum(q) q,
            sum(cost) cost, sum(refund) refund, sum(rcost) rcost, sum(rq) rq
       FROM (${moves}) ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY ${group}`,
    params,
  );
  const out = rows.map((r): ProfitRow => {
    const netSales = r.sales - r.refund;
    const cost = r.cost - r.rcost;
    const profit = netSales - cost;
    const label =
      r.key || (level === 'brand' ? NO_BRAND : level === 'category' ? NO_CATEGORY : '—');
    return {
      key: level === 'piece' ? String(r.pid) : r.key,
      label,
      ...(level === 'piece' ? { productId: r.pid } : {}),
      sales: r.sales,
      refunds: r.refund,
      netSales,
      pieces: r.q - r.rq,
      cost,
      profit,
      margin: netSales > 0 ? Math.round((profit / netSales) * 100) : 0,
    };
  });
  const ratio = (r: ProfitRow) => (r.netSales > 0 ? r.profit / r.netSales : -Infinity);
  return out.sort((a, b) =>
    sort === 'margin'
      ? ratio(b) - ratio(a) || b.profit - a.profit
      : b.profit - a.profit || ratio(b) - ratio(a),
  );
}

/** The rows added up, with the margin of the whole. */
export function profitTotals(rows: ProfitRow[]) {
  const t = rows.reduce(
    (a, r) => ({
      sales: a.sales + r.sales,
      refunds: a.refunds + r.refunds,
      netSales: a.netSales + r.netSales,
      pieces: a.pieces + r.pieces,
      cost: a.cost + r.cost,
      profit: a.profit + r.profit,
    }),
    { sales: 0, refunds: 0, netSales: 0, pieces: 0, cost: 0, profit: 0 },
  );
  return { ...t, margin: t.netSales > 0 ? Math.round((t.profit / t.netSales) * 100) : 0 };
}
