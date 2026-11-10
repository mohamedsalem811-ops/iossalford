/** Pure rules of the expenses, quarterly closing and comparison screens. */
import { addMonths, monthKey, quarterOf, type MonthKey, type Quarter } from '@/lib/dates';
import { parseThousandths } from '@/lib/digits';

/** The expense form: a description and an amount. */
export function checkExpense(
  description: string,
  amountText: string,
): { ok: true; amount: number } | { ok: false; message: string } {
  if (!description.trim()) return { ok: false, message: 'اكتب وصف المصروف' };
  const amount = parseThousandths(amountText);
  if (amount === null || amount <= 0) return { ok: false, message: 'أدخل مبلغ المصروف' };
  return { ok: true, amount };
}

/** The quarter of `now` and the ones before it, newest first. */
export function recentQuarters(now: Date, count = 8): Quarter[] {
  const out: Quarter[] = [];
  let q = quarterOf(now)!;
  for (let i = 0; i < count; i++) {
    out.push(q);
    q =
      q.quarter === 1
        ? { year: q.year - 1, quarter: 4 }
        : { year: q.year, quarter: (q.quarter - 1) as Quarter['quarter'] };
  }
  return out;
}

/** The last `count` months up to the current one, oldest first ("2026-06" … "2026-11"). */
export function monthWindow(now: Date, count: number): { from: MonthKey; to: MonthKey } {
  const to = monthKey(now);
  return { from: addMonths(to, -(count - 1)), to };
}

/** Bar lengths for the chart: each value as a share of the largest, 0 to 1. */
export function barShares(values: number[]): number[] {
  const max = Math.max(0, ...values.map((v) => Math.abs(v)));
  return values.map((v) => (max === 0 ? 0 : Math.abs(v) / max));
}
