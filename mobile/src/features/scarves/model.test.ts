import type { Product } from '@/domain/products';

import {
  applyDesignQuery,
  DEFAULT_DESIGN_QUERY,
  designFormFrom,
  designFormToInput,
  designStock,
  designSummary,
  emptyDesignForm,
  missingStandardSizes,
  priceRange,
  sizeRow,
  type DesignQuery,
} from './model';
import { groupDesigns } from '@/domain/scarves';

let nextId = 0;
const scarf = (over: Partial<Product>): Product => ({
  id: (nextId += 1),
  sku: `SCF-${String(nextId).padStart(4, '0')}`,
  name: 'وشاح',
  brandId: null,
  brand: null,
  category: 'حرير',
  designId: 'D1',
  size: '90×90',
  color: null,
  cost: 30_000,
  costUsd: null,
  costRate: null,
  price: 90_000,
  stock: 3,
  lowStock: 2,
  imageFile: null,
  archived: false,
  createdAt: '',
  updatedAt: '',
  ...over,
});

const silk = [
  scarf({
    id: 1,
    sku: 'SCF-0001',
    name: 'وشاح حرير',
    designId: 'D1',
    size: '120×120',
    price: 120_000,
    stock: 2,
  }),
  scarf({
    id: 2,
    sku: 'SCF-0002',
    name: 'وشاح حرير',
    designId: 'D1',
    size: '90×90',
    price: 90_000,
    stock: 5,
  }),
];
const wool = [
  scarf({
    id: 3,
    sku: 'SCF-0003',
    name: 'أوشحة صوف',
    designId: 'D2',
    category: 'صوف',
    brandId: 4,
    brand: 'Hermès',
    color: 'رمادي',
    size: '140×140',
    stock: 0,
  }),
];
const all = [...silk, ...wool];
const run = (q: Partial<DesignQuery>) =>
  applyDesignQuery(all, { ...DEFAULT_DESIGN_QUERY, ...q }).map((d) => d.id);

describe('design list', () => {
  it('groups by design, sorted by name', () => {
    expect(run({})).toEqual(['D2', 'D1']);
  });

  it('searches name, brand, colour and any size code', () => {
    expect(run({ search: 'حرير' })).toEqual(['D1']);
    expect(run({ search: 'hermès' })).toEqual(['D2']);
    expect(run({ search: 'scf-٠٠٠٢' })).toEqual(['D1']);
  });

  it('filters by brand, material, size and stock', () => {
    expect(run({ brand: 4 })).toEqual(['D2']);
    expect(run({ brand: 'none' })).toEqual(['D1']);
    expect(run({ category: 'صوف' })).toEqual(['D2']);
    expect(run({ size: '90×90' })).toEqual(['D1']);
    expect(run({ stock: 'out' })).toEqual(['D2']);
    expect(run({ stock: 'low' })).toEqual(['D1']);
  });

  it('describes stock, price range and the summary', () => {
    const [d1] = groupDesigns(silk);
    expect(designStock(d1)).toBe('low');
    expect(priceRange(d1)).toBe('90 – 120 د.ل');
    expect(priceRange({ minPrice: 90_000, maxPrice: 90_000 })).toBe('90 د.ل');
    expect(designSummary(groupDesigns(all))).toBe('2 تصميم • 7 قطعة');
  });
});

describe('design form', () => {
  it('offers the standard sizes not in the form yet', () => {
    expect(missingStandardSizes([])).toEqual(['90×90', '120×120', '140×140']);
    expect(missingStandardSizes([{ size: ' 120×120 ' }])).toEqual(['90×90', '140×140']);
  });

  it('fills from a design, smallest size first', () => {
    const form = designFormFrom(groupDesigns(silk)[0]);
    expect(form).toMatchObject({ name: 'وشاح حرير', category: 'حرير', brand: '' });
    expect(form.sizes.map((s) => [s.productId, s.size, s.price, s.stock])).toEqual([
      [2, '90×90', '90', '5'],
      [1, '120×120', '120', '2'],
    ]);
  });

  it('turns the form into a save, with sizes in 0-9 and empty numbers refused', () => {
    const form = {
      ...emptyDesignForm(),
      name: ' وشاح ',
      sizes: [
        { ...sizeRow('١٢٠×١٢٠'), price: '120', cost: '40', stock: '2' },
        { ...sizeRow('90×90'), price: '', cost: '0', stock: '1' },
      ],
    };
    const input = designFormToInput(form, 'D9');
    expect(input).toMatchObject({ designId: 'D9', name: 'وشاح', brand: null, category: 'حرير' });
    expect(input.sizes[0]).toMatchObject({ size: '90×90', cost: 0, stock: 1 });
    expect(input.sizes[0].price).toBeNaN();
    expect(input.sizes[1]).toEqual({
      productId: undefined,
      size: '120×120',
      cost: 40_000,
      price: 120_000,
      stock: 2,
    });
  });
});
