/**
 * @jest-environment node
 */
import {
  addSet,
  addToCart,
  cartProblems,
  cartTotal,
  removeLine,
  setQuantity,
  setUnitPrice,
  type CartLine,
} from './cart';
import { checkout, CheckoutError } from './checkout';
import { RuleError } from './context';
import {
  customerSuggestions,
  ensureCustomer,
  getCustomer,
  listCustomers,
  phoneKey,
  saveCustomer,
} from './customers';
import { adjustStock, getProduct, saveProduct, stockHistory, type Product } from './products';
import {
  getReceipt,
  issueReceipt,
  listReceipts,
  receiptForSale,
  takeReceiptNo,
  updateReceipt,
} from './receipts';
import { availableSets, deleteSet, getSet, saveSet, setForCart, setPrice } from './sets';
import { setRate } from './settings';
import { makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx('jewelry');
});
afterEach(() => ctx.close());

function product(name: string, price: number, stock: number, cost = 100_000): Product {
  const id = saveProduct(ctx, { name, category: 'خواتم', price, cost, stock, brand: 'Pandora' });
  return getProduct(ctx, id)!;
}

function ok(r: ReturnType<typeof addToCart>): CartLine[] {
  if ('problem' in r) throw new Error(JSON.stringify(r.problem));
  return r.cart;
}

describe('customers', () => {
  it('recognises the same phone written different ways', () => {
    expect(phoneKey('0912345678')).toBe('912345678');
    expect(phoneKey('+218 91 234 5678')).toBe('912345678');
    expect(phoneKey('00218912345678')).toBe('912345678');
    expect(phoneKey('٠٩١٢٣٤٥٦٧٨')).toBe('912345678');
    expect(phoneKey('123')).toBeNull();
  });

  it('refuses a phone that belongs to another customer', () => {
    saveCustomer(ctx, { name: 'سارة', phone: '0912345678' });
    expect(() => saveCustomer(ctx, { name: 'منى', phone: '+218912345678' })).toThrow(
      'مسجل مسبقاً للزبون «سارة»',
    );
    expect(() => saveCustomer(ctx, { name: ' ' })).toThrow('اسم الزبون');
  });

  it('matches a sale to a customer by phone first, then by a non-conflicting name', () => {
    const sara = saveCustomer(ctx, { name: 'سارة', phone: '0912345678' });
    expect(ensureCustomer(ctx, 'اسم آخر', '00218912345678')).toBe(sara);
    // Same name but a different phone is a different person.
    const other = ensureCustomer(ctx, 'سارة', '0921111111');
    expect(other).not.toBe(sara);
    // Same name without a phone joins the latest compatible customer, filling in the area.
    const noPhone = saveCustomer(ctx, { name: 'هدى' });
    expect(ensureCustomer(ctx, '  هدى ', undefined, 'طرابلس')).toBe(noPhone);
    expect(getCustomer(ctx, noPhone)?.area).toBe('طرابلس');
    expect(ensureCustomer(ctx, '', '')).toBeNull();
  });

  it('suggests customers while typing and searches the list', () => {
    saveCustomer(ctx, { name: 'سارة أحمد', phone: '0912345678' });
    saveCustomer(ctx, { name: 'منى', phone: '0920000000', area: 'بنغازي' });
    expect(customerSuggestions(ctx, 'سار').map((c) => c.name)).toEqual(['سارة أحمد']);
    expect(customerSuggestions(ctx, '٢٣٤').map((c) => c.name)).toEqual(['سارة أحمد']);
    expect(customerSuggestions(ctx, 'س')).toEqual([]);
    expect(listCustomers(ctx, 'بنغازي').map((c) => c.name)).toEqual(['منى']);
  });
});

describe('cart', () => {
  it('checks stock across the whole cart and merges the same piece at the same price', () => {
    const ring = product('خاتم', 350_000, 3);
    let cart = ok(addToCart([], ring, 'خاتم', 2));
    cart = ok(addToCart(cart, ring, 'خاتم', 1));
    expect(cart).toHaveLength(1);
    expect(cart[0].quantity).toBe(3);
    expect(addToCart(cart, ring, 'خاتم', 1)).toEqual({
      problem: { kind: 'stock', name: 'خاتم', requested: 4, available: 3 },
    });
    // A different price is its own line.
    const r = addToCart(ok(addToCart([], ring, 'خاتم', 1)), ring, 'خاتم', 1, 300_000);
    expect(ok(r)).toHaveLength(2);
  });

  it('refuses zero quantities and edits quantity and price', () => {
    const ring = product('خاتم', 350_000, 5);
    expect(addToCart([], ring, 'خاتم', 0)).toEqual({ problem: { kind: 'quantity', name: 'خاتم' } });
    let cart = ok(addToCart([], ring, 'خاتم', 1));
    const key = cart[0].key;
    cart = ok(setQuantity(cart, key, 4, ring.stock));
    expect(setQuantity(cart, key, 6, ring.stock)).toMatchObject({
      problem: { kind: 'stock', requested: 6 },
    });
    cart = setUnitPrice(cart, key, 300_000);
    expect(cartTotal(cart)).toBe(1_200_000);
  });

  it('adds a set with the discount split exactly over its pieces', () => {
    const a = product('قلادة', 600_000, 2);
    const b = product('حلق', 300_000, 2);
    const c = product('سوار', 100_000, 2);
    const setId = saveSet(ctx, {
      name: 'طقم العروس',
      discount: 100_001,
      items: [
        { productId: a.id, quantity: 1 },
        { productId: b.id, quantity: 1 },
        { productId: c.id, quantity: 1 },
      ],
    });
    const set = getSet(ctx, setId)!;
    expect(setPrice(ctx, set)).toBe(899_999);
    const cart = ok(addSet([], setForCart(ctx, set)));
    expect(cart).toHaveLength(3);
    expect(cartTotal(cart)).toBe(899_999); // never loses a dirham
    expect(new Set(cart.map((l) => l.bundleGroup)).size).toBe(1);
    // Bundle lines can't change price or quantity; removing one removes the whole set.
    expect(setUnitPrice(cart, cart[0].key, 1)).toEqual(cart);
    expect(removeLine(cart, cart[1].key)).toEqual([]);
    expect(availableSets(ctx, set, cart)).toBe(1);
  });

  it('refuses a set discount that is not below the pieces total', () => {
    const a = product('قلادة', 600_000, 2);
    expect(() =>
      saveSet(ctx, { name: 'طقم', discount: 600_000, items: [{ productId: a.id, quantity: 1 }] }),
    ).toThrow('أقل من مجموع');
    expect(() => saveSet(ctx, { name: 'طقم', discount: 0, items: [] })).toThrow('قطعة واحدة');
    const id = saveSet(ctx, {
      name: 'طقم',
      discount: 0,
      items: [{ productId: a.id, quantity: 1 }],
    });
    deleteSet(ctx, id);
    expect(getSet(ctx, id)).toBeUndefined();
  });

  it('re-checks the cart against current stock', () => {
    const ring = product('خاتم', 350_000, 2);
    const cart = ok(addToCart([], ring, 'خاتم', 2));
    adjustStock(ctx, ring.id, -1, 'كسر');
    expect(cartProblems(cart, (id) => getProduct(ctx, id))).toEqual([
      { kind: 'stock', name: 'خاتم', requested: 2, available: 1 },
    ]);
    expect(cartProblems([], () => undefined)).toEqual([{ kind: 'empty' }]);
  });
});

describe('receipt numbers', () => {
  it('count up within a year and restart every January, never reused', () => {
    expect(takeReceiptNo(ctx)).toBe('GR-2026-0001');
    expect(takeReceiptNo(ctx)).toBe('GR-2026-0002');
    ctx.setNow(new Date(2027, 0, 1, 9, 0));
    expect(takeReceiptNo(ctx)).toBe('GR-2027-0001');
  });

  it('skip a number that is already taken', () => {
    issueReceipt(ctx, { items: [{ name: 'هدية', quantity: 1, price: 0 }] });
    ctx.db.run(`UPDATE settings SET value = '0' WHERE key = 'receipt_counter'`);
    expect(takeReceiptNo(ctx)).toBe('GR-2026-0002');
  });

  it('use SC for scarves', () => {
    const s = makeCtx('scarves');
    expect(takeReceiptNo(s)).toBe('SC-2026-0001');
    s.close();
  });
});

describe('receipts', () => {
  it('issues, edits (keeping the number) and finds receipts', () => {
    const r = issueReceipt(ctx, {
      customer: '',
      items: [
        { name: 'خاتم', brand: 'Pandora', quantity: 2, price: 350_000 },
        { name: '  ', quantity: 1, price: 1 },
      ],
    });
    expect(r.customer).toBe('Salford Libya');
    expect(r.items).toHaveLength(1);
    expect(r.total).toBe(700_000);
    expect(r.date).toBe('09/11/2026');
    const edited = updateReceipt(ctx, r.id, {
      customer: 'سارة',
      items: [{ name: 'قلادة', quantity: 1, price: 600_000 }],
      template: 'swarovski',
      showPrices: false,
    });
    expect(edited.receiptNo).toBe(r.receiptNo);
    expect(edited.showPrices).toBe(false);
    expect(listReceipts(ctx, { search: 'قلادة' })).toHaveLength(1);
    expect(listReceipts(ctx, { search: 'سارة' })).toHaveLength(1);
    expect(listReceipts(ctx, { month: '2026-10' })).toHaveLength(0);
    expect(listReceipts(ctx, { template: 'swarovski' })).toHaveLength(1);
  });

  it('refuses empty receipts and another system’s designs', () => {
    expect(() => issueReceipt(ctx, { items: [] })).toThrow('قطعة واحدة');
    expect(() =>
      issueReceipt(ctx, {
        items: [{ name: 'x', quantity: 1, price: 1 }],
        template: 'scarves_libya',
      }),
    ).toThrow('غير متاح');
  });
});

describe('checkout', () => {
  it('saves one sale with its lines, lowers stock and issues the receipt', () => {
    setRate(ctx, 7_125);
    const ring = product('خاتم', 350_000, 3, 200_000);
    const neck = product('قلادة', 600_000, 1, 400_000);
    let cart = ok(addToCart([], ring, 'خاتم', 2, 300_000));
    cart = ok(addToCart(cart, neck, 'قلادة', 1));
    const r = checkout(ctx, {
      cart,
      paymentMethod: 'cash',
      customer: { name: 'سارة', phone: '0912345678' },
    });
    expect(r.total).toBe(1_200_000);
    const sale = ctx.db.get<{
      total: number;
      total_cost: number;
      rate: number;
      customer_id: number;
      month: string;
    }>('SELECT * FROM sales WHERE id = ?', [r.saleId])!;
    expect(sale).toMatchObject({
      total: 1_200_000,
      total_cost: 800_000,
      rate: 7_125,
      month: '2026-11',
    });
    const lines = ctx.db.all<{
      name: string;
      unit_price: number;
      list_price: number;
      brand: string;
    }>('SELECT name, unit_price, list_price, brand FROM sale_lines WHERE sale_id = ? ORDER BY id', [
      r.saleId,
    ]);
    expect(lines).toEqual([
      { name: 'خاتم', unit_price: 300_000, list_price: 350_000, brand: 'Pandora' },
      { name: 'قلادة', unit_price: 600_000, list_price: 600_000, brand: 'Pandora' },
    ]);
    expect(getProduct(ctx, ring.id)?.stock).toBe(1);
    expect(getProduct(ctx, neck.id)?.stock).toBe(0);
    expect(stockHistory(ctx, ring.id)[0]).toMatchObject({ kind: 'sale', delta: -2 });
    expect(r.receipt.receiptNo).toBe('GR-2026-0001');
    expect(r.receipt.customer).toBe('سارة');
    expect(receiptForSale(ctx, r.saleId)?.id).toBe(r.receipt.id);
    expect(getCustomer(ctx, sale.customer_id)?.name).toBe('سارة');
  });

  it('sells nothing when any line fails (all-or-nothing)', () => {
    const ring = product('خاتم', 350_000, 2);
    const neck = product('قلادة', 600_000, 1);
    let cart = ok(addToCart([], ring, 'خاتم', 2));
    cart = ok(addToCart(cart, neck, 'قلادة', 1));
    adjustStock(ctx, neck.id, -1, 'بيعت خارج التطبيق');
    expect(() => checkout(ctx, { cart, paymentMethod: 'cash' })).toThrow(CheckoutError);
    expect(getProduct(ctx, ring.id)?.stock).toBe(2);
    expect(ctx.db.get<{ n: number }>('SELECT count(*) n FROM sales')?.n).toBe(0);
    expect(ctx.db.get<{ n: number }>('SELECT count(*) n FROM receipts')?.n).toBe(0);
  });

  it('needs a customer for a credit sale', () => {
    const ring = product('خاتم', 350_000, 2);
    const cart = ok(addToCart([], ring, 'خاتم', 1));
    expect(() => checkout(ctx, { cart, paymentMethod: 'credit' })).toThrow('البيع الآجل يحتاج');
    expect(() =>
      checkout(ctx, { cart, paymentMethod: 'credit', customer: { phone: '0912345678' } }),
    ).not.toThrow();
  });

  it('keeps sale history unchanged when the product is edited later', () => {
    const ring = product('خاتم', 350_000, 2);
    const r = checkout(ctx, { cart: ok(addToCart([], ring, 'خاتم', 1)), paymentMethod: 'card' });
    saveProduct(ctx, {
      id: ring.id,
      name: 'اسم جديد',
      category: 'خواتم',
      price: 999_000,
      stock: 1,
    });
    const line = ctx.db.get<{ name: string; unit_price: number }>(
      'SELECT name, unit_price FROM sale_lines WHERE sale_id = ?',
      [r.saleId],
    );
    expect(line).toEqual({ name: 'خاتم', unit_price: 350_000 });
    expect(getReceipt(ctx, r.receipt.id)?.items[0].name).toBe('خاتم');
  });

  it('sells a set at the set price', () => {
    const a = product('قلادة', 600_000, 1);
    const b = product('حلق', 300_000, 1);
    const set = getSet(
      ctx,
      saveSet(ctx, {
        name: 'طقم',
        discount: 150_000,
        items: [
          { productId: a.id, quantity: 1 },
          { productId: b.id, quantity: 1 },
        ],
      }),
    )!;
    const cart = (addSet([], setForCart(ctx, set)) as { cart: CartLine[] }).cart;
    const r = checkout(ctx, { cart, paymentMethod: 'transfer' });
    expect(r.total).toBe(750_000);
    const lines = ctx.db.all<{ set_name: string; line_total: number }>(
      'SELECT set_name, line_total FROM sale_lines WHERE sale_id = ?',
      [r.saleId],
    );
    expect(lines.every((l) => l.set_name === 'طقم')).toBe(true);
    expect(lines.reduce((s, l) => s + l.line_total, 0)).toBe(750_000);
  });

  it('is a RuleError so screens can show the message', () => {
    expect(new CheckoutError([{ kind: 'empty' }])).toBeInstanceOf(RuleError);
  });
});
