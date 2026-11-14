import type { Product } from '@/domain/products';

import {
  applyQuery,
  brandCounts,
  DEFAULT_QUERY,
  deleteMessage,
  filterStock,
  keepBrandFilter,
  productDetails,
  stockState,
  summaryText,
  type ListQuery,
} from './model';

const product = (over: Partial<Product>): Product => ({
  id: 1,
  sku: 'RNG-0001',
  name: 'خاتم',
  brandId: null,
  brand: null,
  category: 'خواتم',
  designId: null,
  size: null,
  color: null,
  cost: 0,
  costUsd: null,
  costRate: null,
  price: 100_000,
  stock: 3,
  lowStock: 2,
  imageFile: null,
  specs: null,
  archived: false,
  createdAt: '2026-11-10T10:00:00',
  updatedAt: '2026-11-10T10:00:00',
  ...over,
});

describe('brandCounts', () => {
  it('counts pieces per brand A–Z and pieces without a brand', () => {
    const counts = brandCounts([
      product({ id: 1, brandId: 2, brand: 'Swarovski' }),
      product({ id: 2, brandId: 1, brand: 'pandora' }),
      product({ id: 3, brandId: 2, brand: 'Swarovski' }),
      product({ id: 4 }),
    ]);
    expect(counts.brands).toEqual([
      { id: 1, name: 'pandora', count: 1 },
      { id: 2, name: 'Swarovski', count: 2 },
    ]);
    expect(counts.noBrand).toBe(1);
    expect(counts.total).toBe(4);
  });
});

describe('brand filter', () => {
  const counts = brandCounts([product({ brandId: 5, brand: 'Pandora' })]);

  it('keeps a brand that still has pieces and drops one that has none', () => {
    expect(keepBrandFilter(5, counts)).toBe(5);
    expect(keepBrandFilter(9, counts)).toBe('all');
    expect(keepBrandFilter('none', counts)).toBe('all');
    expect(keepBrandFilter('all', counts)).toBe('all');
  });
});

describe('row text', () => {
  it('joins code, category, colour and size, skipping empty parts', () => {
    expect(productDetails(product({ color: 'ذهبي', size: '7' }))).toBe(
      'RNG-0001 • خواتم • ذهبي • مقاس 7',
    );
    expect(productDetails(product({ category: '' }))).toBe('RNG-0001');
  });

  it('summarises kinds and pieces in stock', () => {
    expect(summaryText([product({ stock: 3 }), product({ stock: 0 })])).toBe(
      '2 صنف • 3 قطعة في المخزن',
    );
  });
});

describe('stock', () => {
  const out = product({ id: 1, stock: 0 });
  const low = product({ id: 2, stock: 2, lowStock: 2 });
  const ok = product({ id: 3, stock: 5 });

  it('tells out, low and fine apart', () => {
    expect([out, low, ok].map(stockState)).toEqual(['out', 'low', 'ok']);
  });

  it('filters by stock', () => {
    const all = [out, low, ok];
    expect(filterStock(all, 'all')).toEqual(all);
    expect(filterStock(all, 'attention')).toEqual([out, low]);
    expect(filterStock(all, 'low')).toEqual([low]);
    expect(filterStock(all, 'out')).toEqual([out]);
  });
});

describe('deleteMessage', () => {
  it('only mentions the stock for a piece never sold', () => {
    expect(deleteMessage({ stock: 2 }, { sales: 0, sets: 0 })).toBe('المخزون الحالي: 2 قطعة.');
  });

  it('explains archiving and sets for a sold piece', () => {
    const text = deleteMessage({ stock: 0 }, { sales: 3, sets: 1 });
    expect(text).toContain('3 عملية بيع');
    expect(text).toContain('الأرشيف');
    expect(text).toContain('1 طقم');
  });
});

describe('applyQuery', () => {
  const items = [
    product({ id: 1, name: 'خاتم ألماس', sku: 'RNG-0001', price: 500_000, stock: 0 }),
    product({
      id: 2,
      name: 'أسورة',
      sku: 'BRC-0002',
      category: 'أساور',
      brandId: 7,
      brand: 'Pandora',
      color: 'فضي',
      price: 200_000,
      stock: 5,
    }),
    product({ id: 3, name: 'بروش', sku: 'PIN-0123', category: 'دبابيس', price: 90_000, stock: 2 }),
  ];
  const run = (q: Partial<ListQuery>) =>
    applyQuery(items, { ...DEFAULT_QUERY, ...q }).map((p) => p.id);

  it('sorts by name by default', () => {
    expect(run({})).toEqual([2, 3, 1]);
  });

  it('searches name, code, brand and colour in any case, with Arabic digits', () => {
    expect(run({ search: 'ألماس' })).toEqual([1]);
    expect(run({ search: 'pin-٠١٢٣' })).toEqual([3]);
    expect(run({ search: 'PANDORA' })).toEqual([2]);
    expect(run({ search: 'فضي' })).toEqual([2]);
    expect(run({ search: '  ' })).toEqual([2, 3, 1]);
  });

  it('filters by brand, no brand, category and stock', () => {
    expect(run({ brand: 7 })).toEqual([2]);
    expect(run({ brand: 'none' })).toEqual([3, 1]);
    expect(run({ category: 'دبابيس' })).toEqual([3]);
    expect(run({ stock: 'attention' })).toEqual([3, 1]);
  });

  it('sorts by stock, price and newest', () => {
    expect(run({ sort: 'stock_low' })).toEqual([1, 3, 2]);
    expect(run({ sort: 'price_high' })).toEqual([1, 2, 3]);
    expect(run({ sort: 'price_low' })).toEqual([3, 2, 1]);
    expect(run({ sort: 'newest' })).toEqual([3, 2, 1]);
  });
});
