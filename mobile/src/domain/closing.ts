import { quarterKey, quarterMonths, quarterTitle, type Quarter } from '@/lib/dates';

import { allow, clean, nowStamp, type Ctx } from './context';
import { summary } from './reports';

export type Closing = {
  id: number;
  periodKey: string;
  title: string;
  totalSales: number;
  totalCost: number;
  totalExpenses: number;
  totalRefunds: number;
  netProfit: number;
  transactions: number;
  itemsSold: number;
  notes: string | null;
  closedAt: string;
};

type Row = {
  id: number;
  period_key: string;
  title: string;
  total_sales: number;
  total_cost: number;
  total_expenses: number;
  total_refunds: number;
  net_profit: number;
  transactions: number;
  items_sold: number;
  notes: string | null;
  closed_at: string;
};

const toClosing = (r: Row): Closing => ({
  id: r.id,
  periodKey: r.period_key,
  title: r.title,
  totalSales: r.total_sales,
  totalCost: r.total_cost,
  totalExpenses: r.total_expenses,
  totalRefunds: r.total_refunds,
  netProfit: r.net_profit,
  transactions: r.transactions,
  itemsSold: r.items_sold,
  notes: r.notes,
  closedAt: r.closed_at,
});

/** What closing this quarter would record, from ONLY its own sales, returns and expenses. */
export const previewQuarter = (ctx: Ctx, q: Quarter) => summary(ctx, quarterMonths(q));

export function existingClosing(ctx: Ctx, q: Quarter): Closing | undefined {
  const r = ctx.db.get<Row>('SELECT * FROM closings WHERE period_key = ?', [quarterKey(q)]);
  return r ? toClosing(r) : undefined;
}

/** Closes a calendar quarter. Closing it again replaces the earlier closing (re-issue). */
export function closeQuarter(ctx: Ctx, q: Quarter, notes?: string): Closing {
  allow(ctx, 'closing.edit');
  const s = previewQuarter(ctx, q);
  ctx.db.run(
    `INSERT INTO closings (period_key, title, total_sales, total_cost, total_expenses, total_refunds, net_profit, transactions, items_sold, notes, closed_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(period_key) DO UPDATE SET title = excluded.title, total_sales = excluded.total_sales,
       total_cost = excluded.total_cost, total_expenses = excluded.total_expenses, total_refunds = excluded.total_refunds,
       net_profit = excluded.net_profit, transactions = excluded.transactions, items_sold = excluded.items_sold,
       notes = excluded.notes, closed_at = excluded.closed_at`,
    [
      quarterKey(q),
      quarterTitle(q),
      s.grossSales,
      s.costOfSales,
      s.expenses,
      s.refunds,
      s.netProfit,
      s.transactions,
      s.itemsSold,
      clean(notes),
      nowStamp(ctx),
    ],
  );
  return existingClosing(ctx, q)!;
}

/** Closings, newest quarter first. */
export function listClosings(ctx: Ctx): Closing[] {
  return ctx.db.all<Row>('SELECT * FROM closings ORDER BY period_key DESC').map(toClosing);
}

export function deleteClosing(ctx: Ctx, id: number) {
  allow(ctx, 'closing.edit');
  ctx.db.run('DELETE FROM closings WHERE id = ?', [id]);
}
