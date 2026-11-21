/**
 * The original invoices (jewelry): the gift receipt the owner adds, prices already hidden, as a
 * photo or a PDF, linked to one or more pieces. When a customer asks for it, an employee opens it
 * with the owner's 4-digit invoice code; it is shown and printed only (no share, no save). Every
 * opening is in the activity log and raises an owner alert. The files sit in the app's private
 * folder with the photos and go into every backup.
 */
import { logAction } from './activity';
import { allow, allowView, clean, nowStamp, RuleError, type Ctx, who } from './context';

export type InvoiceKind = 'image' | 'pdf';

export type OriginalInvoice = {
  id: number;
  file: string;
  kind: InvoiceKind;
  title: string | null;
  productIds: number[];
  createdAt: string;
};

/** What anyone sees of an invoice before opening it: never its file. */
export type InvoiceListing = { id: number; kind: InvoiceKind; title: string | null };

export class InvoiceCodeNeeded extends Error {
  constructor() {
    super('فتح الفاتورة الأصلية يحتاج رمز الفواتير من المالك.');
    this.name = 'InvoiceCodeNeeded';
  }
}

const MAX_PIECES = 30;

function jewelryOnly(ctx: Ctx) {
  if (ctx.system !== 'jewelry') throw new RuleError('الفواتير الأصلية لنظام المجوهرات فقط');
}

/** A safe file name for an invoice in the photos folder (made by newInvoiceName). */
const FILE = /^invoice-[a-z0-9-]{6,64}\.(jpg|pdf)$/;

function checkProducts(ctx: Ctx, ids: number[]): number[] {
  const unique = [...new Set(ids)];
  if (!unique.length) throw new RuleError('اربط الفاتورة بقطعة واحدة على الأقل');
  if (unique.length > MAX_PIECES) throw new RuleError(`${MAX_PIECES} قطعة على الأكثر لكل فاتورة`);
  const found = ctx.db.all<{ id: number }>(
    `SELECT id FROM products WHERE id IN (${unique.map(() => '?').join(',')})`,
    unique,
  ).length;
  if (found !== unique.length) throw new RuleError('قطعة غير موجودة');
  return unique;
}

function productsOf(ctx: Ctx, id: number): number[] {
  return ctx.db
    .all<{ product_id: number }>(
      'SELECT product_id FROM original_invoice_products WHERE invoice_id = ? ORDER BY product_id',
      [id],
    )
    .map((r) => r.product_id);
}

type Row = {
  id: number;
  file: string;
  kind: InvoiceKind;
  title: string | null;
  created_at: string;
};
const toInvoice = (ctx: Ctx, r: Row): OriginalInvoice => ({
  id: r.id,
  file: r.file,
  kind: r.kind,
  title: r.title,
  productIds: productsOf(ctx, r.id),
  createdAt: r.created_at,
});

/** Every invoice, newest first (the owner's screen). */
export function listOriginalInvoices(ctx: Ctx): OriginalInvoice[] {
  allowView(ctx, 'invoices.manage');
  return ctx.db
    .all<Row>('SELECT * FROM original_invoices ORDER BY id DESC')
    .map((r) => toInvoice(ctx, r));
}

/** The invoices of a piece, without their files: a button to open each. */
export function invoicesOf(ctx: Ctx, productId: number): InvoiceListing[] {
  if (ctx.system !== 'jewelry') return [];
  return ctx.db.all<InvoiceListing>(
    `SELECT i.id, i.kind, i.title FROM original_invoices i
       JOIN original_invoice_products p ON p.invoice_id = i.id
      WHERE p.product_id = ? ORDER BY i.id DESC`,
    [productId],
  );
}

/** Adds an invoice (its file already saved in the private folder) and links its pieces. */
export function addOriginalInvoice(
  ctx: Ctx,
  input: { file: string; kind: InvoiceKind; title?: string; productIds: number[] },
): number {
  allow(ctx, 'invoices.manage');
  jewelryOnly(ctx);
  if (!FILE.test(input.file) || !input.file.endsWith(input.kind === 'pdf' ? '.pdf' : '.jpg'))
    throw new RuleError('ملف الفاتورة غير صالح');
  const title = clean(input.title);
  if (title && title.length > 80) throw new RuleError('اسم الفاتورة طويل (80 حرفاً على الأكثر)');
  const ids = checkProducts(ctx, input.productIds);
  return ctx.db.transaction(() => {
    const id = ctx.db.run(
      'INSERT INTO original_invoices (file, kind, title, created_at, by, by_name) VALUES (?, ?, ?, ?, ?, ?)',
      [input.file, input.kind, title, nowStamp(ctx), ...who(ctx)],
    ).lastInsertRowId;
    for (const p of ids)
      ctx.db.run('INSERT INTO original_invoice_products (invoice_id, product_id) VALUES (?, ?)', [
        id,
        p,
      ]);
    logAction(
      ctx,
      'invoice.add',
      `فاتورة أصلية جديدة${title ? ` «${title}»` : ''} لـ ${ids.length} قطعة`,
      { invoiceId: id, products: ids },
    );
    return id;
  });
}

/** Changes which pieces an invoice belongs to. */
export function setInvoiceProducts(ctx: Ctx, id: number, productIds: number[]) {
  allow(ctx, 'invoices.manage');
  jewelryOnly(ctx);
  const ids = checkProducts(ctx, productIds);
  ctx.db.transaction(() => {
    if (!ctx.db.get('SELECT 1 FROM original_invoices WHERE id = ?', [id]))
      throw new RuleError('الفاتورة غير موجودة');
    ctx.db.run('DELETE FROM original_invoice_products WHERE invoice_id = ?', [id]);
    for (const p of ids)
      ctx.db.run('INSERT INTO original_invoice_products (invoice_id, product_id) VALUES (?, ?)', [
        id,
        p,
      ]);
    logAction(ctx, 'invoice.link', `ربط الفاتورة الأصلية رقم ${id} بـ ${ids.length} قطعة`, {
      invoiceId: id,
      products: ids,
    });
  });
}

/** Removes an invoice; returns its file, to delete once nothing else uses it. */
export function removeOriginalInvoice(ctx: Ctx, id: number): string {
  allow(ctx, 'invoices.manage');
  return ctx.db.transaction(() => {
    const r = ctx.db.get<Row>('SELECT * FROM original_invoices WHERE id = ?', [id]);
    if (!r) throw new RuleError('الفاتورة غير موجودة');
    ctx.db.run('DELETE FROM original_invoices WHERE id = ?', [id]);
    logAction(
      ctx,
      'invoice.remove',
      `حذف الفاتورة الأصلية${r.title ? ` «${r.title}»` : ` رقم ${id}`}`,
      {
        invoiceId: id,
      },
    );
    return r.file;
  });
}

/**
 * Opens an invoice to show or print it. An employee needs the token of the owner's invoice code
 * (used once); the owner needs none. Every opening is logged (and alerts the owner).
 */
export function openOriginalInvoice(
  ctx: Ctx,
  id: number,
  input: { approval?: string; productId?: number } = {},
): { file: string; kind: InvoiceKind } {
  const actor = allow(ctx, 'invoices.open');
  jewelryOnly(ctx);
  const r = ctx.db.get<Row>('SELECT * FROM original_invoices WHERE id = ?', [id]);
  if (!r) throw new RuleError('الفاتورة غير موجودة');
  if (actor.kind !== 'owner') {
    if (!input.approval) throw new InvoiceCodeNeeded();
    if (!ctx.approvals?.take(input.approval, 'invoice')) throw new InvoiceCodeNeeded();
  }
  const piece =
    input.productId !== undefined
      ? ctx.db.get<{ name: string }>('SELECT name FROM products WHERE id = ?', [input.productId])
      : undefined;
  logAction(
    ctx,
    'invoice.open',
    `فتح الفاتورة الأصلية${r.title ? ` «${r.title}»` : ` رقم ${id}`}${piece ? ` لقطعة «${piece.name}»` : ''}`,
    { invoiceId: id, ...(input.productId !== undefined ? { productId: input.productId } : {}) },
  );
  return { file: r.file, kind: r.kind };
}

/** A new file name for an invoice: random, so it says nothing about the piece. */
export const newInvoiceName = (kind: InvoiceKind, random: string) =>
  `invoice-${random
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 32)}.${kind === 'pdf' ? 'pdf' : 'jpg'}`;
