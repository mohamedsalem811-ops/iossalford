/**
 * @jest-environment node
 */
import { addBrand, deleteBrand, ensureBrand, listBrands, renameBrand } from './brands';
import { RuleError } from './context';
import {
  adjustStock,
  deleteProduct,
  deleteScarfDesign,
  displayName,
  generateSku,
  getProduct,
  groupDesigns,
  listProducts,
  moveStock,
  productUsage,
  restoreProduct,
  saveProduct,
  saveScarfDesign,
  sizesInUse,
  stockHistory,
  type ProductInput,
} from './products';
import { saveSet } from './sets';
import { DEFAULT_RATE, getRate, setRate } from './settings';
import { makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx('jewelry');
});
afterEach(() => ctx.close());

const ring = (over: Partial<ProductInput> = {}): ProductInput => ({
  name: 'خاتم زركون',
  category: 'خواتم',
  price: 350_000,
  cost: 200_000,
  stock: 3,
  ...over,
});

describe('settings', () => {
  it('uses 7.000 until a rate is set, and refuses zero', () => {
    expect(getRate(ctx)).toBe(DEFAULT_RATE);
    setRate(ctx, 7_125);
    expect(getRate(ctx)).toBe(7_125);
    expect(() => setRate(ctx, 0)).toThrow(RuleError);
  });
});

describe('brands', () => {
  it('matches names ignoring case and spaces', () => {
    const id = addBrand(ctx, 'Pandora');
    expect(ensureBrand(ctx, ' pandora ')).toBe(id);
    expect(ensureBrand(ctx, '')).toBeNull();
    expect(listBrands(ctx).map((b) => b.name)).toEqual(['Pandora']);
  });

  it('renames a brand everywhere, refusing a duplicate', () => {
    const p = addBrand(ctx, 'Pandora');
    addBrand(ctx, 'Swarovski');
    const id = saveProduct(ctx, ring({ brand: 'pandora' }));
    expect(() => renameBrand(ctx, p, 'SWAROVSKI')).toThrow('موجودة بالفعل');
    renameBrand(ctx, p, 'Pandora Moments');
    expect(getProduct(ctx, id)?.brand).toBe('Pandora Moments');
    renameBrand(ctx, p, 'pandora moments'); // same brand, new spelling is fine
  });

  it('deleting a brand leaves its products without a brand', () => {
    const b = addBrand(ctx, 'Tiffany');
    const id = saveProduct(ctx, ring({ brand: 'Tiffany' }));
    expect(listBrands(ctx)[0].productCount).toBe(1);
    deleteBrand(ctx, b);
    expect(getProduct(ctx, id)?.brandId).toBeNull();
  });
});

describe('products', () => {
  it('generates codes per category that never repeat', () => {
    expect(generateSku(ctx, 'خواتم')).toBe('RNG-0001');
    saveProduct(ctx, ring());
    saveProduct(ctx, ring({ sku: 'RNG-0007' }));
    expect(generateSku(ctx, 'خواتم')).toBe('RNG-0008');
    expect(generateSku(ctx, 'أساور')).toBe('BRC-0001');
    expect(generateSku(ctx, 'غير معروف')).toBe('PRD-0001');
  });

  it('uses SCF codes for scarves', () => {
    const s = makeCtx('scarves');
    expect(generateSku(s, 'حرير')).toBe('SCF-0001');
    s.close();
  });

  it('refuses a code used by another piece, in any case', () => {
    saveProduct(ctx, ring({ sku: 'RNG-0100' }));
    expect(() => saveProduct(ctx, ring({ sku: 'rng-0100' }))).toThrow('مستخدم للقطعة');
  });

  it('validates name, price and stock', () => {
    expect(() => saveProduct(ctx, ring({ name: '  ' }))).toThrow('اسم القطعة');
    expect(() => saveProduct(ctx, ring({ price: -1 }))).toThrow('سعر البيع');
    expect(() => saveProduct(ctx, ring({ stock: 1.5 }))).toThrow('الكمية');
  });

  it('converts a dollar cost at the current rate and keeps the rate', () => {
    setRate(ctx, 7_125);
    const id = saveProduct(ctx, ring({ cost: undefined, costUsd: 1_000 }));
    const p = getProduct(ctx, id)!;
    expect(p.cost).toBe(71_250);
    expect(p.costUsd).toBe(1_000);
    expect(p.costRate).toBe(7_125);
  });

  it('keeps the bought-at rate when an edit leaves the dollar cost as it was', () => {
    setRate(ctx, 7_000);
    const id = saveProduct(ctx, ring({ cost: undefined, costUsd: 1_000 }));
    setRate(ctx, 8_000);
    saveProduct(ctx, ring({ id, name: 'خاتم جديد', cost: undefined, costUsd: 1_000 }));
    expect(getProduct(ctx, id)).toMatchObject({ cost: 70_000, costUsd: 1_000, costRate: 7_000 });

    // A new dollar cost uses today's rate.
    saveProduct(ctx, ring({ id, cost: undefined, costUsd: 2_000 }));
    expect(getProduct(ctx, id)).toMatchObject({ cost: 160_000, costUsd: 2_000, costRate: 8_000 });
  });

  it('keeps an existing code when an edit leaves it empty', () => {
    const id = saveProduct(ctx, ring());
    saveProduct(ctx, ring({ id, sku: '', name: 'خاتم معدل' }));
    expect(getProduct(ctx, id)?.sku).toBe('RNG-0001');
    expect(getProduct(ctx, id)?.name).toBe('خاتم معدل');
  });

  it('records opening stock and form edits in the stock history', () => {
    const id = saveProduct(ctx, ring({ stock: 3 }));
    saveProduct(ctx, ring({ id, stock: 5 }));
    const moves = stockHistory(ctx, id);
    expect(moves.map((m) => [m.kind, m.delta])).toEqual([
      ['adjust', 2],
      ['initial', 3],
    ]);
  });

  it('adjusts stock with a reason and never below zero', () => {
    const id = saveProduct(ctx, ring({ stock: 2 }));
    adjustStock(ctx, id, 3, 'توريد جديد');
    expect(getProduct(ctx, id)?.stock).toBe(5);
    expect(() => adjustStock(ctx, id, -6, 'كسر')).toThrow('المتوفر 5 فقط');
    expect(() => adjustStock(ctx, id, -1, '')).toThrow('سبب');
    adjustStock(ctx, id, -1, 'كسر');
    expect(stockHistory(ctx, id)[0]).toMatchObject({ delta: -1, kind: 'adjust', reason: 'كسر' });
  });

  it('moveStock refuses to go below zero without changing anything', () => {
    const id = saveProduct(ctx, ring({ stock: 1 }));
    expect(moveStock(ctx, id, -2, 'sale', 1)).toBe(false);
    expect(getProduct(ctx, id)?.stock).toBe(1);
    expect(moveStock(ctx, id, -1, 'sale', 1)).toBe(true);
    expect(getProduct(ctx, id)?.stock).toBe(0);
  });

  it('deletes an unsold product and archives a sold one', () => {
    const unsold = saveProduct(ctx, ring());
    expect(deleteProduct(ctx, unsold)).toBe('deleted');
    expect(getProduct(ctx, unsold)).toBeUndefined();

    const sold = saveProduct(ctx, ring({ sku: 'RNG-0050' }));
    const saleId = ctx.db.run(
      `INSERT INTO sales (created_at, month, payment_method, rate, total, total_cost) VALUES ('2026-11-09T10:00:00', '2026-11', 'cash', 7000, 350000, 200000)`,
    ).lastInsertRowId;
    ctx.db.run(
      `INSERT INTO sale_lines (sale_id, product_id, name, sku, quantity, unit_cost, list_price, unit_price, line_total, line_cost)
       VALUES (?, ?, 'خاتم', 'RNG-0050', 1, 200000, 350000, 350000, 350000, 200000)`,
      [saleId, sold],
    );
    const other = saveProduct(ctx, ring({ sku: 'RNG-0051' }));
    saveSet(ctx, {
      name: 'طقم',
      discount: 0,
      items: [
        { productId: sold, quantity: 1 },
        { productId: other, quantity: 1 },
      ],
    });
    expect(productUsage(ctx, sold)).toEqual({ sales: 1, sets: 1 });
    expect(productUsage(ctx, unsold)).toEqual({ sales: 0, sets: 0 });
    expect(deleteProduct(ctx, sold)).toBe('archived');
    expect(listProducts(ctx).map((p) => p.id)).not.toContain(sold);
    expect(listProducts(ctx, { archived: true }).map((p) => p.id)).toEqual([sold]);
    restoreProduct(ctx, sold);
    expect(listProducts(ctx).map((p) => p.id)).toContain(sold);
  });

  it('searches, filters and sorts', () => {
    saveProduct(ctx, ring({ name: 'خاتم ذهبي', brand: 'Pandora', price: 500_000, stock: 0 }));
    saveProduct(
      ctx,
      ring({ name: 'سوار فضة', category: 'أساور', price: 200_000, stock: 1, lowStock: 2 }),
    );
    saveProduct(ctx, ring({ name: 'قلادة', category: 'قلادات', price: 800_000, stock: 9 }));
    expect(listProducts(ctx, { search: 'pandora' }).map((p) => p.name)).toEqual(['خاتم ذهبي']);
    expect(listProducts(ctx, { search: 'BRC' }).map((p) => p.name)).toEqual(['سوار فضة']);
    expect(listProducts(ctx, { stock: 'out' }).map((p) => p.name)).toEqual(['خاتم ذهبي']);
    expect(listProducts(ctx, { stock: 'low' }).map((p) => p.name)).toEqual(['سوار فضة']);
    expect(listProducts(ctx, { category: 'قلادات' })).toHaveLength(1);
    expect(listProducts(ctx, { sort: 'price_high' }).map((p) => p.price)).toEqual([
      800_000, 500_000, 200_000,
    ]);
    expect(listProducts(ctx, { brandId: null })).toHaveLength(2);
  });

  it('shows the size in scarf names only', () => {
    expect(displayName({ system: 'scarves' }, { name: 'وشاح', size: '90×90' })).toBe(
      'وشاح — 90×90',
    );
    expect(displayName({ system: 'jewelry' }, { name: 'خاتم', size: '7' })).toBe('خاتم');
  });
});

describe('scarf designs', () => {
  let s: TestCtx;
  beforeEach(() => {
    s = makeCtx('scarves');
  });
  afterEach(() => s.close());

  const design = {
    name: 'وشاح حرير',
    brand: 'Hermès',
    color: 'وردي',
    category: 'حرير',
    sizes: [
      { size: '140×140', price: 340_000, cost: 150_000, stock: 2 },
      { size: '٩٠×٩٠', price: 220_000, cost: 100_000, stock: 5 },
    ],
  };

  it('saves one product per size with shared details, sizes in 0-9, smallest first', () => {
    const id = saveScarfDesign(s, design);
    const [d] = groupDesigns(listProducts(s));
    expect(d.id).toBe(id);
    expect(d.sizes.map((p) => p.size)).toEqual(['90×90', '140×140']);
    expect(d.sizes.every((p) => p.brand === 'Hermès' && p.color === 'وردي')).toBe(true);
    expect(d.totalStock).toBe(7);
    expect([d.minPrice, d.maxPrice]).toEqual([220_000, 340_000]);
    expect(sizesInUse(s)).toEqual(['90×90', '140×140']);
  });

  it('refuses a design without sizes, duplicate sizes or missing prices', () => {
    expect(() => saveScarfDesign(s, { ...design, sizes: [] })).toThrow('مقاساً واحداً');
    expect(() =>
      saveScarfDesign(s, { ...design, sizes: [design.sizes[0], { ...design.sizes[0], price: 1 }] }),
    ).toThrow('مرة واحدة');
    expect(() =>
      saveScarfDesign(s, { ...design, sizes: [{ ...design.sizes[0], price: 0 }] }),
    ).toThrow('سعر البيع');
  });

  it('edits sizes in place and removes sizes taken off the form', () => {
    const id = saveScarfDesign(s, design);
    const [d] = groupDesigns(listProducts(s));
    const small = d.sizes[0];
    saveScarfDesign(s, {
      ...design,
      designId: id,
      name: 'وشاح حرير فاخر',
      sizes: [{ productId: small.id, size: '90×90', price: 250_000, cost: 100_000, stock: 4 }],
    });
    const [after] = groupDesigns(listProducts(s));
    expect(after.sizes).toHaveLength(1);
    expect(after.sizes[0]).toMatchObject({
      id: small.id,
      name: 'وشاح حرير فاخر',
      price: 250_000,
      stock: 4,
    });
  });

  it('deletes a whole design', () => {
    const id = saveScarfDesign(s, design);
    deleteScarfDesign(s, id);
    expect(listProducts(s)).toHaveLength(0);
  });
});
