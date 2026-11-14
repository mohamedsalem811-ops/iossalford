import { latinDigits } from '@/lib/digits';
import type { SystemId } from '@/theme';

import {
  allow,
  clean,
  nowStamp,
  pageSql,
  RuleError,
  type Ctx,
  type Page,
  visibleTo,
} from './context';
import { getSetting, setSetting } from './settings';
import { actorKey, actorName } from '@/staff/model';
import { logAction } from './activity';

/**
 * The five receipt designs; each system offers its own. "swarovski" is SALFORD's own receipt for
 * the Swarovski pieces it sells (it does not imitate a Swarovski store receipt).
 */
export const TEMPLATES = {
  salford_dark: { system: 'jewelry', name: 'SALFORD الملكي', store: 'SALFORD Jewelry — Libya' },
  salford_light: { system: 'jewelry', name: 'SALFORD الرسمي', store: 'SALFORD Jewelry — Libya' },
  swarovski: { system: 'jewelry', name: 'SALFORD • Swarovski', store: 'SALFORD Jewelry — Libya' },
  scarves_libya: { system: 'scarves', name: 'SALFORD Libya', store: 'SALFORD Libya' },
  scarves_salford: { system: 'scarves', name: 'SALFORD Scarves', store: 'SALFORD Scarves' },
} as const;

export type TemplateId = keyof typeof TEMPLATES;

export const templatesFor = (system: SystemId) =>
  (Object.keys(TEMPLATES) as TemplateId[]).filter((t) => TEMPLATES[t].system === system);

export const DEFAULT_TEMPLATE: Record<SystemId, TemplateId> = {
  jewelry: 'salford_dark',
  scarves: 'scarves_libya',
};
export const DEFAULT_RECEIPT_CUSTOMER = 'Salford Libya';
export const RECEIPT_PREFIX: Record<SystemId, string> = { jewelry: 'GR', scarves: 'SC' };

export type ReceiptItem = {
  name: string;
  brand?: string | null;
  color?: string | null;
  code?: string | null;
  /** The piece's specs and material (feature 16), printed under it unless the receipt hides them. */
  specs?: string | null;
  quantity: number;
  price: number;
};

export type Receipt = {
  id: number;
  receiptNo: string;
  date: string; // dd/MM/yyyy
  time: string; // HH:mm
  customer: string;
  template: TemplateId;
  showPrices: boolean;
  /** The items' specs printed under them (feature 16). */
  showSpecs: boolean;
  /** Part of the sale paid with loyalty points (F3), printed as its own line. */
  pointsPaid: number;
  /** The visit reward taken off the sale (G2), printed as what the customer saved. */
  rewardOff: number;
  /** The birthday discount taken off the sale (H1), printed as the customer's gift. */
  birthdayOff: number;
  /** Printed under the total, as it was at the sale (points left, purchases to the reward). */
  footer: string | null;
  saleId: number | null;
  items: ReceiptItem[];
  total: number;
  createdAt: string;
  updatedAt: string | null;
};

const pad = (n: number, w = 2) => String(n).padStart(w, '0');

/** "09/11/2026" and "14:05", as printed on the current receipts. */
export function receiptDateTime(d: Date) {
  return {
    date: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/**
 * Next receipt number, e.g. GR-2026-0007: starts again at 0001 each January and is never reused
 * (the counter only goes up, and a number already present is skipped).
 */
export function takeReceiptNo(ctx: Ctx): string {
  const year = ctx.now().getFullYear();
  let counter =
    getSetting(ctx, 'receipt_year') === String(year)
      ? Number(getSetting(ctx, 'receipt_counter') ?? 0)
      : 0;
  let no: string;
  do {
    counter += 1;
    no = `${RECEIPT_PREFIX[ctx.system]}-${year}-${pad(counter, 4)}`;
  } while (ctx.db.get('SELECT 1 FROM receipts WHERE receipt_no = ?', [no]));
  setSetting(ctx, 'receipt_year', year);
  setSetting(ctx, 'receipt_counter', counter);
  return no;
}

function cleanItems(items: ReceiptItem[]): ReceiptItem[] {
  const kept = items.filter((i) => clean(i.name));
  for (const i of kept) {
    if (!Number.isInteger(i.quantity) || i.quantity < 1)
      throw new RuleError(`«${i.name}»: الكمية يجب أن تكون 1 على الأقل`);
    if (!Number.isInteger(i.price) || i.price < 0)
      throw new RuleError(`«${i.name}»: السعر غير صحيح`);
  }
  if (kept.length === 0) throw new RuleError('أضف قطعة واحدة على الأقل إلى الإيصال');
  return kept;
}

function writeItems(ctx: Ctx, receiptId: number, items: ReceiptItem[]) {
  ctx.db.run('DELETE FROM receipt_items WHERE receipt_id = ?', [receiptId]);
  items.forEach((i, n) =>
    ctx.db.run(
      'INSERT INTO receipt_items (receipt_id, position, name, brand, color, code, specs, quantity, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        receiptId,
        n,
        i.name.trim(),
        clean(i.brand),
        clean(i.color),
        clean(i.code),
        i.specs?.trim() || null,
        i.quantity,
        i.price,
      ],
    ),
  );
}

export type IssueInput = {
  items: ReceiptItem[];
  customer?: string;
  template?: TemplateId;
  showPrices?: boolean;
  showSpecs?: boolean;
  saleId?: number | null;
  pointsPaid?: number;
  rewardOff?: number;
  birthdayOff?: number;
  footer?: string | null;
};

/** Saves a new receipt with the next number. Used by checkout and for receipts made by hand. */
export function issueReceipt(ctx: Ctx, input: IssueInput): Receipt {
  const by = allow(ctx, 'receipts.create');
  const items = cleanItems(input.items);
  const template = input.template ?? DEFAULT_TEMPLATE[ctx.system];
  if (TEMPLATES[template]?.system !== ctx.system)
    throw new RuleError('هذا القالب غير متاح في هذا النظام');
  return ctx.db.transaction(() => {
    const { date, time } = receiptDateTime(ctx.now());
    const id = ctx.db.run(
      `INSERT INTO receipts (receipt_no, date, time, customer, template, show_prices, show_specs, sale_id, points_paid,
         reward_off, birthday_off, footer, created_at, issued_by, issued_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        takeReceiptNo(ctx),
        date,
        time,
        clean(input.customer) ?? DEFAULT_RECEIPT_CUSTOMER,
        template,
        input.showPrices ?? true,
        input.showSpecs ?? true,
        input.saleId ?? null,
        input.pointsPaid ?? 0,
        input.rewardOff ?? 0,
        input.birthdayOff ?? 0,
        input.footer?.trim() || null,
        nowStamp(ctx),
        actorKey(by),
        actorName(by),
      ],
    ).lastInsertRowId;
    writeItems(ctx, id, items);
    const r = getReceipt(ctx, id)!;
    // A sale's receipt is part of the sale's own line.
    if (!input.saleId)
      logAction(ctx, 'receipt.create', `إيصال ${r.receiptNo} لـ «${r.customer}»`, {
        receiptId: id,
      });
    return r;
  });
}

/** Edits a saved receipt (customer, items, design, prices shown or not). Its number never changes. */
export function updateReceipt(ctx: Ctx, id: number, input: Omit<IssueInput, 'saleId'>): Receipt {
  allow(ctx, 'receipts.edit');
  const items = cleanItems(input.items);
  return ctx.db.transaction(() => {
    const old = getReceipt(ctx, id);
    if (!old) throw new RuleError('الإيصال غير موجود');
    const template = input.template ?? old.template;
    if (TEMPLATES[template]?.system !== ctx.system)
      throw new RuleError('هذا القالب غير متاح في هذا النظام');
    ctx.db.run(
      'UPDATE receipts SET customer = ?, template = ?, show_prices = ?, show_specs = ?, updated_at = ? WHERE id = ?',
      [
        clean(input.customer) ?? DEFAULT_RECEIPT_CUSTOMER,
        template,
        input.showPrices ?? old.showPrices,
        input.showSpecs ?? old.showSpecs,
        nowStamp(ctx),
        id,
      ],
    );
    writeItems(ctx, id, items);
    logAction(ctx, 'receipt.edit', `تعديل الإيصال ${old.receiptNo}`, { receiptId: id });
    return getReceipt(ctx, id)!;
  });
}

type ReceiptRow = {
  id: number;
  receipt_no: string;
  date: string;
  time: string;
  customer: string;
  template: TemplateId;
  show_prices: number;
  show_specs: number;
  points_paid?: number | null;
  reward_off?: number | null;
  birthday_off?: number | null;
  footer?: string | null;
  sale_id: number | null;
  created_at: string;
  updated_at: string | null;
};

type ItemRow = {
  receipt_id: number;
  name: string;
  brand: string | null;
  color: string | null;
  code: string | null;
  specs: string | null;
  quantity: number;
  price: number;
};

/** The items of several receipts in one query (in chunks, well under SQLite's parameter limit). */
function itemsOf(ctx: Ctx, ids: number[]): Map<number, ReceiptItem[]> {
  const byReceipt = new Map<number, ReceiptItem[]>(ids.map((id) => [id, []]));
  for (let i = 0; i < ids.length; i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = ctx.db.all<ItemRow>(
      `SELECT receipt_id, name, brand, color, code, specs, quantity, price FROM receipt_items
       WHERE receipt_id IN (${chunk.map(() => '?').join(', ')}) ORDER BY receipt_id, position`,
      chunk,
    );
    for (const { receipt_id, ...item } of rows) byReceipt.get(receipt_id)?.push(item);
  }
  return byReceipt;
}

function toReceipt(r: ReceiptRow, items: ReceiptItem[]): Receipt {
  return {
    id: r.id,
    receiptNo: r.receipt_no,
    date: r.date,
    time: r.time,
    customer: r.customer,
    template: r.template,
    showPrices: r.show_prices === 1,
    showSpecs: r.show_specs !== 0,
    pointsPaid: r.points_paid ?? 0,
    rewardOff: r.reward_off ?? 0,
    birthdayOff: r.birthday_off ?? 0,
    footer: r.footer ?? null,
    saleId: r.sale_id,
    items,
    total: items.reduce((t, i) => t + i.price * i.quantity, 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const withItems = (ctx: Ctx, rows: ReceiptRow[]): Receipt[] => {
  const items = itemsOf(
    ctx,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toReceipt(r, items.get(r.id) ?? []));
};

/** Which receipts this person may see: all (the owner), or the ones they issued. */
const visible = (ctx: Ctx) => visibleTo(ctx, 'r.issued_by');

export function getReceipt(ctx: Ctx, id: number): Receipt | undefined {
  const v = visible(ctx);
  const r = ctx.db.get<ReceiptRow>(`SELECT r.* FROM receipts r WHERE r.id = ? AND ${v.sql}`, [
    id,
    ...v.params,
  ]);
  return r ? withItems(ctx, [r])[0] : undefined;
}

export function receiptForSale(ctx: Ctx, saleId: number): Receipt | undefined {
  const v = visible(ctx);
  const r = ctx.db.get<ReceiptRow>(
    `SELECT r.* FROM receipts r WHERE r.sale_id = ? AND ${v.sql} ORDER BY r.id LIMIT 1`,
    [saleId, ...v.params],
  );
  return r ? withItems(ctx, [r])[0] : undefined;
}

export type ReceiptQuery = { search?: string; month?: string; template?: TemplateId };

function receiptFilter(ctx: Ctx, q: ReceiptQuery) {
  const v = visible(ctx);
  const where: string[] = [v.sql];
  const params: string[] = [...v.params];
  const s = clean(latinDigits(q.search ?? ''));
  if (s) {
    where.push(
      `(r.receipt_no LIKE ? OR r.customer LIKE ? OR EXISTS (SELECT 1 FROM receipt_items i WHERE i.receipt_id = r.id AND (i.name LIKE ? OR i.brand LIKE ? OR i.code LIKE ?)))`,
    );
    params.push(...Array(5).fill(`%${s}%`));
  }
  if (q.month) {
    where.push('substr(r.created_at, 1, 7) = ?');
    params.push(q.month);
  }
  if (q.template) {
    where.push('r.template = ?');
    params.push(q.template);
  }
  return { where: where.length ? `WHERE ${where.join(' AND ')}` : '', params };
}

/**
 * Receipt history, newest first: search by number, customer or item name; filter by month or
 * design. Long lists ask for one page at a time; each page reads its items in one query.
 */
export function listReceipts(ctx: Ctx, q: ReceiptQuery = {}, page?: Page): Receipt[] {
  const f = receiptFilter(ctx, q);
  return withItems(
    ctx,
    ctx.db.all<ReceiptRow>(
      `SELECT r.* FROM receipts r ${f.where} ORDER BY r.id DESC${pageSql(page)}`,
      f.params,
    ),
  );
}

/** How many receipts match, without reading them. */
export function countReceipts(ctx: Ctx, q: ReceiptQuery = {}): number {
  const f = receiptFilter(ctx, q);
  return (
    ctx.db.get<{ n: number }>(`SELECT count(*) n FROM receipts r ${f.where}`, f.params)?.n ?? 0
  );
}

/** Months that have receipts, newest first ("2026-11"). */
export function receiptMonths(ctx: Ctx): string[] {
  const v = visible(ctx);
  return ctx.db
    .all<{ m: string }>(
      `SELECT DISTINCT substr(r.created_at, 1, 7) m FROM receipts r WHERE ${v.sql} ORDER BY m DESC`,
      v.params,
    )
    .map((r) => r.m);
}

/** Deletes a receipt. Its number is not given out again. */
export function deleteReceipt(ctx: Ctx, id: number) {
  allow(ctx, 'receipts.delete');
  ctx.db.transaction(() => {
    const r = getReceipt(ctx, id);
    if (!r) return;
    ctx.db.run('DELETE FROM receipts WHERE id = ?', [id]);
    logAction(ctx, 'receipt.delete', `حذف الإيصال ${r.receiptNo}`, { receiptId: id });
  });
}
