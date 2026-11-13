import { formatDinars, formatLyd } from '@/lib/money';

import { allow, clean, nowMonth, nowStamp, RuleError, type Ctx, who } from './context';
import { getCustomer, type Customer } from './customers';
import { logAction } from './activity';
import { shiftFor } from './shifts';

/**
 * What a customer still owes: their credit (آجل) sales, minus refunds on returns of those sales,
 * minus payments received. Negative means the shop owes the customer ("له رصيد").
 */
export function balance(ctx: Ctx, customerId: number): number {
  const r = ctx.db.get<{ owed: number; refunded: number; paid: number }>(
    `SELECT
       coalesce((SELECT sum(total) FROM sales WHERE customer_id = ?1 AND payment_method = 'credit'), 0) AS owed,
       coalesce((SELECT sum(r.refund) FROM returns r JOIN sale_lines l ON l.id = r.sale_line_id
                  JOIN sales s ON s.id = l.sale_id
                 WHERE s.customer_id = ?1 AND s.payment_method = 'credit'), 0) AS refunded,
       coalesce((SELECT sum(amount) FROM payments WHERE customer_id = ?1), 0) AS paid`,
    [customerId],
  )!;
  return r.owed - r.refunded - r.paid;
}

export type Debtor = { customer: Customer; balance: number };

/**
 * Every customer's balance (the same rule as `balance`) in one query, for lists: the time stays
 * the same however many customers and years of sales there are. Customers with no balance are
 * left out.
 */
export function allBalances(ctx: Ctx): Map<number, number> {
  const rows = ctx.db.all<{ id: number; balance: number }>(
    `SELECT c.id, coalesce(o.owed, 0) - coalesce(r.refunded, 0) - coalesce(p.paid, 0) AS balance
       FROM customers c
       LEFT JOIN (SELECT customer_id, sum(total) AS owed FROM sales
                   WHERE payment_method = 'credit' AND customer_id IS NOT NULL
                   GROUP BY customer_id) o ON o.customer_id = c.id
       LEFT JOIN (SELECT s.customer_id, sum(r.refund) AS refunded FROM returns r
                    JOIN sale_lines l ON l.id = r.sale_line_id JOIN sales s ON s.id = l.sale_id
                   WHERE s.payment_method = 'credit' AND s.customer_id IS NOT NULL
                   GROUP BY s.customer_id) r ON r.customer_id = c.id
       LEFT JOIN (SELECT customer_id, sum(amount) AS paid FROM payments GROUP BY customer_id) p
              ON p.customer_id = c.id
      WHERE o.owed IS NOT NULL OR p.paid IS NOT NULL`,
  );
  return new Map(rows.filter((r) => r.balance !== 0).map((r) => [r.id, r.balance]));
}

const withBalances = (ctx: Ctx, keep: (b: number) => boolean): Debtor[] =>
  [...allBalances(ctx)]
    .filter(([, b]) => keep(b))
    .map(([id, b]) => ({ customer: getCustomer(ctx, id)!, balance: b }))
    .filter((d) => d.customer);

/** Customers who owe money, largest balance first. */
export function debtors(ctx: Ctx): Debtor[] {
  return withBalances(ctx, (b) => b > 0).sort((a, b) => b.balance - a.balance);
}

export const totalOutstanding = (ctx: Ctx) => debtors(ctx).reduce((t, d) => t + d.balance, 0);

/** Customers the shop owes money to (they paid more than they owe after returns). */
export function creditBalances(ctx: Ctx): Debtor[] {
  return withBalances(ctx, (b) => b < 0).sort((a, b) => a.balance - b.balance);
}

export type Payment = {
  id: number;
  customerId: number;
  amount: number;
  method: string;
  note: string | null;
  createdAt: string;
  month: string;
};

/** Records money received from a customer; it can't be more than they owe. */
export function recordPayment(
  ctx: Ctx,
  input: { customerId: number; amount: number; method: string; note?: string },
): number {
  const actor = allow(ctx, 'payments.create');
  if (!getCustomer(ctx, input.customerId)) throw new RuleError('الزبون غير موجود');
  if (!Number.isInteger(input.amount) || input.amount <= 0)
    throw new RuleError('يرجى إدخال مبلغ الدفعة');
  const owed = balance(ctx, input.customerId);
  if (input.amount > owed)
    throw new RuleError(
      `المبلغ أكبر من المستحق على الزبون (${formatDinars(Math.max(0, owed))} د.ل)`,
    );
  return ctx.db.transaction(() => {
    const shiftId = shiftFor(ctx, actor);
    const id = ctx.db.run(
      'INSERT INTO payments (customer_id, amount, method, note, created_at, month, by, by_name, shift_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        input.customerId,
        input.amount,
        input.method,
        clean(input.note),
        nowStamp(ctx),
        nowMonth(ctx),
        ...who(ctx),
        shiftId,
      ],
    ).lastInsertRowId;
    logAction(
      ctx,
      'payment.add',
      `دفعة ${formatLyd(input.amount)} من «${getCustomer(ctx, input.customerId)?.name}»`,
      { paymentId: id, customerId: input.customerId, amount: input.amount },
    );
    return id;
  });
}

export function deletePayment(ctx: Ctx, id: number) {
  allow(ctx, 'payments.delete');
  ctx.db.transaction(() => {
    const p = ctx.db.get<{ amount: number; name: string | null }>(
      'SELECT p.amount, c.name FROM payments p LEFT JOIN customers c ON c.id = p.customer_id WHERE p.id = ?',
      [id],
    );
    if (!p) return;
    ctx.db.run('DELETE FROM payments WHERE id = ?', [id]);
    logAction(ctx, 'payment.delete', `حذف دفعة ${formatLyd(p.amount)} من «${p.name ?? '—'}»`, {
      paymentId: id,
    });
  });
}

export function payments(ctx: Ctx, customerId: number): Payment[] {
  return ctx.db
    .all<{
      id: number;
      customer_id: number;
      amount: number;
      method: string;
      note: string | null;
      created_at: string;
      month: string;
    }>('SELECT * FROM payments WHERE customer_id = ? ORDER BY id DESC', [customerId])
    .map((p) => ({
      id: p.id,
      customerId: p.customer_id,
      amount: p.amount,
      method: p.method,
      note: p.note,
      createdAt: p.created_at,
      month: p.month,
    }));
}

/**
 * Deletes a customer. Refused while they owe money or are owed money, and while they have credit
 * sales or payments on record (deleting them would lose who owes what). Their cash sales keep
 * the customer's name.
 */
export function deleteCustomer(ctx: Ctx, id: number) {
  allow(ctx, 'customers.delete');
  ctx.db.transaction(() => {
    const c = getCustomer(ctx, id);
    if (!c) return;
    const b = balance(ctx, id);
    if (b > 0) throw new RuleError(`لا يمكن حذف «${c.name}»: عليه ${formatDinars(b)} د.ل`);
    if (b < 0) throw new RuleError(`لا يمكن حذف «${c.name}»: له رصيد ${formatDinars(-b)} د.ل`);
    const credit = ctx.db.get(
      `SELECT 1 FROM sales WHERE customer_id = ?1 AND payment_method = 'credit' UNION ALL SELECT 1 FROM payments WHERE customer_id = ?1 LIMIT 1`,
      [id],
    );
    if (credit) throw new RuleError(`لا يمكن حذف «${c.name}»: له تعاملات آجلة مسجلة`);
    ctx.db.run('DELETE FROM customers WHERE id = ?', [id]);
    logAction(ctx, 'customer.delete', `حذف الزبون «${c.name}»`, { customerId: id });
  });
}

export type StatementLine = {
  kind: 'sale' | 'refund' | 'payment';
  /** The sale, return or payment id. */
  id: number;
  saleId: number | null;
  createdAt: string;
  /** What it adds to (positive) or takes off (negative) what the customer owes. */
  amount: number;
  /** What the customer owes after this line. */
  balance: number;
  note: string | null;
};

/**
 * The customer's statement: credit sales, refunds on returns of those sales, and payments, oldest
 * first, with what they owe after each. Ends at balance().
 */
export function statement(ctx: Ctx, customerId: number): StatementLine[] {
  const rows = ctx.db.all<{
    kind: StatementLine['kind'];
    id: number;
    sale_id: number | null;
    created_at: string;
    amount: number;
    note: string | null;
  }>(
    `SELECT 'sale' AS kind, id, id AS sale_id, created_at, total AS amount, note
       FROM sales WHERE customer_id = ?1 AND payment_method = 'credit'
     UNION ALL
     SELECT 'refund', r.id, s.id, r.created_at, -r.refund, r.reason
       FROM returns r JOIN sale_lines l ON l.id = r.sale_line_id JOIN sales s ON s.id = l.sale_id
      WHERE s.customer_id = ?1 AND s.payment_method = 'credit'
     UNION ALL
     SELECT 'payment', id, NULL, created_at, -amount, coalesce(note, method)
       FROM payments WHERE customer_id = ?1
     ORDER BY created_at, kind DESC, id`,
    [customerId],
  );
  let running = 0;
  return rows.map((r) => {
    running += r.amount;
    return {
      kind: r.kind,
      id: r.id,
      saleId: r.sale_id,
      createdAt: r.created_at,
      amount: r.amount,
      balance: running,
      note: r.note,
    };
  });
}
