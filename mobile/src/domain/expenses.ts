import { parseMonthKey, quarterKey, quarterOf } from '@/lib/dates';

import { allow, clean, nowMonth, nowStamp, RuleError, type Ctx } from './context';

export type Expense = {
  id: number;
  description: string;
  amount: number;
  month: string;
  createdAt: string;
};

type Row = { id: number; description: string; amount: number; month: string; created_at: string };
const toExpense = (r: Row): Expense => ({
  id: r.id,
  description: r.description,
  amount: r.amount,
  month: r.month,
  createdAt: r.created_at,
});

/** Records an expense, booked to a chosen month (this month by default). */
export function addExpense(
  ctx: Ctx,
  input: { description: string; amount: number; month?: string },
): number {
  allow(ctx, 'expenses.edit');
  const description = clean(input.description);
  if (!description) throw new RuleError('اكتب وصف المصروف');
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new RuleError('أدخل مبلغ المصروف');
  const month = input.month ?? nowMonth(ctx);
  if (!parseMonthKey(month)) throw new RuleError('الشهر غير صحيح');
  return ctx.db.run(
    'INSERT INTO expenses (description, amount, month, created_at) VALUES (?, ?, ?, ?)',
    [description, input.amount, month, nowStamp(ctx)],
  ).lastInsertRowId;
}

export function deleteExpense(ctx: Ctx, id: number) {
  allow(ctx, 'expenses.edit');
  ctx.db.run('DELETE FROM expenses WHERE id = ?', [id]);
}

export function listExpenses(ctx: Ctx, month?: string): Expense[] {
  const rows = month
    ? ctx.db.all<Row>('SELECT * FROM expenses WHERE month = ? ORDER BY id DESC', [month])
    : ctx.db.all<Row>('SELECT * FROM expenses ORDER BY month DESC, id DESC');
  return rows.map(toExpense);
}

/** Expenses grouped by month, newest month first, with each month's total. */
export function expensesByMonth(ctx: Ctx): { month: string; total: number; items: Expense[] }[] {
  const groups = new Map<string, Expense[]>();
  for (const e of listExpenses(ctx)) groups.set(e.month, [...(groups.get(e.month) ?? []), e]);
  return [...groups.entries()].map(([month, items]) => ({
    month,
    items,
    total: items.reduce((t, e) => t + e.amount, 0),
  }));
}

/** True when the quarter this month belongs to has already been closed (the screen warns). */
export function isMonthClosed(ctx: Ctx, month: string): boolean {
  const q = quarterOf(month);
  return !!q && !!ctx.db.get('SELECT 1 FROM closings WHERE period_key = ?', [quarterKey(q)]);
}
