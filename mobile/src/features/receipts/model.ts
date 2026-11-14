/** Pure rules of the receipt studio and the receipts list. */
import type { Ctx } from '@/domain/context';
import { displayName, type Product } from '@/domain/products';
import {
  DEFAULT_RECEIPT_CUSTOMER,
  DEFAULT_TEMPLATE,
  TEMPLATES,
  receiptDateTime,
  type Receipt,
  type ReceiptItem,
  type TemplateId,
} from '@/domain/receipts';
import { parseThousandths } from '@/lib/digits';
import { editableDinars } from '@/lib/money';
import type { ReceiptDoc } from '@/receipts/templates/html';
import type { SystemId } from '@/theme';

export type StudioItem = {
  key: string;
  name: string;
  brand: string;
  color: string;
  code: string;
  /** المواصفات والخامة, printed under the line (feature 16). */
  specs: string;
  quantity: number;
  /** As typed, in dinars. */
  price: string;
};

export type StudioForm = {
  template: TemplateId;
  showPrices: boolean;
  showSpecs: boolean;
  customer: string;
  items: StudioItem[];
};

let seq = 0;
const newKey = () => `i${Date.now().toString(36)}${(seq++).toString(36)}`;

export const blankItem = (): StudioItem => ({
  key: newKey(),
  name: '',
  brand: '',
  color: '',
  code: '',
  specs: '',
  quantity: 1,
  price: '',
});

export function emptyStudio(system: SystemId): StudioForm {
  return {
    template: DEFAULT_TEMPLATE[system],
    showPrices: true,
    showSpecs: true,
    customer: '',
    items: [],
  };
}

export function studioFrom(r: Receipt): StudioForm {
  return {
    template: r.template,
    showPrices: r.showPrices,
    showSpecs: r.showSpecs,
    customer: r.customer === DEFAULT_RECEIPT_CUSTOMER ? '' : r.customer,
    items: r.items.map((i) => ({
      key: newKey(),
      name: i.name,
      brand: i.brand ?? '',
      color: i.color ?? '',
      code: i.code ?? '',
      specs: i.specs ?? '',
      quantity: i.quantity,
      price: editableDinars(i.price),
    })),
  };
}

/** A piece from the stock as a receipt line (scarves show their size in the name). */
export function itemFromProduct(ctx: Pick<Ctx, 'system'>, p: Product): StudioItem {
  return {
    key: newKey(),
    name: displayName(ctx, p),
    brand: p.brand ?? '',
    color: p.color ?? '',
    code: p.sku,
    specs: p.specs ?? '',
    quantity: 1,
    price: editableDinars(p.price),
  };
}

/** Moves a line one place up (-1) or down (+1); nothing happens at either end. */
export function moveItem(items: StudioItem[], key: string, by: -1 | 1): StudioItem[] {
  const i = items.findIndex((x) => x.key === key);
  const j = i + by;
  if (i < 0 || j < 0 || j >= items.length) return items;
  const next = [...items];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

const typed = (i: StudioItem) => !!i.name.trim();

/** The lines as saved: empty lines are left out; an empty price is 0 (a gift line). */
export function studioItems(f: StudioForm): ReceiptItem[] {
  return f.items.filter(typed).map((i) => ({
    name: i.name.trim(),
    brand: i.brand.trim() || null,
    color: i.color.trim() || null,
    code: i.code.trim() || null,
    specs: i.specs.trim() || null,
    quantity: i.quantity,
    price: parseThousandths(i.price) ?? 0,
  }));
}

/** Why the receipt can't be saved yet, or null. */
export function studioProblem(f: StudioForm): string | null {
  if (!f.items.some(typed)) return 'أضف قطعة واحدة على الأقل إلى الإيصال';
  if (f.showPrices && f.items.some((i) => typed(i) && parseThousandths(i.price) === null))
    return 'اكتب سعر كل قطعة، أو اختر «هدية بدون أسعار»';
  return null;
}

/** What the preview and the PDF show for the form (a new receipt has no number yet). */
export function studioDoc(
  f: StudioForm,
  saved:
    | (Pick<Receipt, 'receiptNo' | 'date' | 'time'> & {
        pointsPaid?: number;
        rewardOff?: number;
        footer?: string | null;
      })
    | null,
  now: Date,
): ReceiptDoc {
  const when = saved ?? receiptDateTime(now);
  return {
    template: f.template,
    showPrices: f.showPrices,
    showSpecs: f.showSpecs,
    pointsPaid: saved?.pointsPaid ?? 0,
    rewardOff: saved?.rewardOff ?? 0,
    footer: saved?.footer ?? null,
    receiptNo: saved?.receiptNo ?? null,
    date: when.date,
    time: when.time,
    customer: f.customer.trim() || DEFAULT_RECEIPT_CUSTOMER,
    items: studioItems(f),
  };
}

/** The same receipt as saved, as the PDF shows it. */
export function receiptDoc(r: Receipt): ReceiptDoc {
  return {
    template: r.template,
    showPrices: r.showPrices,
    showSpecs: r.showSpecs,
    pointsPaid: r.pointsPaid,
    rewardOff: r.rewardOff,
    footer: r.footer,
    receiptNo: r.receiptNo,
    date: r.date,
    time: r.time,
    customer: r.customer,
    items: r.items,
  };
}

/** "SALFORD الملكي" */
export const templateName = (t: TemplateId) => TEMPLATES[t]?.name ?? t;

/** The line under a receipt in the history: its lines' titles. */
export function receiptSummary(r: Pick<Receipt, 'items'>): string {
  return r.items.map((i) => (i.quantity > 1 ? `${i.name} × ${i.quantity}` : i.name)).join('، ');
}
