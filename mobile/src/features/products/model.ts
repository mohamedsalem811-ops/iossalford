/**
 * What the products screens show, worked out from the data: brand counts for the filter bar,
 * the line under a product's name, the summary, sorting choices and the delete warning.
 */
import { isLowStock, isOutOfStock, type Product, type ProductQuery } from '@/domain/products';
import { latinDigits } from '@/lib/digits';

/** Which brands the filter bar shows: all, one brand (its id), or pieces without a brand. */
export type BrandFilter = 'all' | 'none' | number;

export type BrandCount = { id: number; name: string; count: number };

/** Brands that have pieces, A–Z, with their counts; plus the count of pieces without a brand. */
export function brandCounts(products: Product[]): {
  brands: BrandCount[];
  noBrand: number;
  total: number;
} {
  const byId = new Map<number, BrandCount>();
  let noBrand = 0;
  for (const p of products) {
    if (p.brandId === null || p.brand === null) {
      noBrand += 1;
      continue;
    }
    const entry = byId.get(p.brandId);
    if (entry) entry.count += 1;
    else byId.set(p.brandId, { id: p.brandId, name: p.brand, count: 1 });
  }
  const brands = [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }),
  );
  return { brands, noBrand, total: products.length };
}

/** A chosen brand that no longer has pieces goes back to all brands. */
export function keepBrandFilter(selected: BrandFilter, counts: ReturnType<typeof brandCounts>) {
  if (selected === 'all') return 'all';
  if (selected === 'none') return counts.noBrand > 0 ? 'none' : 'all';
  return counts.brands.some((b) => b.id === selected) ? selected : 'all';
}

/** "RNG-0001 • خواتم • ذهبي • مقاس 7" */
export function productDetails(p: Pick<Product, 'sku' | 'category' | 'color' | 'size'>): string {
  return [p.sku, p.category || null, p.color, p.size ? `مقاس ${p.size}` : null]
    .filter((part): part is string => !!part)
    .join(' • ');
}

export type StockState = 'out' | 'low' | 'ok';

export function stockState(p: Pick<Product, 'stock' | 'lowStock'>): StockState {
  if (isOutOfStock(p)) return 'out';
  return isLowStock(p) ? 'low' : 'ok';
}

/** "12 صنف • 30 قطعة في المخزن" */
export function summaryText(products: Pick<Product, 'stock'>[]): string {
  const pieces = products.reduce((sum, p) => sum + Math.max(0, p.stock), 0);
  return `${products.length} صنف • ${pieces} قطعة في المخزن`;
}

export type SortOrder = NonNullable<ProductQuery['sort']>;

export const SORTS: { value: SortOrder; label: string }[] = [
  { value: 'name', label: 'الاسم' },
  { value: 'stock_low', label: 'الأقل مخزوناً' },
  { value: 'price_high', label: 'الأعلى سعراً' },
  { value: 'price_low', label: 'الأقل سعراً' },
  { value: 'newest', label: 'الأحدث' },
];

/** Which pieces to show by stock: all, only those needing attention, low or out. */
export type StockFilter = 'all' | 'attention' | 'low' | 'out';

export const STOCK_FILTERS: { value: StockFilter; label: string }[] = [
  { value: 'all', label: 'كل المخزون' },
  { value: 'attention', label: 'المنخفض والنافد' },
  { value: 'low', label: 'المنخفض فقط' },
  { value: 'out', label: 'النافد فقط' },
];

/** Applies the stock filter (the "attention" choice combines low and out). */
export function filterStock<T extends Pick<Product, 'stock' | 'lowStock'>>(
  products: T[],
  filter: StockFilter,
): T[] {
  if (filter === 'all') return products;
  return products.filter((p) => {
    const s = stockState(p);
    return filter === 'attention' ? s !== 'ok' : s === filter;
  });
}

/** The explanation in the delete confirmation. */
export function deleteMessage(
  p: Pick<Product, 'stock'>,
  usage: { sales: number; sets: number },
): string {
  const lines = [`المخزون الحالي: ${p.stock} قطعة.`];
  if (usage.sales > 0) {
    lines.push(
      `بيعت هذه القطعة في ${usage.sales} عملية بيع، لذلك تُنقل إلى الأرشيف: تختفي من القوائم، وتبقى مبيعاتها وإيصالاتها وتقاريرها كما هي.`,
      'إذا نفدت القطعة فقط، اجعل الكمية 0 بدلاً من حذفها.',
    );
  }
  if (usage.sets > 0) lines.push(`ستُزال من ${usage.sets} طقم.`);
  return lines.join('\n');
}

export type ListQuery = {
  search: string;
  brand: BrandFilter;
  /** '' means all categories. */
  category: string;
  stock: StockFilter;
  sort: SortOrder;
};

export const DEFAULT_QUERY: ListQuery = {
  search: '',
  brand: 'all',
  category: '',
  stock: 'all',
  sort: 'name',
};

const byName = (a: Product, b: Product) =>
  a.name.localeCompare(b.name, 'ar', { sensitivity: 'base' }) || a.id - b.id;

const ORDER: Record<SortOrder, (a: Product, b: Product) => number> = {
  name: byName,
  stock_low: (a, b) => a.stock - b.stock || byName(a, b),
  price_high: (a, b) => b.price - a.price || byName(a, b),
  price_low: (a, b) => a.price - b.price || byName(a, b),
  newest: (a, b) => b.id - a.id,
};

/**
 * Search (name, code, brand or colour, in any case, Arabic digits accepted), brand, category,
 * stock filter and sort, applied to the system's products.
 */
export function applyQuery(products: Product[], q: ListQuery): Product[] {
  const search = latinDigits(q.search).trim().toLowerCase();
  const matches = products.filter((p) => {
    if (q.brand === 'none' ? p.brandId !== null : q.brand !== 'all' && p.brandId !== q.brand)
      return false;
    if (q.category && p.category !== q.category) return false;
    if (!search) return true;
    return [p.name, p.sku, p.brand, p.color].some((f) => f?.toLowerCase().includes(search));
  });
  return filterStock(matches, q.stock).sort(ORDER[q.sort]);
}
