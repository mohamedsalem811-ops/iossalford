/**
 * The scarves products tab works by design (one design, many sizes): filters, summary, the
 * design form and its size rows.
 */
import { CATEGORIES, isLowStock, STANDARD_SCARF_SIZES, type Product } from '@/domain/products';
import {
  groupDesigns,
  sizeSortKey,
  type ScarfDesign,
  type ScarfDesignInput,
} from '@/domain/scarves';
import type { BrandFilter, SortOrder, StockFilter } from '@/features/products/model';
import { latinDigits, parseInteger, parseThousandths } from '@/lib/digits';
import { editableDinars, formatDinars } from '@/lib/money';

export type DesignQuery = {
  search: string;
  brand: BrandFilter;
  category: string;
  /** '' means all sizes. */
  size: string;
  stock: StockFilter;
  sort: SortOrder;
};

export const DEFAULT_DESIGN_QUERY: DesignQuery = {
  search: '',
  brand: 'all',
  category: '',
  size: '',
  stock: 'all',
  sort: 'name',
};

/** Out: nothing left in any size. Low: some size is low or out while others remain. */
export function designStock(d: ScarfDesign): 'out' | 'low' | 'ok' {
  if (d.totalStock <= 0) return 'out';
  return d.sizes.some((s) => s.stock <= 0 || isLowStock(s)) ? 'low' : 'ok';
}

const byName = (a: ScarfDesign, b: ScarfDesign) =>
  a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }) || a.id.localeCompare(b.id);
const newest = (d: ScarfDesign) => Math.max(...d.sizes.map((s) => s.id));

const ORDER: Record<SortOrder, (a: ScarfDesign, b: ScarfDesign) => number> = {
  name: byName,
  stock_low: (a, b) => a.totalStock - b.totalStock || byName(a, b),
  price_high: (a, b) => b.maxPrice - a.maxPrice || byName(a, b),
  price_low: (a, b) => a.minPrice - b.minPrice || byName(a, b),
  newest: (a, b) => newest(b) - newest(a),
};

/** The system's designs after search (name, brand, colour or any size's code), filters and sort. */
export function applyDesignQuery(products: Product[], q: DesignQuery): ScarfDesign[] {
  const search = latinDigits(q.search).trim().toLowerCase();
  return groupDesigns(products)
    .filter((d) => {
      const first = d.sizes[0];
      if (
        q.brand === 'none' ? first.brandId !== null : q.brand !== 'all' && first.brandId !== q.brand
      )
        return false;
      if (q.category && first.category !== q.category) return false;
      if (q.size && !d.sizes.some((s) => s.size === q.size)) return false;
      if (q.stock !== 'all') {
        const state = designStock(d);
        if (q.stock === 'attention' ? state === 'ok' : state !== q.stock) return false;
      }
      if (!search) return true;
      return [first.name, first.brand, first.color, ...d.sizes.map((s) => s.sku)].some((f) =>
        f?.toLowerCase().includes(search),
      );
    })
    .sort(ORDER[q.sort]);
}

/** "3 تصميم • 18 قطعة" */
export function designSummary(designs: ScarfDesign[]): string {
  const pieces = designs.reduce((sum, d) => sum + Math.max(0, d.totalStock), 0);
  return `${designs.length} تصميم • ${pieces} قطعة`;
}

/** "120 د.ل" or "90 – 180 د.ل" */
export function priceRange(d: Pick<ScarfDesign, 'minPrice' | 'maxPrice'>): string {
  return d.minPrice === d.maxPrice
    ? `${formatDinars(d.minPrice)} د.ل`
    : `${formatDinars(d.minPrice)} – ${formatDinars(d.maxPrice)} د.ل`;
}

/** "حرير • أزرق" */
export function designDetails(d: ScarfDesign): string {
  const first = d.sizes[0];
  return [first.category || null, first.color].filter(Boolean).join(' • ');
}

export function deleteDesignMessage(d: ScarfDesign): string {
  return `سيُحذف التصميم بكل مقاساته (${d.sizes.length}) ومخزونها (${d.totalStock} قطعة). المقاسات التي بيعت من قبل تُنقل إلى الأرشيف، وتبقى مبيعاتها وإيصالاتها كما هي.`;
}

// ---------- The design form ----------

export type SizeRow = {
  /** Stable key while editing. */
  key: string;
  productId?: number;
  size: string;
  cost: string;
  price: string;
  stock: string;
};

export type DesignForm = {
  name: string;
  brand: string;
  category: string;
  color: string;
  imageFile: string | null;
  sizes: SizeRow[];
};

let nextKey = 0;
const key = () => `row-${(nextKey += 1)}`;

export function sizeRow(size = ''): SizeRow {
  return { key: key(), size, cost: '', price: '', stock: '1' };
}

export function emptyDesignForm(): DesignForm {
  return {
    name: '',
    brand: '',
    category: CATEGORIES.scarves[0],
    color: '',
    imageFile: null,
    sizes: [],
  };
}

export function designFormFrom(d: ScarfDesign): DesignForm {
  const first = d.sizes[0];
  return {
    name: first.name,
    brand: first.brand ?? '',
    category: first.category,
    color: first.color ?? '',
    imageFile: d.sizes.find((s) => s.imageFile)?.imageFile ?? null,
    sizes: d.sizes.map((s) => ({
      key: key(),
      productId: s.id,
      size: s.size ?? '',
      cost: editableDinars(s.cost),
      price: editableDinars(s.price),
      stock: String(s.stock),
    })),
  };
}

/** The standard sizes not in the form yet, for the quick-add buttons. */
export function missingStandardSizes(rows: Pick<SizeRow, 'size'>[]): string[] {
  const present = new Set(rows.map((r) => latinDigits(r.size.trim())));
  return STANDARD_SCARF_SIZES.filter((s) => !present.has(s));
}

/**
 * The save input. Empty or mistyped numbers become NaN, so the business rules refuse them with
 * a message naming the size ("أدخل سعر البيع للمقاس 90×90").
 */
export function designFormToInput(f: DesignForm, designId?: string): ScarfDesignInput {
  const num = (n: number | null) => (n === null ? Number.NaN : n);
  return {
    designId,
    name: f.name.trim(),
    brand: f.brand.trim() || null,
    color: f.color.trim() || null,
    category: f.category,
    imageFile: f.imageFile,
    sizes: [...f.sizes]
      .sort((a, b) => sizeSortKey(a.size) - sizeSortKey(b.size))
      .map((r) => ({
        productId: r.productId,
        size: latinDigits(r.size.trim()),
        cost: num(parseThousandths(r.cost)),
        price: num(parseThousandths(r.price)),
        stock: num(parseInteger(r.stock)),
      })),
  };
}
