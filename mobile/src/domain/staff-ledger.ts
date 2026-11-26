/**
 * The employee's account (phase S4): the owner may put a return "على حساب الموظف" (the employee
 * owes its refund) or waive it later, and records what the employee pays back. Lines are only
 * added, never changed: a waive is its own line. Per system, like the sales it comes from.
 */
import { formatLyd } from '@/lib/money';
import { actorKey } from '@/staff/model';
import { can } from '@/staff/permissions';

import { logAction } from './activity';
import {
  allow,
  clean,
  nowMonth,
  nowStamp,
  PermissionError,
  RuleError,
  who,
  type Ctx,
} from './context';
import { getReturn } from './sales';

/**
 * A line of the account. The balance is what the employee owes: a charge, a bonus taken back and a
 * payout add; a repayment, a waive and a bonus (phase L) take off. Below 0, the shop owes them.
 */
export type LedgerKind = 'charge' | 'repay' | 'waive' | 'bonus' | 'bonus_back' | 'payout';

export type LedgerLine = {
  id: number;
  employee: string;
  employeeName: string;
  kind: LedgerKind;
  amount: number;
  returnId: number | null;
  note: string | null;
  createdAt: string;
  byName: string;
};

type Row = {
  id: number;
  employee: string;
  employee_name: string;
  kind: LedgerKind;
  amount: number;
  return_id: number | null;
  note: string | null;
  created_at: string;
  by_name: string | null;
};

const toLine = (r: Row): LedgerLine => ({
  id: r.id,
  employee: r.employee,
  employeeName: r.employee_name,
  kind: r.kind,
  amount: r.amount,
  returnId: r.return_id,
  note: r.note,
  createdAt: r.created_at,
  byName: r.by_name ?? 'المالك',
});

const ADDS: readonly LedgerKind[] = ['charge', 'bonus_back', 'payout'];

/** What a line does to the balance (what the employee owes): see LedgerKind. */
export const signed = (l: Pick<LedgerLine, 'kind' | 'amount'>) =>
  ADDS.includes(l.kind) ? l.amount : -l.amount;

export const KIND_LABELS: Record<LedgerKind, string> = {
  charge: 'على حساب الموظف',
  repay: 'سداد',
  waive: 'إعفاء',
  bonus: 'مكافآت',
  bonus_back: 'إرجاع مكافآت',
  payout: 'دُفع للموظف',
};

function insert(
  ctx: Ctx,
  l: {
    employee: string;
    employeeName: string;
    kind: LedgerKind;
    amount: number;
    returnId?: number | null;
    note?: string;
  },
) {
  return ctx.db.run(
    `INSERT INTO staff_ledger (employee, employee_name, kind, amount, return_id, note, created_at, month, by, by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      l.employee,
      l.employeeName,
      l.kind,
      l.amount,
      l.returnId ?? null,
      clean(l.note),
      nowStamp(ctx),
      nowMonth(ctx),
      ...who(ctx),
    ],
  ).lastInsertRowId;
}

/** The charge still standing on a return (not waived), if any. */
export function returnCharge(ctx: Ctx, returnId: number): LedgerLine | undefined {
  const r = ctx.db.get<Row>(
    `SELECT * FROM staff_ledger c WHERE c.return_id = ? AND c.kind = 'charge'
       AND NOT EXISTS (SELECT 1 FROM staff_ledger w WHERE w.kind = 'waive' AND w.return_id = c.return_id AND w.id > c.id)
     ORDER BY c.id DESC LIMIT 1`,
    [returnId],
  );
  return r ? toLine(r) : undefined;
}

/** The owner puts a return's refund on an employee's account. */
export function chargeReturn(
  ctx: Ctx,
  returnId: number,
  employee: { key: string; name: string },
  note?: string,
): number {
  allow(ctx, 'returns.charge');
  return ctx.db.transaction(() => {
    const ret = getReturn(ctx, returnId);
    if (!ret) throw new RuleError('المرتجع غير موجود');
    if (!employee.key.startsWith('emp-')) throw new RuleError('اختر الموظف');
    if (ret.refund <= 0) throw new RuleError('لا يوجد مبلغ لهذا المرتجع');
    if (returnCharge(ctx, returnId)) throw new RuleError('هذا المرتجع على حساب موظف بالفعل');
    const id = insert(ctx, {
      employee: employee.key,
      employeeName: employee.name,
      kind: 'charge',
      amount: ret.refund,
      returnId,
      note,
    });
    logAction(
      ctx,
      'ledger.charge',
      `مرتجع ${ret.name} على حساب ${employee.name}: ${formatLyd(ret.refund)}`,
      { ledgerId: id, returnId, employee: employee.key, amount: ret.refund },
    );
    return id;
  });
}

/** The owner waives a charge: a waive line of the same amount (the charge stays in the history). */
export function waiveCharge(ctx: Ctx, returnId: number, note?: string): number {
  allow(ctx, 'returns.charge');
  return ctx.db.transaction(() => {
    const charge = returnCharge(ctx, returnId);
    if (!charge) throw new RuleError('هذا المرتجع ليس على حساب أي موظف');
    const id = insert(ctx, {
      employee: charge.employee,
      employeeName: charge.employeeName,
      kind: 'waive',
      amount: charge.amount,
      returnId,
      note,
    });
    logAction(
      ctx,
      'ledger.waive',
      `إعفاء ${charge.employeeName} من ${formatLyd(charge.amount)} (مرتجع رقم ${returnId})`,
      { ledgerId: id, returnId, employee: charge.employee, amount: charge.amount },
    );
    return id;
  });
}

/** The owner records what an employee paid back. */
export function recordRepayment(
  ctx: Ctx,
  employee: { key: string; name: string },
  amount: number,
  note?: string,
): number {
  allow(ctx, 'staff.ledger');
  if (!Number.isInteger(amount) || amount <= 0)
    throw new RuleError('المبلغ يجب أن يكون أكبر من صفر');
  if (!employee.key.startsWith('emp-')) throw new RuleError('اختر الموظف');
  return ctx.db.transaction(() => {
    const id = insert(ctx, {
      employee: employee.key,
      employeeName: employee.name,
      kind: 'repay',
      amount,
      note,
    });
    logAction(ctx, 'ledger.repay', `سداد ${employee.name}: ${formatLyd(amount)}`, {
      ledgerId: id,
      employee: employee.key,
      amount,
    });
    return id;
  });
}

/** The owner records paying an employee what the shop owes them (their bonus, phase L). */
export function payEmployee(
  ctx: Ctx,
  employee: { key: string; name: string },
  amount: number,
  note?: string,
): number {
  allow(ctx, 'staff.ledger');
  if (!Number.isInteger(amount) || amount <= 0)
    throw new RuleError('المبلغ يجب أن يكون أكبر من صفر');
  if (!employee.key.startsWith('emp-')) throw new RuleError('اختر الموظف');
  return ctx.db.transaction(() => {
    const id = insert(ctx, {
      employee: employee.key,
      employeeName: employee.name,
      kind: 'payout',
      amount,
      note,
    });
    logAction(ctx, 'ledger.payout', `دُفع لـ ${employee.name}: ${formatLyd(amount)}`, {
      ledgerId: id,
      employee: employee.key,
      amount,
    });
    return id;
  });
}

/** The owner reads anyone's account; an employee reads only their own. */
function mayRead(ctx: Ctx, employee: string) {
  const actor = ctx.actor;
  if (can(actor, 'staff.ledger')) return;
  if (actor && actorKey(actor) === employee) return;
  throw new PermissionError(actor ? 'حساب الموظف: للمالك فقط.' : 'سجّل الدخول أولاً.');
}

/** An employee's statement, oldest first, with the balance after each line. */
export function employeeStatement(
  ctx: Ctx,
  employee: string,
): { lines: (LedgerLine & { balance: number })[]; balance: number } {
  mayRead(ctx, employee);
  let balance = 0;
  const lines = ctx.db
    .all<Row>('SELECT * FROM staff_ledger WHERE employee = ? ORDER BY id', [employee])
    .map((r) => {
      const l = toLine(r);
      balance += signed(l);
      return { ...l, balance };
    });
  return { lines, balance };
}

/** What each employee owes (the owner's list). */
export function ledgerBalances(ctx: Ctx): Map<string, number> {
  mayRead(ctx, '');
  const rows = ctx.db.all<{ employee: string; balance: number }>(
    `SELECT employee, sum(CASE WHEN kind IN ('charge', 'bonus_back', 'payout') THEN amount ELSE -amount END) AS balance
       FROM staff_ledger GROUP BY employee`,
  );
  return new Map(rows.map((r) => [r.employee, r.balance]));
}
