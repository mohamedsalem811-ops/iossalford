import { latinDigits } from '@/lib/digits';
import { divRound, formatDinars, formatLyd } from '@/lib/money';

import type { PaymentMethod } from './checkout';
import {
  allow,
  clean,
  nowMonth,
  nowStamp,
  pageSql,
  allowView,
  ownerSays,
  RuleError,
  visibleTo,
  type Ctx,
  type Page,
  who,
} from './context';
import { getProduct, moveStock } from './products';
import { logAction } from './activity';
import { getPolicies, type Policies } from './policies';

export type SaleLine = {
  id: number;
  saleId: number;
  productId: number;
  name: string;
  sku: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unitCost: number;
  listPrice: number;
  unitPrice: number;
  lineTotal: number;
  lineCost: number;
  setName: string | null;
  /** Pieces of this line already returned. */
  returned: number;
};

export type Sale = {
  id: number;
  createdAt: string;
  month: string;
  paymentMethod: PaymentMethod;
  customerId: number | null;
  customerName: string | null;
  note: string | null;
  rate: number;
  total: number;
  totalCost: number;
  /** Who sold it: "owner" or "emp-<id>" (sales before staff were all the owner's). */
  seller: string;
  /** A copy of their name at the time. */
  sellerName: string;
  /** Taken off the list prices (sets excluded), with its reason and the owner's approval. */
  discount: number;
  discountReason: string | null;
  approvedBy: string | null;
  lines: SaleLine[];
};

type LineRow = {
  id: number;
  sale_id: number;
  product_id: number;
  name: string;
  sku: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  quantity: number;
  unit_cost: number;
  list_price: number;
  unit_price: number;
  line_total: number;
  line_cost: number;
  set_name: string | null;
  returned: number;
};

const LINE_SELECT = `SELECT l.*, coalesce((SELECT sum(quantity) FROM returns r WHERE r.sale_line_id = l.id), 0) AS returned FROM sale_lines l`;

const toLine = (r: LineRow): SaleLine => ({
  id: r.id,
  saleId: r.sale_id,
  productId: r.product_id,
  name: r.name,
  sku: r.sku,
  brand: r.brand,
  category: r.category,
  size: r.size,
  color: r.color,
  quantity: r.quantity,
  unitCost: r.unit_cost,
  listPrice: r.list_price,
  unitPrice: r.unit_price,
  lineTotal: r.line_total,
  lineCost: r.line_cost,
  setName: r.set_name,
  returned: r.returned,
});

type SaleRow = {
  id: number;
  created_at: string;
  month: string;
  payment_method: PaymentMethod;
  customer_id: number | null;
  customer_name: string | null;
  note: string | null;
  rate: number;
  total: number;
  total_cost: number;
  seller: string | null;
  seller_name: string | null;
  discount: number;
  discount_reason: string | null;
  approved_by: string | null;
};

/** The lines of several sales in one query (in chunks, well under SQLite's parameter limit). */
function linesOf(ctx: Ctx, saleIds: number[]): Map<number, SaleLine[]> {
  const bySale = new Map<number, SaleLine[]>(saleIds.map((id) => [id, []]));
  for (let i = 0; i < saleIds.length; i += 500) {
    const ids = saleIds.slice(i, i + 500);
    const rows = ctx.db.all<LineRow>(
      `${LINE_SELECT} WHERE l.sale_id IN (${ids.map(() => '?').join(', ')}) ORDER BY l.id`,
      ids,
    );
    for (const r of rows) bySale.get(r.sale_id)?.push(toLine(r));
  }
  return bySale;
}

function toSale(r: SaleRow, lines: SaleLine[]): Sale {
  return {
    id: r.id,
    createdAt: r.created_at,
    month: r.month,
    paymentMethod: r.payment_method,
    customerId: r.customer_id,
    customerName: r.customer_name,
    note: r.note,
    rate: r.rate,
    total: r.total,
    totalCost: r.total_cost,
    seller: r.seller ?? 'owner',
    sellerName: r.seller_name ?? 'المالك',
    discount: r.discount ?? 0,
    discountReason: r.discount_reason ?? null,
    approvedBy: r.approved_by ?? null,
    lines,
  };
}

const withLines = (ctx: Ctx, rows: SaleRow[]): Sale[] => {
  const lines = linesOf(
    ctx,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toSale(r, lines.get(r.id) ?? []));
};

const visible = (ctx: Ctx) => visibleTo(ctx, 's.seller');

export function getSale(ctx: Ctx, id: number): Sale | undefined {
  const v = visible(ctx);
  const r = ctx.db.get<SaleRow>(`SELECT s.* FROM sales s WHERE s.id = ? AND ${v.sql}`, [
    id,
    ...v.params,
  ]);
  return r ? withLines(ctx, [r])[0] : undefined;
}

export function getSaleLine(ctx: Ctx, lineId: number): SaleLine | undefined {
  const r = ctx.db.get<LineRow>(`${LINE_SELECT} WHERE l.id = ?`, [lineId]);
  return r ? toLine(r) : undefined;
}

export type SaleQuery = {
  month?: string;
  /** One day, "2026-11-12". */
  day?: string;
  paymentMethod?: PaymentMethod;
  customerId?: number;
  search?: string;
};

function saleFilter(ctx: Ctx, q: SaleQuery) {
  const v = visible(ctx);
  const where: string[] = [v.sql];
  const params: (string | number)[] = [...v.params];
  if (q.month) {
    where.push('s.month = ?');
    params.push(q.month);
  }
  if (q.day) {
    where.push('substr(s.created_at, 1, 10) = ?');
    params.push(q.day);
  }
  if (q.paymentMethod) {
    where.push('s.payment_method = ?');
    params.push(q.paymentMethod);
  }
  if (q.customerId) {
    where.push('s.customer_id = ?');
    params.push(q.customerId);
  }
  const s = clean(latinDigits(q.search ?? ''));
  if (s) {
    where.push(
      '(s.customer_name LIKE ? OR EXISTS (SELECT 1 FROM sale_lines l WHERE l.sale_id = s.id AND (l.name LIKE ? OR l.sku LIKE ? OR l.brand LIKE ?)))',
    );
    params.push(...Array(4).fill(`%${s}%`));
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/**
 * Sales history, newest first: by month, payment method, customer, or search (item, code,
 * customer). Long lists ask for one page at a time; each page reads its lines in one query.
 */
export function listSales(ctx: Ctx, q: SaleQuery = {}, page?: Page): Sale[] {
  const f = saleFilter(ctx, q);
  return withLines(
    ctx,
    ctx.db.all<SaleRow>(
      `SELECT s.* FROM sales s ${f.where} ORDER BY s.id DESC${pageSql(page)}`,
      f.params,
    ),
  );
}

/** How many sales match and their total, without reading them. */
export function salesSummary(ctx: Ctx, q: SaleQuery = {}): { count: number; total: number } {
  const f = saleFilter(ctx, q);
  const r = ctx.db.get<{ n: number; t: number }>(
    `SELECT count(*) n, coalesce(sum(s.total), 0) t FROM sales s ${f.where}`,
    f.params,
  );
  return { count: r?.n ?? 0, total: r?.t ?? 0 };
}

/** Months that have sales, newest first ("2026-11"), from the month index. */
export function saleMonths(ctx: Ctx): string[] {
  const v = visible(ctx);
  return ctx.db
    .all<{ month: string }>(
      `SELECT DISTINCT month FROM sales s WHERE ${v.sql} ORDER BY month DESC`,
      v.params,
    )
    .map((r) => r.month);
}

/**
 * Deletes a sale entered by mistake. Its returns go with it, and only pieces that had not already
 * come back through a return go back into stock. Its receipt stays (unlinked) with its number.
 */
export function deleteSale(ctx: Ctx, saleId: number) {
  allow(ctx, 'sales.delete');
  ctx.db.transaction(() => {
    const sale = getSale(ctx, saleId);
    if (!sale) throw new RuleError('البيعة غير موجودة');
    for (const line of sale.lines) {
      const back = line.quantity - line.returned;
      if (back > 0 && getProduct(ctx, line.productId))
        moveStock(ctx, line.productId, back, 'sale_deleted', line.id);
    }
    ctx.db.run('DELETE FROM sales WHERE id = ?', [saleId]);
    logAction(ctx, 'sale.delete', `حذف البيعة رقم ${saleId} (${formatLyd(sale.total)})`, {
      saleId,
      total: sale.total,
      seller: sale.sellerName,
    });
  });
}

// ---------- Returns ----------

export type ReturnRecord = {
  id: number;
  saleLineId: number | null;
  productId: number;
  name: string;
  quantity: number;
  refund: number;
  cost: number;
  reason: string | null;
  createdAt: string;
  month: string;
  /** Who took it (a copy of the name). */
  byName: string;
  /** The photo of the returned piece (file name), from phase S4. */
  photo: string | null;
  /** The conditions as answered ("ملصق الضمان سليم": true). */
  conditions: Record<string, boolean> | null;
  /** Why the owner allowed it past the rules, when they did. */
  overrideReason: string | null;
  /** The sale it was exchanged for, if any. */
  exchangeSaleId: number | null;
};

type ReturnRow = {
  id: number;
  sale_line_id: number | null;
  product_id: number;
  name: string;
  quantity: number;
  refund: number;
  cost: number;
  reason: string | null;
  created_at: string;
  month: string;
  by_name: string | null;
  photo: string | null;
  conditions: string | null;
  override_reason: string | null;
  exchange_sale_id: number | null;
};

const parseAnswers = (text: string | null) => {
  try {
    return text ? (JSON.parse(text) as Record<string, boolean>) : null;
  } catch {
    return null;
  }
};

const toReturn = (r: ReturnRow): ReturnRecord => ({
  id: r.id,
  saleLineId: r.sale_line_id,
  productId: r.product_id,
  name: r.name,
  quantity: r.quantity,
  refund: r.refund,
  cost: r.cost,
  reason: r.reason,
  createdAt: r.created_at,
  month: r.month,
  byName: r.by_name ?? 'المالك',
  photo: r.photo,
  conditions: parseAnswers(r.conditions),
  overrideReason: r.override_reason,
  exchangeSaleId: r.exchange_sale_id,
});

export function getReturn(ctx: Ctx, id: number): ReturnRecord | undefined {
  const r = ctx.db.get<ReturnRow>('SELECT * FROM returns WHERE id = ?', [id]);
  return r ? toReturn(r) : undefined;
}

/** The most that can be refunded for `quantity` pieces of a line: what the customer paid for them. */
export function maxRefund(
  line: Pick<SaleLine, 'lineTotal' | 'quantity'>,
  quantity: number,
): number {
  return divRound(line.lineTotal * quantity, line.quantity);
}

/**
 * A return refused by the rules (past the window, a condition answered "no"). The owner may
 * still allow it, with a reason: signed in, or approving on the spot.
 */
export class ReturnRefused extends RuleError {
  constructor(public readonly problems: string[]) {
    super(`${problems.join('\n')}\nلا يُقبل المرتجع إلا بموافقة المالك.`);
    this.name = 'ReturnRefused';
  }
}

/** The sale of a line, for the return rules (whoever sold it). */
function saleOfLine(ctx: Ctx, saleId: number) {
  return ctx.db.get<{ created_at: string; payment_method: PaymentMethod }>(
    'SELECT created_at, payment_method FROM sales WHERE id = ?',
    [saleId],
  );
}

/** When the sale of a line was made (for the return window shown on the form). */
export function soldAtOfLine(ctx: Ctx, lineId: number): string | undefined {
  return ctx.db.get<{ created_at: string }>(
    'SELECT s.created_at FROM sales s JOIN sale_lines l ON l.sale_id = s.id WHERE l.id = ?',
    [lineId],
  )?.created_at;
}

/** Hours since a sale, from its stamp ("2026-11-09T14:05:00", local time). */
export const hoursSince = (stamp: string, now: Date) =>
  (now.getTime() - new Date(stamp).getTime()) / 3_600_000;

/**
 * What the rules say about returning from a sale made at `soldAt` (phase S4): past the window,
 * and each condition not answered "yes". Empty: the return may go ahead.
 */
export function returnProblems(
  policies: Pick<Policies, 'returnHours' | 'returnConditions'>,
  soldAt: string,
  now: Date,
  answers: Record<string, boolean> = {},
): string[] {
  const problems: string[] = [];
  if (hoursSince(soldAt, now) > policies.returnHours)
    problems.push(`مرّت أكثر من ${policies.returnHours} ساعة على البيع.`);
  for (const c of policies.returnConditions)
    if (answers[c] !== true) problems.push(`لم يتحقق الشرط: ${c}.`);
  return problems;
}

export type ReturnInput = {
  saleLineId: number;
  quantity: number;
  /** Less than what the customer paid: the owner only. */
  refund?: number;
  reason?: string;
  /** The photo of the returned piece (required). */
  photo?: string;
  /** Each return condition, answered. */
  answers?: Record<string, boolean>;
  /** Past the rules: why, and the owner's one-time approval when an employee is signed in. */
  override?: { reason: string; approval?: string };
};

/**
 * Records a return against the sale line it came from (phase S4 rules): a photo of the piece,
 * within the return window, every condition "yes". Past the rules only the owner allows it, with a
 * reason. The refund is what the customer paid; only the owner may give back less. The cost comes
 * from the sale so profit stays exact; pieces go back into stock. A return of a credit sale lowers
 * what the customer owes (see debts.ts).
 */
export function addReturn(ctx: Ctx, input: ReturnInput): number {
  const actor = allow(ctx, 'returns.create');
  return ctx.db.transaction(() => {
    const line = getSaleLine(ctx, input.saleLineId);
    const sale = line && saleOfLine(ctx, line.saleId);
    if (!line || !sale) throw new RuleError('البيعة غير موجودة');
    const returnable = line.quantity - line.returned;
    if (!Number.isInteger(input.quantity) || input.quantity < 1)
      throw new RuleError('الكمية يجب أن تكون 1 على الأقل');
    if (input.quantity > returnable) {
      throw new RuleError(
        returnable === 0
          ? 'كل قطع هذه البيعة مُرتجعة بالفعل'
          : `يمكن إرجاع ${returnable} قطعة فقط من هذه البيعة`,
      );
    }
    const max = maxRefund(line, input.quantity);
    const refund = input.refund ?? max;
    if (!Number.isInteger(refund) || refund < 0) throw new RuleError('مبلغ الاسترداد غير صحيح');
    if (refund > max)
      throw new RuleError(`لا يمكن أن يتجاوز الاسترداد ما دفعه الزبون (${formatDinars(max)} د.ل)`);
    if (refund !== max && actor.kind !== 'owner')
      throw new RuleError('المبلغ المُعاد هو ما دفعه الزبون، ولا يغيّره إلا المالك.');
    const photo = clean(input.photo);
    if (!photo) throw new RuleError('صوّر القطعة المرتجعة قبل الحفظ.');

    const policies = getPolicies(ctx);
    const problems = returnProblems(policies, sale.created_at, ctx.now(), input.answers);
    let overrideReason: string | null = null;
    let approvedBy: string | null = null;
    if (problems.length) {
      const why = clean(input.override?.reason);
      if (!why) throw new ReturnRefused(problems);
      const says = ownerSays(ctx, 'return', input.override?.approval);
      if (!says) throw new ReturnRefused(problems);
      overrideReason = why;
      approvedBy = 'owner';
    }
    const answers = Object.fromEntries(
      policies.returnConditions.map((c) => [c, input.answers?.[c] === true]),
    );
    const id = ctx.db.run(
      `INSERT INTO returns (sale_line_id, product_id, name, quantity, refund, cost, reason, created_at, month, by, by_name,
         photo, conditions, override_reason, approved_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        line.id,
        line.productId,
        line.name,
        input.quantity,
        refund,
        line.unitCost * input.quantity,
        clean(input.reason),
        nowStamp(ctx),
        nowMonth(ctx),
        ...who(ctx),
        photo,
        JSON.stringify(answers),
        overrideReason,
        approvedBy,
      ],
    ).lastInsertRowId;
    if (getProduct(ctx, line.productId))
      moveStock(ctx, line.productId, input.quantity, 'return', id);
    logAction(
      ctx,
      'return.create',
      `مرتجع ${input.quantity} × ${line.name} من البيعة رقم ${line.saleId}، استرداد ${formatLyd(refund)}${
        overrideReason ? ` (بموافقة المالك: ${overrideReason})` : ''
      }`,
      {
        returnId: id,
        saleId: line.saleId,
        quantity: input.quantity,
        refund,
        ...(overrideReason ? { override: overrideReason, problems } : {}),
      },
    );
    return id;
  });
}

/**
 * A piece sold before it was recorded in the app (no sale to link to): the owner only, with a
 * photo. The refund must be entered.
 */
export function addReturnWithoutSale(
  ctx: Ctx,
  input: { productId: number; quantity: number; refund: number; reason?: string; photo?: string },
): number {
  allow(ctx, 'returns.noSale');
  if (!Number.isInteger(input.quantity) || input.quantity < 1)
    throw new RuleError('الكمية يجب أن تكون 1 على الأقل');
  if (!Number.isInteger(input.refund) || input.refund < 0)
    throw new RuleError('مبلغ الاسترداد غير صحيح');
  const photo = clean(input.photo);
  if (!photo) throw new RuleError('صوّر القطعة المرتجعة قبل الحفظ.');
  return ctx.db.transaction(() => {
    const p = getProduct(ctx, input.productId);
    if (!p) throw new RuleError('القطعة غير موجودة في المخزون');
    const id = ctx.db.run(
      `INSERT INTO returns (sale_line_id, product_id, name, quantity, refund, cost, reason, created_at, month, by, by_name, photo)
       VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        p.id,
        p.name,
        input.quantity,
        input.refund,
        p.cost * input.quantity,
        clean(input.reason) ?? 'مرتجع بدون فاتورة',
        nowStamp(ctx),
        nowMonth(ctx),
        ...who(ctx),
        photo,
      ],
    ).lastInsertRowId;
    moveStock(ctx, p.id, input.quantity, 'return', id);
    logAction(
      ctx,
      'return.create',
      `مرتجع بدون فاتورة ${input.quantity} × ${p.name}، استرداد ${formatLyd(input.refund)}`,
      { returnId: id, quantity: input.quantity, refund: input.refund },
    );
    return id;
  });
}

export type ReturnableSale = {
  saleId: number;
  createdAt: string;
  sellerName: string;
  receiptNo: string | null;
  /** The lines with what the customer paid (never the cost). */
  lines: { id: number; name: string; quantity: number; returned: number; lineTotal: number }[];
};

/**
 * Finds a sale to take a return from by its sale number or its receipt number, whoever sold it
 * (a customer may come back to another employee). Only what a return needs, never the cost.
 */
export function findSaleForReturn(ctx: Ctx, text: string): ReturnableSale | undefined {
  allowView(ctx, 'returns.create');
  const typed = latinDigits(text).trim().toUpperCase();
  type Found = { id: number; created_at: string; seller_name: string | null };
  // "JW-2026-0012" is a receipt number; a plain number is the sale number.
  const sale = typed.includes('-')
    ? ctx.db.get<Found>(
        `SELECT s.id, s.created_at, s.seller_name FROM receipts r JOIN sales s ON s.id = r.sale_id
          WHERE upper(r.receipt_no) = ?`,
        [typed],
      )
    : /^[0-9]+$/.test(typed)
      ? ctx.db.get<Found>('SELECT id, created_at, seller_name FROM sales WHERE id = ?', [
          Number(typed),
        ])
      : undefined;
  if (!sale) return undefined;
  const receipt = ctx.db.get<{ receipt_no: string }>(
    'SELECT receipt_no FROM receipts WHERE sale_id = ? ORDER BY id LIMIT 1',
    [sale.id],
  );
  const lines = ctx.db
    .all<LineRow>(`${LINE_SELECT} WHERE l.sale_id = ? ORDER BY l.id`, [sale.id])
    .map((r) => ({
      id: r.id,
      name: r.name,
      quantity: r.quantity,
      returned: r.returned,
      lineTotal: r.line_total,
    }));
  return {
    saleId: sale.id,
    createdAt: sale.created_at,
    sellerName: sale.seller_name ?? 'المالك',
    receiptNo: receipt?.receipt_no ?? null,
    lines,
  };
}

/** Undoes a return recorded by mistake. Refused if those pieces are no longer in stock (sold again). */
export function deleteReturn(ctx: Ctx, returnId: number) {
  allow(ctx, 'returns.delete');
  ctx.db.transaction(() => {
    const r = ctx.db.get<ReturnRow>('SELECT * FROM returns WHERE id = ?', [returnId]);
    if (!r) throw new RuleError('المرتجع غير موجود');
    if (
      getProduct(ctx, r.product_id) &&
      !moveStock(ctx, r.product_id, -r.quantity, 'return_deleted', returnId)
    ) {
      throw new RuleError(
        'لا يمكن إلغاء المرتجع: القطع المرتجعة لم تعد في المخزون (ربما بيعت مرة أخرى)',
      );
    }
    ctx.db.run('DELETE FROM returns WHERE id = ?', [returnId]);
    logAction(ctx, 'return.delete', `إلغاء مرتجع ${r.quantity} × ${r.name}`, { returnId });
  });
}

export function listReturns(ctx: Ctx, month?: string, page?: Page): ReturnRecord[] {
  const rows = month
    ? ctx.db.all<ReturnRow>(
        `SELECT * FROM returns WHERE month = ? ORDER BY id DESC${pageSql(page)}`,
        [month],
      )
    : ctx.db.all<ReturnRow>(`SELECT * FROM returns ORDER BY id DESC${pageSql(page)}`);
  return rows.map(toReturn);
}

/** How many returns (in a month, or all) and the total refunded, without reading them. */
export function returnsSummary(ctx: Ctx, month?: string): { count: number; total: number } {
  const r = month
    ? ctx.db.get<{ n: number; t: number }>(
        'SELECT count(*) n, coalesce(sum(refund), 0) t FROM returns WHERE month = ?',
        [month],
      )
    : ctx.db.get<{ n: number; t: number }>(
        'SELECT count(*) n, coalesce(sum(refund), 0) t FROM returns',
      );
  return { count: r?.n ?? 0, total: r?.t ?? 0 };
}

/** Months that have returns, newest first. */
export function returnMonths(ctx: Ctx): string[] {
  return ctx.db
    .all<{ month: string }>('SELECT DISTINCT month FROM returns ORDER BY month DESC')
    .map((r) => r.month);
}
