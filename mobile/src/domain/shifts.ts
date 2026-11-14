/**
 * Shifts and the cash count (phase S5). A person opens a shift with the cash in the drawer, may
 * put cash in or take it out during it (with a reason), and closes it by counting the cash. The
 * app then says what should be there:
 *
 *   opening + cash sales + cash debt payments + cash in − cash out − cash refunds
 *
 * and the shortage or extra in that person's name. An employee sells, takes returns and debt
 * payments only inside an open shift; the owner may work without one. The count is blind: what
 * should be there is shown only after the cash is counted.
 */
import { formatLyd } from '@/lib/money';
import { actorKey, actorName, type Actor } from '@/staff/model';

import { logAction } from './activity';
import {
  allow,
  allowView,
  clean,
  nowMonth,
  nowStamp,
  pageSql,
  PermissionError,
  RuleError,
  who,
  type Ctx,
  type Page,
} from './context';
import type { PaymentMethod } from './checkout';

export type Shift = {
  id: number;
  person: string;
  personName: string;
  openedAt: string;
  openingCash: number;
  closedAt: string | null;
  countedCash: number | null;
  expectedCash: number | null;
  /** Counted − expected: negative is a shortage. Null while open. */
  difference: number | null;
  note: string | null;
  closedByName: string | null;
};

type Row = {
  id: number;
  person: string;
  person_name: string;
  opened_at: string;
  opening_cash: number;
  closed_at: string | null;
  counted_cash: number | null;
  expected_cash: number | null;
  note: string | null;
  closed_by_name: string | null;
};

const toShift = (r: Row): Shift => ({
  id: r.id,
  person: r.person,
  personName: r.person_name,
  openedAt: r.opened_at,
  openingCash: r.opening_cash,
  closedAt: r.closed_at,
  countedCash: r.counted_cash,
  expectedCash: r.expected_cash,
  difference:
    r.counted_cash !== null && r.expected_cash !== null ? r.counted_cash - r.expected_cash : null,
  note: r.note,
  closedByName: r.closed_by_name,
});

export const NO_SHIFT = 'افتح الوردية أولاً: الإدارة ← الوردية.';

export function getShift(ctx: Ctx, id: number): Shift | undefined {
  const r = ctx.db.get<Row>('SELECT * FROM shifts WHERE id = ?', [id]);
  return r ? toShift(r) : undefined;
}

/** The open shift of a person (the one signed in by default). */
export function openShiftOf(ctx: Ctx, person?: string): Shift | undefined {
  const key = person ?? (ctx.actor ? actorKey(ctx.actor) : undefined);
  if (!key) return undefined;
  const r = ctx.db.get<Row>('SELECT * FROM shifts WHERE person = ? AND closed_at IS NULL', [key]);
  return r ? toShift(r) : undefined;
}

/**
 * The shift a sale, return or payment belongs to: the person's open shift. An employee without
 * one is refused; the owner may work without a shift (null).
 */
export function shiftFor(ctx: Ctx, actor: Actor): number | null {
  const open = openShiftOf(ctx, actorKey(actor));
  if (open) return open.id;
  if (actor.kind === 'owner') return null;
  throw new RuleError(NO_SHIFT);
}

export function openShift(ctx: Ctx, openingCash: number, note?: string): number {
  const actor = allow(ctx, 'shifts.open');
  if (!Number.isInteger(openingCash) || openingCash < 0)
    throw new RuleError('اكتب النقد الموجود في الدرج (صفر أو أكثر)');
  return ctx.db.transaction(() => {
    if (openShiftOf(ctx, actorKey(actor))) throw new RuleError('لديك وردية مفتوحة بالفعل');
    const id = ctx.db.run(
      `INSERT INTO shifts (person, person_name, opened_at, opening_cash, note) VALUES (?, ?, ?, ?, ?)`,
      [actorKey(actor), actorName(actor), nowStamp(ctx), openingCash, clean(note)],
    ).lastInsertRowId;
    logAction(ctx, 'shift.open', `فتح وردية ${actorName(actor)} بنقد ${formatLyd(openingCash)}`, {
      shiftId: id,
      openingCash,
    });
    return id;
  });
}

/** Cash put into the drawer (a change top-up) or taken out (paying a supplier), with why. */
export function addCashMove(ctx: Ctx, kind: 'in' | 'out', amount: number, reason: string): number {
  const actor = allow(ctx, 'cash.move');
  if (!Number.isInteger(amount) || amount <= 0)
    throw new RuleError('المبلغ يجب أن يكون أكبر من صفر');
  const why = clean(reason);
  if (!why) throw new RuleError('اكتب سبب إدخال أو إخراج النقد');
  return ctx.db.transaction(() => {
    const shift = openShiftOf(ctx, actorKey(actor));
    if (!shift) throw new RuleError(NO_SHIFT);
    const id = ctx.db.run(
      `INSERT INTO cash_moves (shift_id, kind, amount, reason, created_at, by, by_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [shift.id, kind, amount, why, nowStamp(ctx), ...who(ctx)],
    ).lastInsertRowId;
    logAction(
      ctx,
      kind === 'in' ? 'cash.in' : 'cash.out',
      `${kind === 'in' ? 'إدخال' : 'إخراج'} نقد ${formatLyd(amount)}: ${why}`,
      { shiftId: shift.id, moveId: id, amount },
    );
    return id;
  });
}

export type CashMove = {
  id: number;
  kind: 'in' | 'out';
  amount: number;
  reason: string;
  createdAt: string;
};

export function cashMoves(ctx: Ctx, shiftId: number): CashMove[] {
  return ctx.db
    .all<{ id: number; kind: 'in' | 'out'; amount: number; reason: string; created_at: string }>(
      'SELECT * FROM cash_moves WHERE shift_id = ? ORDER BY id',
      [shiftId],
    )
    .map((m) => ({
      id: m.id,
      kind: m.kind,
      amount: m.amount,
      reason: m.reason,
      createdAt: m.created_at,
    }));
}

export type ShiftTotals = {
  /** Money taken by payment method, and the number of sales. */
  byMethod: Record<PaymentMethod, number>;
  sales: number;
  /** Returns in the shift, and the refunds given in cash (credit returns lower a debt instead). */
  returns: number;
  refunded: number;
  cashRefunds: number;
  /** Debt payments received in cash. */
  cashPayments: number;
  /** Customer credit paid back in cash (audit F-4). */
  cashPayouts: number;
  cashIn: number;
  cashOut: number;
  /** Taken off list prices, and the owner's approvals (discounts and returns past the rules). */
  discounts: number;
  approvals: number;
  /** What should be in the drawer now. */
  expected: number;
};

/** The figures of a shift (open or closed), from its records. */
export function shiftTotals(ctx: Ctx, shift: Pick<Shift, 'id' | 'openingCash'>): ShiftTotals {
  const id = shift.id;
  const byMethod: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0, credit: 0 };
  for (const r of ctx.db.all<{ m: PaymentMethod; t: number }>(
    // Money only: the part paid with loyalty points (F3) never came into the drawer.
    'SELECT payment_method m, sum(total - points_paid) t FROM sales WHERE shift_id = ? GROUP BY payment_method',
    [id],
  ))
    byMethod[r.m] = r.t;
  const sales = ctx.db.get<{ n: number; d: number; a: number }>(
    `SELECT count(*) n, coalesce(sum(discount), 0) d, count(approved_by) a FROM sales WHERE shift_id = ?`,
    [id],
  ) ?? { n: 0, d: 0, a: 0 };
  const ret = ctx.db.get<{ n: number; t: number; cash: number; a: number }>(
    `SELECT count(*) n, coalesce(sum(r.refund), 0) t,
              coalesce(sum(CASE WHEN s.payment_method = 'credit' THEN 0 ELSE r.refund END), 0) cash,
              count(r.approved_by) a
         FROM returns r LEFT JOIN sale_lines l ON l.id = r.sale_line_id LEFT JOIN sales s ON s.id = l.sale_id
        WHERE r.shift_id = ?`,
    [id],
  ) ?? { n: 0, t: 0, cash: 0, a: 0 };
  const cashPayments =
    ctx.db.get<{ t: number }>(
      "SELECT coalesce(sum(amount), 0) t FROM payments WHERE shift_id = ? AND method = 'cash'",
      [id],
    )?.t ?? 0;
  const cashPayouts =
    ctx.db.get<{ t: number }>(
      "SELECT coalesce(sum(amount), 0) t FROM payouts WHERE shift_id = ? AND method = 'cash'",
      [id],
    )?.t ?? 0;
  const moves = ctx.db.get<{ i: number; o: number }>(
    `SELECT coalesce(sum(CASE kind WHEN 'in' THEN amount END), 0) i,
              coalesce(sum(CASE kind WHEN 'out' THEN amount END), 0) o
         FROM cash_moves WHERE shift_id = ?`,
    [id],
  ) ?? { i: 0, o: 0 };
  return {
    byMethod,
    sales: sales.n,
    returns: ret.n,
    refunded: ret.t,
    cashRefunds: ret.cash,
    cashPayments,
    cashPayouts,
    cashIn: moves.i,
    cashOut: moves.o,
    discounts: sales.d,
    approvals: sales.a + ret.a,
    expected:
      shift.openingCash + byMethod.cash + cashPayments + moves.i - moves.o - ret.cash - cashPayouts,
  };
}

export const differenceText = (d: number) =>
  d === 0 ? 'مطابق' : d < 0 ? `عجز ${formatLyd(-d)}` : `زيادة ${formatLyd(d)}`;

/**
 * Closes a shift with the cash counted. A person closes their own; the owner may close anyone's
 * (an employee who left without closing). Returns what should have been there and the difference.
 */
export function closeShift(
  ctx: Ctx,
  counted: number,
  options: { shiftId?: number; note?: string } = {},
): { shiftId: number; expected: number; counted: number; difference: number } {
  const actor = allow(ctx, 'shifts.close');
  if (!Number.isInteger(counted) || counted < 0)
    throw new RuleError('اكتب النقد الذي عددته في الدرج (صفر أو أكثر)');
  return ctx.db.transaction(() => {
    const shift = options.shiftId
      ? getShift(ctx, options.shiftId)
      : openShiftOf(ctx, actorKey(actor));
    if (!shift) throw new RuleError('لا توجد وردية مفتوحة');
    if (shift.closedAt) throw new RuleError('هذه الوردية مُغلقة بالفعل');
    if (shift.person !== actorKey(actor) && actor.kind !== 'owner')
      throw new PermissionError('إغلاق وردية شخص آخر: للمالك فقط.');
    const { expected } = shiftTotals(ctx, shift);
    const difference = counted - expected;
    ctx.db.run(
      `UPDATE shifts SET closed_at = ?, counted_cash = ?, expected_cash = ?, note = coalesce(?, note),
         closed_by = ?, closed_by_name = ? WHERE id = ?`,
      [nowStamp(ctx), counted, expected, clean(options.note), ...who(ctx), shift.id],
    );
    logAction(
      ctx,
      'shift.close',
      `إغلاق وردية ${shift.personName}: المعدود ${formatLyd(counted)}، المتوقع ${formatLyd(expected)}، ${differenceText(difference)}`,
      { shiftId: shift.id, counted, expected, difference },
    );
    return { shiftId: shift.id, expected, counted, difference };
  });
}

/** The shortage charged to the employee's account, if any. */
export function shortageCharge(ctx: Ctx, shiftId: number): number | undefined {
  return ctx.db.get<{ id: number }>(
    "SELECT id FROM staff_ledger WHERE shift_id = ? AND kind = 'charge' ORDER BY id DESC LIMIT 1",
    [shiftId],
  )?.id;
}

/** The owner puts a closed shift's shortage on the employee's account. */
export function chargeShortage(ctx: Ctx, shiftId: number, note?: string): number {
  allow(ctx, 'staff.ledger');
  return ctx.db.transaction(() => {
    const shift = getShift(ctx, shiftId);
    if (!shift) throw new RuleError('الوردية غير موجودة');
    if (shift.difference === null) throw new RuleError('أغلق الوردية أولاً');
    if (shift.difference >= 0) throw new RuleError('لا يوجد عجز في هذه الوردية');
    if (!shift.person.startsWith('emp-')) throw new RuleError('الوردية ليست لموظف');
    if (shortageCharge(ctx, shiftId)) throw new RuleError('العجز على حساب الموظف بالفعل');
    const amount = -shift.difference;
    const id = ctx.db.run(
      `INSERT INTO staff_ledger (employee, employee_name, kind, amount, shift_id, note, created_at, month, by, by_name)
       VALUES (?, ?, 'charge', ?, ?, ?, ?, ?, ?, ?)`,
      [
        shift.person,
        shift.personName,
        amount,
        shiftId,
        clean(note) ?? `عجز وردية رقم ${shiftId}`,
        nowStamp(ctx),
        nowMonth(ctx),
        ...who(ctx),
      ],
    ).lastInsertRowId;
    logAction(
      ctx,
      'ledger.charge',
      `عجز وردية رقم ${shiftId} على حساب ${shift.personName}: ${formatLyd(amount)}`,
      { ledgerId: id, shiftId, employee: shift.person, amount },
    );
    return id;
  });
}

/** Every shift, newest first (the owner). */
export function listShifts(ctx: Ctx, page?: Page): Shift[] {
  allowView(ctx, 'shifts.view');
  return ctx.db.all<Row>(`SELECT * FROM shifts ORDER BY id DESC${pageSql(page)}`).map(toShift);
}

/** The shifts open at any time between `from` and `to` (times "2026-11-13"), oldest first. */
export function listShiftsOn(ctx: Ctx, from: string, to: string): Shift[] {
  allowView(ctx, 'shifts.view');
  return ctx.db
    .all<Row>(
      `SELECT * FROM shifts WHERE opened_at < ? AND (closed_at IS NULL OR closed_at >= ?)
        ORDER BY opened_at, id`,
      [to, from],
    )
    .map(toShift);
}

/** A shift for its report: the owner reads any, a person their own. */
export function shiftForReport(ctx: Ctx, id: number): Shift | undefined {
  const shift = getShift(ctx, id);
  if (!shift) return undefined;
  const actor = ctx.actor;
  if (actor && actorKey(actor) === shift.person) return shift;
  allowView(ctx, 'shifts.view');
  return shift;
}
