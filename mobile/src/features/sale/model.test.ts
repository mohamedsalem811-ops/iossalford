import { addSet, addToCart, type CartLine } from '@/domain/cart';
import type { Product } from '@/domain/products';

import {
  cartGroups,
  cartTotals,
  checkAddForm,
  checkoutProblem,
  DEFAULT_SALE_QUERY,
  emptyCheckoutForm,
  freeStock,
  saleItems,
  stockWarnings,
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
  lowStock: 1,
  imageFile: null,
  archived: false,
  createdAt: '2026-11-10T10:00:00',
  updatedAt: '2026-11-10T10:00:00',
  ...over,
});

const cartOf = (r: ReturnType<typeof addToCart>): CartLine[] => {
  if ('problem' in r) throw new Error(r.problem.kind);
  return r.cart;
};

describe('saleItems', () => {
  const ring = product({ id: 1, name: 'Ring', brandId: 7, brand: 'Pandora' });
  const chain = product({ id: 2, name: 'Chain', category: 'سلاسل', stock: 0 });

  it('lists jewelry pieces by name, out-of-stock ones too, with search and filters', () => {
    expect(saleItems('jewelry', [ring, chain], DEFAULT_SALE_QUERY).map((i) => i.key)).toEqual([
      '2',
      '1',
    ]);
    const q = { ...DEFAULT_SALE_QUERY, search: 'pand' };
    expect(saleItems('jewelry', [ring, chain], q).map((i) => i.key)).toEqual(['1']);
    const byBrand = { ...DEFAULT_SALE_QUERY, brand: 7 };
    expect(saleItems('jewelry', [ring, chain], byBrand)).toHaveLength(1);
    const byCategory = { ...DEFAULT_SALE_QUERY, category: 'سلاسل' };
    expect(saleItems('jewelry', [ring, chain], byCategory).map((i) => i.key)).toEqual(['2']);
  });

  it('lists scarves by design, all sizes in one tile', () => {
    const a = product({ id: 3, name: 'Silk', designId: 'd1', size: '90×90' });
    const b = product({ id: 4, name: 'Silk', designId: 'd1', size: '120×120' });
    const items = saleItems('scarves', [a, b], DEFAULT_SALE_QUERY);
    expect(items).toHaveLength(1);
    expect(items[0].kind === 'design' && items[0].design.sizes.map((s) => s.id)).toEqual([3, 4]);
  });
});

describe('cart helpers', () => {
  const ring = product({ id: 1, name: 'Ring', price: 100_000, stock: 3 });
  const chain = product({ id: 2, name: 'Chain', price: 300_000, stock: 1 });

  it('says how much stock is still free', () => {
    const cart = cartOf(addToCart([], ring, 'Ring', 2));
    expect(freeStock(3, cart, 1)).toBe(1);
    expect(freeStock(3, cart, 2)).toBe(3);
    expect(freeStock(1, cartOf(addToCart([], ring, 'Ring', 3)), 1)).toBe(0);
  });

  it('groups a set as one entry with its total, single lines on their own', () => {
    let cart = cartOf(addToCart([], ring, 'Ring', 1));
    const r = addSet(cart, {
      id: 9,
      name: 'طقم العروس',
      discount: 40_000,
      items: [
        { product: ring, name: 'Ring', quantity: 1 },
        { product: chain, name: 'Chain', quantity: 1 },
      ],
    });
    if ('problem' in r) throw new Error();
    cart = r.cart;
    const groups = cartGroups(cart);
    expect(groups.map((g) => g.kind)).toEqual(['line', 'set']);
    const set = groups[1];
    expect(set.kind === 'set' && [set.name, set.lines.length, set.total]).toEqual([
      'طقم العروس',
      2,
      360_000,
    ]);
    expect(cartTotals(cart, 7_000)).toEqual({ total: 460_000, usd: 6571, pieces: 3 });
  });

  it('warns about a line whose stock went down after it was added, or a deleted piece', () => {
    const cart = cartOf(addToCart([], ring, 'Ring', 2));
    const cart2 = cartOf(addToCart(cart, chain, 'Chain', 1));
    const now = new Map([[1, { ...ring, stock: 1 }]]);
    const w = stockWarnings(cart2, (id) => now.get(id));
    expect(w.get(1)).toBe('«Ring»: المطلوب 2 والمتوفر 1 فقط');
    expect(w.get(2)).toContain('لم تعد موجودة');
    expect(stockWarnings(cart, () => ring).size).toBe(0);
  });
});

describe('checkAddForm', () => {
  it('reads quantity and price (Arabic digits too) within the free stock', () => {
    expect(checkAddForm('2', '95.5', 3)).toEqual({ ok: true, quantity: 2, unitPrice: 95_500 });
    expect(checkAddForm('٢', '١٠٠', 2)).toEqual({ ok: true, quantity: 2, unitPrice: 100_000 });
    expect(checkAddForm('0', '100', 3)).toEqual({
      ok: false,
      message: 'الكمية يجب أن تكون 1 على الأقل',
    });
    expect(checkAddForm('4', '100', 3)).toEqual({ ok: false, message: 'المتوفر 3 فقط' });
    expect(checkAddForm('1', '100', 0)).toEqual({
      ok: false,
      message: 'لا يوجد مخزون متاح لهذه القطعة',
    });
    expect(checkAddForm('1', '', 3)).toEqual({ ok: false, message: 'اكتب سعر القطعة' });
    expect(checkAddForm('1', '0', 3)).toEqual({ ok: true, quantity: 1, unitPrice: 0 });
  });
});

describe('checkoutProblem', () => {
  const cart = cartOf(addToCart([], product({}), 'خاتم', 1));
  it('needs a cart, and a name or phone for a credit sale', () => {
    expect(checkoutProblem(emptyCheckoutForm(), [])).toBe('السلة فارغة');
    expect(checkoutProblem(emptyCheckoutForm(), cart)).toBeNull();
    const credit = { ...emptyCheckoutForm(), method: 'credit' as const };
    expect(checkoutProblem(credit, cart)).toContain('البيع الآجل');
    expect(checkoutProblem({ ...credit, phone: '0912345678' }, cart)).toBeNull();
    expect(checkoutProblem({ ...credit, name: 'سارة' }, cart)).toBeNull();
  });
});
