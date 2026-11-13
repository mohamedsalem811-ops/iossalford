import { dayKey, daysInMonth, monthRange } from '@/lib/dates';
import { lydToUsd } from '@/lib/money';

import type { PaymentMethod } from './checkout';
import { allowView, type Ctx } from './context';
import { getRate } from './settings';

/** Financial totals for a set of months. Every report uses this so the numbers always agree. */
export type PeriodSummary = {
  /** Sales before refunds. */
  grossSales: number;
  costOfSales: number;
  /** Sales profit before refunds and expenses. */
  grossProfit: number;
  /** Money given back to customers. */
  refunds: number;
  /** Cost of returned pieces (they went back into stock). */
  returnedCost: number;
  expenses: number;
  /** Number of sales (one checkout = one sale). */
  transactions: number;
  itemsSold: number;
  itemsReturned: number;
  netSales: number;
  /** grossProfit − (refunds − returnedCost) − expenses. */
  netProfit: number;
  /** Sales and gross profit in US cents, each sale at its own rate. */
  grossSalesUsd: number;
  grossProfitUsd: number;
  /** Net profit in US cents at the current rate. */
  netProfitUsd: number;
};

function inList(months: string[]) {
  return { sql: months.map(() => '?').join(', ') || "''", params: months };
}

export function summary(ctx: Ctx, months: string[]): PeriodSummary {
  allowView(ctx, 'reports.view');
  const m = inList(months);
  const s = ctx.db.get<{ sales: number; cost: number; n: number }>(
    `SELECT coalesce(sum(total), 0) sales, coalesce(sum(total_cost), 0) cost, count(*) n FROM sales WHERE month IN (${m.sql})`,
    m.params,
  )!;
  const items = ctx.db.get<{ q: number }>(
    `SELECT coalesce(sum(l.quantity), 0) q FROM sale_lines l JOIN sales s ON s.id = l.sale_id WHERE s.month IN (${m.sql})`,
    m.params,
  )!.q;
  const r = ctx.db.get<{ refunds: number; cost: number; q: number }>(
    `SELECT coalesce(sum(refund), 0) refunds, coalesce(sum(cost), 0) cost, coalesce(sum(quantity), 0) q FROM returns WHERE month IN (${m.sql})`,
    m.params,
  )!;
  const expenses = ctx.db.get<{ t: number }>(
    `SELECT coalesce(sum(amount), 0) t FROM expenses WHERE month IN (${m.sql})`,
    m.params,
  )!.t;
  const usd = ctx.db
    .all<{ total: number; total_cost: number; rate: number }>(
      `SELECT total, total_cost, rate FROM sales WHERE month IN (${m.sql})`,
      m.params,
    )
    .reduce(
      (a, x) => ({
        sales: a.sales + lydToUsd(x.total, x.rate),
        profit: a.profit + lydToUsd(x.total - x.total_cost, x.rate),
      }),
      { sales: 0, profit: 0 },
    );
  const grossProfit = s.sales - s.cost;
  const netProfit = grossProfit - (r.refunds - r.cost) - expenses;
  return {
    grossSales: s.sales,
    costOfSales: s.cost,
    grossProfit,
    refunds: r.refunds,
    returnedCost: r.cost,
    expenses,
    transactions: s.n,
    itemsSold: items,
    itemsReturned: r.q,
    netSales: s.sales - r.refunds,
    netProfit,
    grossSalesUsd: usd.sales,
    grossProfitUsd: usd.profit,
    netProfitUsd: lydToUsd(netProfit, getRate(ctx)),
  };
}

export type BreakdownRow = { key: string; total: number; quantity: number; profit: number };

/** Sales grouped by brand, category (material for scarves), size, payment method or seller. */
export function breakdown(
  ctx: Ctx,
  months: string[],
  by: 'brand' | 'category' | 'size' | 'payment' | 'seller',
): BreakdownRow[] {
  allowView(ctx, 'reports.view');
  const m = inList(months);
  if (by === 'seller') {
    // A sale with no seller is the owner's (before employees, or by the owner).
    return ctx.db.all<BreakdownRow>(
      // Sales from before phase S3 have no seller: they are the owner's (audit F-8).
      `SELECT CASE WHEN coalesce(s.seller, 'owner') = 'owner' THEN 'المالك' ELSE max(s.seller_name) END AS key,
              sum(s.total) AS total,
              coalesce(sum((SELECT sum(l.quantity) FROM sale_lines l WHERE l.sale_id = s.id)), 0) AS quantity,
              sum(s.total - s.total_cost) AS profit
         FROM sales s WHERE s.month IN (${m.sql}) GROUP BY coalesce(s.seller, 'owner') ORDER BY total DESC`,
      m.params,
    );
  }
  if (by === 'payment') {
    return ctx.db.all<BreakdownRow>(
      `SELECT payment_method AS key, sum(total) AS total,
              (SELECT coalesce(sum(l.quantity), 0) FROM sale_lines l JOIN sales s2 ON s2.id = l.sale_id
                WHERE s2.payment_method = s.payment_method AND s2.month IN (${m.sql})) AS quantity,
              sum(total - total_cost) AS profit
         FROM sales s WHERE month IN (${m.sql}) GROUP BY payment_method ORDER BY total DESC`,
      [...m.params, ...m.params],
    );
  }
  const column = { brand: 'l.brand', category: 'l.category', size: 'l.size' }[by];
  return ctx.db.all<BreakdownRow>(
    `SELECT coalesce(${column}, '') AS key, sum(l.line_total) AS total, sum(l.quantity) AS quantity,
            sum(l.line_total - l.line_cost) AS profit
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id
      WHERE s.month IN (${m.sql}) GROUP BY coalesce(${column}, '') ORDER BY total DESC`,
    m.params,
  );
}

/** Best-selling products by money taken, with pieces sold. */
export function topProducts(
  ctx: Ctx,
  months: string[],
  limit = 5,
): (BreakdownRow & { productId: number })[] {
  allowView(ctx, 'reports.view');
  const m = inList(months);
  return ctx.db.all(
    `SELECT l.product_id AS productId, max(l.name) AS key, sum(l.line_total) AS total, sum(l.quantity) AS quantity,
            sum(l.line_total - l.line_cost) AS profit
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id
      WHERE s.month IN (${m.sql}) GROUP BY l.product_id ORDER BY total DESC, quantity DESC LIMIT ?`,
    [...m.params, limit],
  );
}

/** Sales per day of a month (every day present, 0 when nothing sold). */
export function dailySales(ctx: Ctx, month: string): { day: number; total: number }[] {
  allowView(ctx, 'reports.view');
  const rows = ctx.db.all<{ day: number; total: number }>(
    `SELECT cast(substr(created_at, 9, 2) AS INTEGER) AS day, sum(total) AS total FROM sales WHERE month = ? GROUP BY day`,
    [month],
  );
  return Array.from({ length: daysInMonth(month) }, (_, i) => ({
    day: i + 1,
    total: rows.find((r) => r.day === i + 1)?.total ?? 0,
  }));
}

export type Today = {
  total: number;
  profit: number;
  sales: number;
  pieces: number;
  byMethod: Record<PaymentMethod, number>;
};

/** Today's sales, profit, number of sales and pieces, and money by payment method. */
export function today(ctx: Ctx): Today {
  allowView(ctx, 'reports.view');
  const day = dayKey(ctx.now());
  const s = ctx.db.get<{ total: number; profit: number; n: number }>(
    `SELECT coalesce(sum(total), 0) total, coalesce(sum(total - total_cost), 0) profit, count(*) n FROM sales WHERE substr(created_at, 1, 10) = ?`,
    [day],
  )!;
  const pieces = ctx.db.get<{ q: number }>(
    `SELECT coalesce(sum(l.quantity), 0) q FROM sale_lines l JOIN sales s ON s.id = l.sale_id WHERE substr(s.created_at, 1, 10) = ?`,
    [day],
  )!.q;
  const byMethod: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, credit: 0 };
  for (const r of ctx.db.all<{ m: PaymentMethod; t: number }>(
    `SELECT payment_method m, sum(total) t FROM sales WHERE substr(created_at, 1, 10) = ? GROUP BY payment_method`,
    [day],
  )) {
    byMethod[r.m] = r.t;
  }
  return { total: s.total, profit: s.profit, sales: s.n, pieces, byMethod };
}

/** Net sales and net profit for each month in a range, oldest first (the comparison chart). */
export function monthlyComparison(ctx: Ctx, from: string, to: string) {
  allowView(ctx, 'reports.view');
  return monthRange(from, to).map((month) => {
    const s = summary(ctx, [month]);
    return { month, netSales: s.netSales, netProfit: s.netProfit, transactions: s.transactions };
  });
}

/** Pieces in stock, their value at cost and at price, and how many items are low or out. */
export function stockSummary(ctx: Ctx) {
  return ctx.db.get<{
    items: number;
    pieces: number;
    costValue: number;
    priceValue: number;
    low: number;
    out: number;
  }>(
    `SELECT count(*) items, coalesce(sum(stock), 0) pieces, coalesce(sum(stock * cost), 0) costValue,
            coalesce(sum(stock * price), 0) priceValue,
            coalesce(sum(CASE WHEN stock > 0 AND stock <= low_stock THEN 1 ELSE 0 END), 0) low,
            coalesce(sum(CASE WHEN stock = 0 THEN 1 ELSE 0 END), 0) out
       FROM products WHERE archived = 0`,
  )!;
}

/** For the scarves dashboard: pieces in stock per size. */
export function stockBySize(ctx: Ctx): { size: string; pieces: number }[] {
  return ctx.db.all(
    `SELECT size, sum(stock) AS pieces FROM products WHERE archived = 0 AND size IS NOT NULL GROUP BY size`,
  );
}

/** Pieces that need attention: out of stock first, then the lowest, by name. */
export function lowStock(
  ctx: Ctx,
  limit = 5,
): { id: number; name: string; size: string | null; stock: number }[] {
  return ctx.db.all(
    `SELECT id, name, size, stock FROM products
      WHERE archived = 0 AND stock <= low_stock
      ORDER BY stock, name LIMIT ?`,
    [limit],
  );
}
