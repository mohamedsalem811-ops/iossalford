/**
 * Repairs and services (J3, صيانة): a customer's piece taken in for work.
 *
 * The rules, as planned with the owner:
 * - a repair has the customer (name and phone), the piece (description and photos), the work
 *   (تصغير أو تكبير المقاس، لحام، تلميع، تغيير قفل، تبديل حجر، أخرى), notes, the agreed price
 *   (0: free), the date it will be ready and an optional deposit (cash, card or transfer);
 * - it goes استُلمت → في الورشة → جاهزة → سُلّمت (staff), or ملغاة (the owner: the deposit back
 *   the way she paid, or to her balance);
 * - its ticket number R-2026-0001 is printed for her; it is the record's own number, so it never
 *   repeats, even after restoring an older backup;
 * - at delivery the rest is paid any way, or put on her account (credit);
 * - the workshop's cost is the owner's, for the profit.
 *
 * Money: each payment and refund is a repair payment by its method, in the shift's drawer when in
 * cash. The income («دخل الصيانة») is the price of the repairs delivered in the period, less the
 * workshop's cost, apart from product sales; no stock moves.
 */
import { dayKey } from '@/lib/dates';
import { latinDigits } from '@/lib/digits';
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import {
  allow,
  clean,
  nowMonth,
  nowStamp,
  pageSql,
  RuleError,
  type Ctx,
  type Page,
  who,
} from './context';
import { ensureCustomer, phoneKey } from './customers';
import { getSetting, setSetting } from './settings';
import { shiftFor } from './shifts';
import { DEFAULT_TEMPLATES, fill } from './templates';

export type RepairStatus = 'received' | 'workshop' | 'ready' | 'delivered' | 'cancelled';
export type RepairWork = 'resize' | 'solder' | 'polish' | 'clasp' | 'stone' | 'other';
export type RepairPayMethod = 'cash' | 'card' | 'transfer';
/** At delivery the rest may also go on her account. */
export type RepairDeliverMethod = RepairPayMethod | 'credit';
export type RepairCancelHow = 'balance' | 'refund';

export const REPAIR_WORKS: RepairWork[] = ['resize', 'solder', 'polish', 'clasp', 'stone', 'other'];
export const WORK_LABELS: Record<RepairWork, string> = {
  resize: 'تصغير أو تكبير المقاس',
  solder: 'لحام',
  polish: 'تلميع',
  clasp: 'تغيير قفل',
  stone: 'تبديل حجر',
  other: 'أخرى',
};
export const REPAIR_STATUS_LABELS: Record<RepairStatus, string> = {
  received: 'استُلمت',
  workshop: 'في الورشة',
  ready: 'جاهزة',
  delivered: 'سُلّمت',
  cancelled: 'ملغاة',
};
/** Still in the shop: her piece and her money are held. */
export const OPEN_REPAIR_STATUSES: RepairStatus[] = ['received', 'workshop', 'ready'];
const OPEN_SQL = "('received', 'workshop', 'ready')";
export const REPAIR_PAY_METHODS: RepairPayMethod[] = ['cash', 'card', 'transfer'];
export const REPAIR_METHOD_LABELS: Record<RepairDeliverMethod, string> = {
  cash: 'كاش',
  card: 'بطاقة',
  transfer: 'تحويل',
  credit: 'آجل',
};

// ---------------------------------------------------------------- the owner's rules

export type RepairRules = {
  /** Printed on every repair ticket. */
  note: string;
  /** Ready and not collected after this many days: a reminder. */
  remindDays: number;
};

export const DEFAULT_REPAIRS: RepairRules = {
  note: 'يُرجى إحضار هذا الإيصال عند الاستلام. المحل غير مسؤول عن القطع التي لا تُستلم خلال 90 يوماً من موعد الجاهزية.',
  remindDays: 14,
};

export const REPAIRS_KEY = 'repairs';

export function getRepairRules(ctx: Ctx): RepairRules {
  const raw = getSetting(ctx, REPAIRS_KEY);
  if (!raw) return DEFAULT_REPAIRS;
  try {
    return { ...DEFAULT_REPAIRS, ...(JSON.parse(raw) as Partial<RepairRules>) };
  } catch {
    return DEFAULT_REPAIRS;
  }
}

/** The owner's repair note and reminder days; logged. */
export function setRepairRules(ctx: Ctx, changes: Partial<RepairRules>): RepairRules {
  allow(ctx, 'settings.edit');
  const next = { ...getRepairRules(ctx), ...changes };
  next.note = next.note.trim();
  if (next.note.length > 400) throw new RuleError('ملاحظة الصيانة طويلة (400 حرف على الأكثر)');
  if (!Number.isInteger(next.remindDays) || next.remindDays < 1 || next.remindDays > 365)
    throw new RuleError('أيام التذكير من 1 إلى 365');
  return ctx.db.transaction(() => {
    setSetting(ctx, REPAIRS_KEY, JSON.stringify(next));
    logAction(ctx, 'settings.repairs', 'تعديل إعدادات الصيانة', { ...next });
    return next;
  });
}

// ---------------------------------------------------------------- reading

export type Repair = {
  id: number;
  ticketNo: string;
  status: RepairStatus;
  customerId: number;
  customerName: string;
  customerPhone: string | null;
  description: string;
  work: RepairWork;
  photos: string[];
  note: string | null;
  /** The agreed price, in dirhams (0: free). */
  price: number;
  /** Paid towards it so far, less refunds (a delivery on credit counts as paid). */
  paid: number;
  /** What is left to pay at delivery. */
  remaining: number;
  /** "2026-11-20". */
  readyBy: string;
  /** The workshop's cost, typed by the owner (only the owner's screens show it). */
  cost: number | null;
  workshopAt: string | null;
  readyAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelHow: RepairCancelHow | null;
  /** On cancelling: what was refunded or moved to her balance. */
  settled: number;
  createdAt: string;
  byName: string | null;
};

type RepairRow = {
  id: number;
  ticket_no: string;
  status: RepairStatus;
  customer_id: number;
  customer_name: string;
  customer_phone: string | null;
  description: string;
  work: RepairWork;
  photos: string;
  note: string | null;
  price: number;
  paid: number;
  ready_by: string;
  cost: number | null;
  workshop_at: string | null;
  ready_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_how: RepairCancelHow | null;
  settled: number;
  created_at: string;
  by_name: string | null;
};

const PAID_SQL = `coalesce((SELECT sum(CASE p.kind WHEN 'pay' THEN p.amount ELSE -p.amount END)
                              FROM repair_payments p WHERE p.repair_id = r.id), 0)`;
const SELECT = `SELECT r.*, c.name customer_name, c.phone customer_phone, ${PAID_SQL} paid
                  FROM repairs r JOIN customers c ON c.id = r.customer_id`;

const photosOf = (json: string): string[] => {
  try {
    const list = JSON.parse(json) as unknown;
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

function toRepair(r: RepairRow): Repair {
  return {
    id: r.id,
    ticketNo: r.ticket_no,
    status: r.status,
    customerId: r.customer_id,
    customerName: r.customer_name,
    customerPhone: r.customer_phone,
    description: r.description,
    work: r.work,
    photos: photosOf(r.photos),
    note: r.note,
    price: r.price,
    paid: r.paid,
    remaining: Math.max(0, r.price - r.paid),
    readyBy: r.ready_by,
    cost: r.cost,
    workshopAt: r.workshop_at,
    readyAt: r.ready_at,
    deliveredAt: r.delivered_at,
    cancelledAt: r.cancelled_at,
    cancelHow: r.cancel_how,
    settled: r.settled,
    createdAt: r.created_at,
    byName: r.by_name,
  };
}

export function getRepair(ctx: Ctx, id: number): Repair | undefined {
  const r = ctx.db.get<RepairRow>(`${SELECT} WHERE r.id = ?`, [id]);
  return r ? toRepair(r) : undefined;
}

function requireRepair(ctx: Ctx, id: number): Repair {
  const r = getRepair(ctx, id);
  if (!r) throw new RuleError('الصيانة غير موجودة');
  return r;
}

export type RepairQuery = {
  /** 'open': still in the shop (the default); 'done': delivered or cancelled. */
  show?: 'open' | 'done' | 'all';
  status?: RepairStatus;
  customerId?: number;
  /** Her name or phone, the piece, or the ticket number. */
  search?: string;
};

function repairFilter(q: RepairQuery) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (q.status) {
    where.push('r.status = ?');
    params.push(q.status);
  } else if ((q.show ?? 'open') === 'open') where.push(`r.status IN ${OPEN_SQL}`);
  else if (q.show === 'done') where.push(`r.status NOT IN ${OPEN_SQL}`);
  if (q.customerId !== undefined) {
    where.push('r.customer_id = ?');
    params.push(q.customerId);
  }
  const text = clean(q.search && latinDigits(q.search));
  if (text) {
    const like = `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const phone = phoneKey(text);
    where.push(
      `(c.name LIKE ? ESCAPE '\\' OR r.description LIKE ? ESCAPE '\\' OR r.ticket_no LIKE ? ESCAPE '\\'${phone ? ' OR c.phone_key LIKE ?' : ''})`,
    );
    params.push(like, like, like);
    if (phone) params.push(`%${phone}%`);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/** Repairs, the soonest ready date first while open; the newest first once done. */
export function listRepairs(ctx: Ctx, q: RepairQuery = {}, page?: Page): Repair[] {
  const f = repairFilter(q);
  const order =
    (q.show ?? 'open') === 'open' && !q.status ? 'ORDER BY r.ready_by, r.id' : 'ORDER BY r.id DESC';
  return ctx.db
    .all<RepairRow>(`${SELECT} ${f.sql} ${order}${pageSql(page)}`, f.params)
    .map(toRepair);
}

export function countRepairs(ctx: Ctx, q: RepairQuery = {}): number {
  const f = repairFilter(q);
  return (
    ctx.db.get<{ n: number }>(
      `SELECT count(*) n FROM repairs r JOIN customers c ON c.id = r.customer_id ${f.sql}`,
      f.params,
    )?.n ?? 0
  );
}

export type RepairPayment = {
  id: number;
  kind: 'pay' | 'refund';
  amount: number;
  method: RepairDeliverMethod;
  createdAt: string;
  byName: string | null;
};

export function repairPayments(ctx: Ctx, repairId: number): RepairPayment[] {
  return ctx.db
    .all<{
      id: number;
      kind: 'pay' | 'refund';
      amount: number;
      method: RepairDeliverMethod;
      created_at: string;
      by_name: string | null;
    }>('SELECT * FROM repair_payments WHERE repair_id = ? ORDER BY id', [repairId])
    .map((p) => ({
      id: p.id,
      kind: p.kind,
      amount: p.amount,
      method: p.method,
      createdAt: p.created_at,
      byName: p.by_name,
    }));
}

export type RepairReminders = {
  /** Open and due today. */
  dueToday: Repair[];
  /** Not ready, and the date has passed. */
  late: Repair[];
  /** Ready and not collected after the owner's days. */
  waiting: Repair[];
};

/** What the home screen reminds about. */
export function repairReminders(ctx: Ctx): RepairReminders {
  const today = dayKey(ctx.now());
  const before = new Date(ctx.now());
  before.setDate(before.getDate() - getRepairRules(ctx).remindDays);
  const since = dayKey(before);
  const all = (where: string, params: string[]) =>
    ctx.db
      .all<RepairRow>(`${SELECT} WHERE ${where} ORDER BY r.ready_by, r.id`, params)
      .map(toRepair);
  return {
    dueToday: all("r.status IN ('received', 'workshop') AND r.ready_by = ?", [today]),
    late: all("r.status IN ('received', 'workshop') AND r.ready_by < ?", [today]),
    waiting: all("r.status = 'ready' AND substr(r.ready_at, 1, 10) <= ?", [since]),
  };
}

/** The WhatsApp «جاهزة للاستلام» message, from the owner's template. */
export const repairReadyMessage = (
  r: Pick<Repair, 'customerName' | 'description' | 'ticketNo' | 'remaining'>,
  template = DEFAULT_TEMPLATES.repairReady,
) =>
  fill(template, {
    الاسم: r.customerName,
    القطعة: r.description,
    رقم: r.ticketNo,
    الباقي: r.remaining > 0 ? `\nالباقي: ${formatLyd(r.remaining)}.` : '',
  });

// ---------------------------------------------------------------- taking a repair

/** "2026-11-20" from what was typed (Arabic digits allowed); throws when it is not a real date. */
export function parseReadyDate(text: string): string {
  const t = latinDigits(text.trim()).replace(/\//g, '-');
  const m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  const back = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
  if (!m || !back || back.getMonth() !== Number(m[2]) - 1 || back.getDate() !== Number(m[3]))
    throw new RuleError('اكتب تاريخ الجاهزية مثل 2026-12-01');
  return dayKey(back);
}

function readyDate(ctx: Ctx, text: string): string {
  const day = parseReadyDate(text);
  if (day < dayKey(ctx.now())) throw new RuleError('تاريخ الجاهزية قبل اليوم');
  return day;
}

function checkPayMethod(method: string) {
  if (!(REPAIR_PAY_METHODS as string[]).includes(method))
    throw new RuleError('اختر طريقة الدفع: كاش أو بطاقة أو تحويل');
}

export type TakeRepairInput = {
  customer: { name: string; phone: string };
  description: string;
  work: RepairWork;
  photos?: string[];
  note?: string;
  /** The agreed price in dirhams; 0 for a free repair. */
  price: number;
  /** "2026-11-20". */
  readyBy: string;
  deposit?: { amount: number; method: RepairPayMethod };
};

/** Writes a payment towards a repair (inside a checked action). */
function addPayment(
  ctx: Ctx,
  repairId: number,
  kind: 'pay' | 'refund',
  amount: number,
  method: RepairDeliverMethod,
  shiftId: number | null,
  note?: string | null,
) {
  ctx.db.run(
    `INSERT INTO repair_payments (repair_id, kind, amount, method, note, created_at, month, by, by_name, shift_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      repairId,
      kind,
      amount,
      method,
      note ?? null,
      nowStamp(ctx),
      nowMonth(ctx),
      ...who(ctx),
      shiftId,
    ],
  );
}

/** Takes a piece in for repair, with its deposit if any. Returns its ticket number. */
export function takeRepair(
  ctx: Ctx,
  input: TakeRepairInput,
): { repairId: number; ticketNo: string } {
  const actor = allow(ctx, 'repairs.take');
  const name = clean(input.customer.name);
  if (!name) throw new RuleError('اكتب اسم الزبون');
  if (!phoneKey(input.customer.phone))
    throw new RuleError('اكتب رقم هاتف الزبون: يُتصل بها عندما تجهز القطعة');
  const description = clean(input.description) ?? '';
  if (!description) throw new RuleError('اكتب وصف القطعة');
  if (description.length > 200) throw new RuleError('وصف القطعة طويل (200 حرف على الأكثر)');
  if (!REPAIR_WORKS.includes(input.work)) throw new RuleError('اختر نوع العمل');
  if (!Number.isInteger(input.price) || input.price < 0)
    throw new RuleError('اكتب السعر المتفق عليه (0 للصيانة المجانية)');
  const readyBy = readyDate(ctx, input.readyBy);
  const photos = (input.photos ?? []).filter((p) => typeof p === 'string' && p.trim());
  if (photos.length > 6) throw new RuleError('6 صور على الأكثر');
  const deposit = input.deposit && input.deposit.amount > 0 ? input.deposit : undefined;
  if (deposit) {
    if (!Number.isInteger(deposit.amount)) throw new RuleError('اكتب مبلغ العربون');
    checkPayMethod(deposit.method);
    if (deposit.amount > input.price)
      throw new RuleError(`العربون أكبر من السعر المتفق عليه (${formatLyd(input.price)})`);
  }
  return ctx.db.transaction(() => {
    const shiftId = shiftFor(ctx, actor);
    const customerId = ensureCustomer(ctx, name, input.customer.phone)!;
    const stamp = nowStamp(ctx);
    // The ticket number is the record's own number: a placeholder first, then its number.
    const id = ctx.db.run(
      `INSERT INTO repairs (ticket_no, customer_id, description, work, photos, note, price, ready_by,
         created_at, month, by, by_name, shift_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        `new-${stamp}-${Math.random()}`,
        customerId,
        description,
        input.work,
        JSON.stringify(photos),
        clean(input.note),
        input.price,
        readyBy,
        stamp,
        nowMonth(ctx),
        ...who(ctx),
        shiftId,
      ],
    ).lastInsertRowId;
    const ticketNo = `R-${ctx.now().getFullYear()}-${String(id).padStart(4, '0')}`;
    ctx.db.run('UPDATE repairs SET ticket_no = ? WHERE id = ?', [ticketNo, id]);
    if (deposit) addPayment(ctx, id, 'pay', deposit.amount, deposit.method, shiftId);
    logAction(
      ctx,
      'repair.take',
      `صيانة ${ticketNo} لـ «${name}»: «${description}» (${WORK_LABELS[input.work]}) بـ ${formatLyd(input.price)}${deposit ? `، عربون ${formatLyd(deposit.amount)} (${REPAIR_METHOD_LABELS[deposit.method]})` : ''}، جاهزة ${readyBy}`,
      {
        repairId: id,
        ticketNo,
        customerId,
        price: input.price,
        readyBy,
        ...(deposit ? { deposit: deposit.amount, method: deposit.method } : {}),
      },
    );
    return { repairId: id, ticketNo };
  });
}

// ---------------------------------------------------------------- the stages

const NEXT: Partial<Record<RepairStatus, RepairStatus[]>> = {
  received: ['workshop', 'ready'],
  workshop: ['ready'],
};

/** Moves a repair to the workshop, or marks it ready (never back). */
export function moveRepair(ctx: Ctx, repairId: number, to: 'workshop' | 'ready') {
  allow(ctx, 'repairs.deliver');
  ctx.db.transaction(() => {
    const r = requireRepair(ctx, repairId);
    if (!NEXT[r.status]?.includes(to))
      throw new RuleError(
        `لا يمكن نقل الصيانة من «${REPAIR_STATUS_LABELS[r.status]}» إلى «${REPAIR_STATUS_LABELS[to]}»`,
      );
    const stamp = nowStamp(ctx);
    ctx.db.run(
      `UPDATE repairs SET status = ?, ${to === 'workshop' ? 'workshop_at' : 'ready_at'} = ?, updated_at = ?
        WHERE id = ?`,
      [to, stamp, stamp, repairId],
    );
    logAction(
      ctx,
      to === 'workshop' ? 'repair.workshop' : 'repair.ready',
      `الصيانة ${r.ticketNo} لـ «${r.customerName}»: ${REPAIR_STATUS_LABELS[to]}`,
      { repairId, status: to },
    );
  });
}

/** A new ready date (staff may change it; never before today). */
export function setRepairDate(ctx: Ctx, repairId: number, text: string) {
  allow(ctx, 'repairs.take');
  const day = readyDate(ctx, text);
  ctx.db.transaction(() => {
    const r = requireRepair(ctx, repairId);
    if (!OPEN_REPAIR_STATUSES.includes(r.status)) throw new RuleError('الصيانة مُغلقة');
    ctx.db.run('UPDATE repairs SET ready_by = ?, updated_at = ? WHERE id = ?', [
      day,
      nowStamp(ctx),
      repairId,
    ]);
    logAction(ctx, 'repair.date', `موعد الصيانة ${r.ticketNo}: ${day} (كان ${r.readyBy})`, {
      repairId,
      readyBy: day,
      was: r.readyBy,
    });
  });
}

/** The workshop's cost (the owner's), for the profit. */
export function setRepairCost(ctx: Ctx, repairId: number, cost: number | null) {
  allow(ctx, 'repairs.cost');
  if (cost !== null && (!Number.isInteger(cost) || cost < 0))
    throw new RuleError('تكلفة الورشة غير صحيحة');
  ctx.db.transaction(() => {
    const r = requireRepair(ctx, repairId);
    if (r.status === 'cancelled') throw new RuleError('الصيانة ملغاة');
    ctx.db.run('UPDATE repairs SET cost = ?, updated_at = ? WHERE id = ?', [
      cost,
      nowStamp(ctx),
      repairId,
    ]);
    logAction(
      ctx,
      'repair.cost',
      `تكلفة ورشة الصيانة ${r.ticketNo}: ${cost === null ? '—' : formatLyd(cost)}`,
      { repairId, cost, was: r.cost },
    );
  });
}

/** She collects it: the rest paid any way, or put on her account. */
export function deliverRepair(
  ctx: Ctx,
  repairId: number,
  input: { method: RepairDeliverMethod },
): { paidNow: number } {
  const actor = allow(ctx, 'repairs.deliver');
  if (input.method !== 'credit') checkPayMethod(input.method);
  return ctx.db.transaction(() => {
    const r = requireRepair(ctx, repairId);
    if (r.status !== 'ready')
      throw new RuleError(
        r.status === 'delivered' ? 'سُلّمت هذه الصيانة من قبل' : 'تُسلّم الصيانة عندما تكون جاهزة',
      );
    const rest = r.remaining;
    if (rest > 0) addPayment(ctx, repairId, 'pay', rest, input.method, shiftFor(ctx, actor));
    const stamp = nowStamp(ctx);
    ctx.db.run(
      "UPDATE repairs SET status = 'delivered', delivered_at = ?, updated_at = ? WHERE id = ?",
      [stamp, stamp, repairId],
    );
    logAction(
      ctx,
      'repair.deliver',
      `تسليم الصيانة ${r.ticketNo} لـ «${r.customerName}»${rest > 0 ? `: الباقي ${formatLyd(rest)} (${REPAIR_METHOD_LABELS[input.method]})` : ''}`,
      { repairId, rest, method: input.method },
    );
    return { paidNow: input.method === 'credit' ? 0 : rest };
  });
}

// ---------------------------------------------------------------- cancelling

/** Cancels an open repair (the owner): the deposit back the way she paid, or to her balance. */
export function cancelRepair(
  ctx: Ctx,
  repairId: number,
  input: { how: RepairCancelHow; reason?: string },
): { settled: number } {
  const actor = allow(ctx, 'repairs.cancel');
  if (input.how !== 'refund' && input.how !== 'balance')
    throw new RuleError('اختر: إرجاع العربون أو إلى رصيدها');
  return ctx.db.transaction(() => {
    const r = requireRepair(ctx, repairId);
    if (!OPEN_REPAIR_STATUSES.includes(r.status)) throw new RuleError('الصيانة مُغلقة');
    const settled = r.paid;
    const stamp = nowStamp(ctx);
    let paymentId: number | null = null;
    if (input.how === 'refund') {
      const shiftId = shiftFor(ctx, actor);
      // Back the way she paid: each method gets back what it paid.
      for (const m of ctx.db.all<{ method: RepairPayMethod; t: number }>(
        `SELECT method, sum(CASE kind WHEN 'pay' THEN amount ELSE -amount END) t FROM repair_payments
          WHERE repair_id = ? GROUP BY method HAVING t > 0 ORDER BY method`,
        [repairId],
      ))
        addPayment(ctx, repairId, 'refund', m.t, m.method, shiftId, clean(input.reason));
    } else if (settled > 0) {
      // No money moves: the deposit stays in the shop, and the shop now owes it to her.
      paymentId = ctx.db.run(
        `INSERT INTO payments (customer_id, amount, method, note, created_at, month, by, by_name)
         VALUES (?, ?, 'repair', ?, ?, ?, ?, ?)`,
        [r.customerId, settled, `عربون الصيانة ${r.ticketNo}`, stamp, nowMonth(ctx), ...who(ctx)],
      ).lastInsertRowId;
    }
    ctx.db.run(
      `UPDATE repairs SET status = 'cancelled', cancelled_at = ?, cancel_how = ?, settled = ?, payment_id = ?,
         note = coalesce(?, note), updated_at = ? WHERE id = ?`,
      [stamp, input.how, settled, paymentId, clean(input.reason), stamp, repairId],
    );
    logAction(
      ctx,
      'repair.cancel',
      `إلغاء الصيانة ${r.ticketNo} لـ «${r.customerName}»${settled > 0 ? (input.how === 'refund' ? `: استرداد ${formatLyd(settled)}` : `: إلى رصيدها ${formatLyd(settled)}`) : ''}`,
      { repairId, how: input.how, settled },
    );
    return { settled };
  });
}

// ---------------------------------------------------------------- money in the reports

/** «دخل الصيانة» of some months: the price of the repairs delivered, and the workshop's cost. */
export function repairIncome(
  ctx: Ctx,
  months: string[],
): { count: number; income: number; cost: number } {
  const list = months.map(() => '?').join(', ') || "''";
  return (
    ctx.db.get<{ count: number; income: number; cost: number }>(
      `SELECT count(*) count, coalesce(sum(price), 0) income, coalesce(sum(cost), 0) cost
         FROM repairs WHERE status = 'delivered' AND substr(delivered_at, 1, 7) IN (${list})`,
      months,
    ) ?? { count: 0, income: 0, cost: 0 }
  );
}

/** Deposits paid on repairs still in the shop: money held for their customers. */
export function repairDepositsHeld(ctx: Ctx): { repairs: number; amount: number } {
  return (
    ctx.db.get<{ repairs: number; amount: number }>(
      `SELECT count(*) repairs, coalesce(sum(${PAID_SQL}), 0) amount FROM repairs r
        WHERE r.status IN ${OPEN_SQL}`,
    ) ?? { repairs: 0, amount: 0 }
  );
}
