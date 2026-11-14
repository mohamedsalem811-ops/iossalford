/**
 * @jest-environment node
 *
 * The fixes from the full audit after phase S6 (batch 1): a kept cart at changed prices (F-1),
 * deleting a sale with returns or in a closed period (F-2), the approval kept when the sale is
 * refused for no shift (F-7), and the owner's old sales in sales by seller (F-8).
 */
import {
  addSet,
  addToCart,
  cartTotal,
  priceChanges,
  setUnitPrice,
  problemMessage,
  updatePrices,
  type CartLine,
} from './cart';
import { checkout, CheckoutError } from './checkout';
import { closeQuarter, deleteClosing } from './closing';
import { getProduct, saveProduct, type Product } from './products';
import { breakdown } from './reports';
import { addReturn, deleteReturn, deleteSale, getSale, saleDeleteCheck } from './sales';
import { getSet, saveSet, setForCart } from './sets';
import { closeShift } from './shifts';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';
import { OWNER } from '@/staff/model';

let ctx: TestCtx;
const granted = new Set<string>();
beforeEach(() => {
  ctx = makeCtx('jewelry');
  granted.clear();
  ctx.approvals = { take: (t, p) => granted.delete(`${p}:${t}`) };
});
afterEach(() => ctx.close());

function product(name: string, price: number, stock = 5): Product {
  return getProduct(
    ctx,
    saveProduct(ctx, { name, category: 'خواتم', price, cost: 100_000, stock }),
  )!;
}
const ok = (r: { cart: CartLine[] } | { problem: unknown }) => {
  if (!('cart' in r)) throw new Error(JSON.stringify(r.problem));
  return r.cart;
};
const now = (id: number) => getProduct(ctx, id);
const setNow = (id: number) => {
  const s = getSet(ctx, id);
  return s ? setForCart(ctx, s) : undefined;
};
const reprice = (p: Product, price: number) =>
  saveProduct(ctx, {
    id: p.id,
    name: p.name,
    category: p.category,
    price,
    cost: p.cost,
    stock: p.stock,
  });

describe('F-1: a kept cart never sells at an old price', () => {
  it('refuses a piece whose price changed, and updates it', () => {
    const ring = product('خاتم', 350_000);
    const cart = ok(addToCart([], ring, 'خاتم', 2));
    reprice(ring, 300_000);
    expect(priceChanges(cart, now, setNow)).toEqual([
      { kind: 'price', name: 'خاتم', was: 350_000, now: 300_000 },
    ]);
    expect(() => checkout(ctx, { cart, paymentMethod: 'cash' })).toThrow(CheckoutError);
    expect(() => checkout(ctx, { cart, paymentMethod: 'cash' })).toThrow(
      'سعر «خاتم» تغيّر من 350 د.ل إلى 300 د.ل',
    );
    const fresh = updatePrices(cart, now, setNow);
    expect(cartTotal(fresh)).toBe(600_000);
    expect(priceChanges(fresh, now, setNow)).toEqual([]);
    expect(checkout(ctx, { cart: fresh, paymentMethod: 'cash' }).total).toBe(600_000);
  });

  it('keeps a price agreed with the customer when the list price changes', () => {
    const ring = product('خاتم', 350_000);
    const cart = setUnitPrice(ok(addToCart([], ring, 'خاتم', 1)), '', 0);
    const agreed = setUnitPrice(cart, cart[0].key, 320_000);
    reprice(ring, 400_000);
    const fresh = updatePrices(agreed, now, setNow);
    expect(fresh[0]).toMatchObject({ unitPrice: 320_000, listPrice: 400_000 });
  });

  it('treats a cart kept before this check by its price paid', () => {
    const ring = product('خاتم', 350_000);
    const old: CartLine[] = [
      { key: 'k', productId: ring.id, name: 'خاتم', quantity: 1, unitPrice: 350_000 },
    ];
    expect(priceChanges(old, now, setNow)).toEqual([]);
    reprice(ring, 360_000);
    expect(priceChanges(old, now, setNow)).toEqual([
      expect.objectContaining({ was: 350_000, now: 360_000, unsure: true }),
    ]);
    expect(updatePrices(old, now, setNow)[0]).toMatchObject({ unitPrice: 360_000 });
  });

  it('lets a cart kept before this check keep a price agreed with the customer', () => {
    // Added at 300 when the list price was 350: agreed, or the old list price? Checkout asks.
    const ring = product('خاتم', 350_000);
    const old: CartLine[] = [
      { key: 'k', productId: ring.id, name: 'خاتم', quantity: 1, unitPrice: 300_000 },
    ];
    const [problem] = priceChanges(old, now, setNow);
    expect(problemMessage(problem)).toBe(
      '«خاتم» في السلة بسعر 300 د.ل وسعره الآن 350 د.ل. إن كان سعراً اتفقت عليه مع الزبون فأبقِه، وإلا فحدّث السعر.',
    );
    // Kept: the price stays, now as a discount from today's list price, checked like any other.
    const kept = updatePrices(old, now, setNow, { keepUnsure: true });
    expect(kept[0]).toMatchObject({ unitPrice: 300_000, listPrice: 350_000 });
    expect(priceChanges(kept, now, setNow)).toEqual([]);
    // A line that remembers its list price is not "unsure": only its list price is compared.
    reprice(ring, 360_000);
    expect(priceChanges(kept, now, setNow)).toEqual([
      expect.not.objectContaining({ unsure: true }),
    ]);
  });

  it('refuses a set whose price or pieces changed, or that was deleted', () => {
    const a = product('قلادة', 600_000);
    const b = product('حلق', 300_000);
    const id = saveSet(ctx, {
      name: 'طقم',
      discount: 100_000,
      items: [
        { productId: a.id, quantity: 1 },
        { productId: b.id, quantity: 1 },
      ],
    });
    const cart = ok(addSet([], setNow(id)!));
    expect(priceChanges(cart, now, setNow)).toEqual([]);
    saveSet(ctx, {
      id,
      name: 'طقم',
      discount: 200_000,
      items: [
        { productId: a.id, quantity: 1 },
        { productId: b.id, quantity: 1 },
      ],
    });
    expect(priceChanges(cart, now, setNow)).toEqual([
      { kind: 'price', name: 'طقم', was: 800_000, now: 700_000 },
    ]);
    const fresh = updatePrices(cart, now, setNow);
    expect(cartTotal(fresh)).toBe(700_000);
    expect(new Set(fresh.map((l) => l.bundleGroup)).size).toBe(1);
    expect(checkout(ctx, { cart: fresh, paymentMethod: 'cash' }).total).toBe(700_000);
  });

  it('turns a deleted set into its pieces at their own prices', () => {
    const a = product('قلادة', 600_000);
    const id = saveSet(ctx, {
      name: 'طقم',
      discount: 100_000,
      items: [{ productId: a.id, quantity: 1 }],
    });
    const cart = ok(addSet([], setNow(id)!));
    ctx.db.run('DELETE FROM sets WHERE id = ?', [id]);
    expect(priceChanges(cart, now, setNow)).toEqual([
      { kind: 'price', name: 'طقم', was: 500_000, now: null },
    ]);
    const fresh = updatePrices(cart, now, setNow);
    expect(fresh).toEqual([expect.objectContaining({ unitPrice: 600_000, listPrice: 600_000 })]);
    expect(fresh[0].bundleGroup).toBeUndefined();
  });
});

describe('F-2: deleting a sale', () => {
  it('is refused while it has returns, and allowed once they are undone', () => {
    const ring = product('خاتم', 350_000);
    const sale = checkout(ctx, { cart: ok(addToCart([], ring, 'خاتم', 2)), paymentMethod: 'cash' });
    const ret = addReturn(ctx, {
      ...passing(ctx),
      saleLineId: getSale(ctx, sale.saleId)!.lines[0].id,
      quantity: 1,
    });
    expect(saleDeleteCheck(ctx, sale.saleId)).toContain('مرتجعات');
    expect(() => deleteSale(ctx, sale.saleId)).toThrow('مرتجعات');
    deleteReturn(ctx, ret);
    deleteSale(ctx, sale.saleId);
    expect(getProduct(ctx, ring.id)!.stock).toBe(5);
    // The receipt stays with its number unless asked.
    expect(ctx.db.get<{ n: number }>('SELECT count(*) n FROM receipts')!.n).toBe(1);
  });

  it('deletes its receipt too when asked', () => {
    const ring = product('خاتم', 350_000);
    const sale = checkout(ctx, { cart: ok(addToCart([], ring, 'خاتم', 1)), paymentMethod: 'cash' });
    deleteSale(ctx, sale.saleId, { deleteReceipt: true });
    expect(ctx.db.get<{ n: number }>('SELECT count(*) n FROM receipts')!.n).toBe(0);
  });

  it('is refused in a closed quarter until its closing is removed', () => {
    const ring = product('خاتم', 350_000);
    const sale = checkout(ctx, { cart: ok(addToCart([], ring, 'خاتم', 1)), paymentMethod: 'cash' });
    const closing = closeQuarter(ctx, { year: 2026, quarter: 4 });
    expect(() => deleteSale(ctx, sale.saleId)).toThrow('مُقفل');
    deleteClosing(ctx, closing.id);
    deleteSale(ctx, sale.saleId);
  });

  it('is refused after its shift closed, and so is deleting a return from a closed shift', () => {
    const ring = product('خاتم', 350_000);
    ctx.setActor(EMPLOYEE);
    const sale = checkout(ctx, { cart: ok(addToCart([], ring, 'خاتم', 2)), paymentMethod: 'cash' });
    const ret = addReturn(ctx, {
      ...passing(ctx),
      saleLineId: getSale(ctx, sale.saleId)!.lines[0].id,
      quantity: 1,
    });
    closeShift(ctx, 350_000);
    ctx.setActor(OWNER);
    expect(() => deleteReturn(ctx, ret)).toThrow('ورديتها أُغلقت');
    expect(saleDeleteCheck(ctx, sale.saleId)).toContain('مرتجعات');
    const other = (() => {
      ctx.setActor(EMPLOYEE);
      const id = checkout(ctx, {
        cart: ok(addToCart([], ring, 'خاتم', 1)),
        paymentMethod: 'cash',
      }).saleId;
      closeShift(ctx, 350_000);
      ctx.setActor(OWNER);
      return id;
    })();
    expect(() => deleteSale(ctx, other)).toThrow('سجّل مرتجعاً بدلاً من الحذف');
  });
});

describe('F-7: the approval is not used up by a sale refused for no shift', () => {
  it('asks for the shift first', () => {
    const noShift = makeCtx('jewelry', undefined, { autoShift: false });
    try {
      const ring = getProduct(
        noShift,
        saveProduct(noShift, {
          name: 'خاتم',
          category: 'خواتم',
          price: 350_000,
          cost: 1,
          stock: 5,
        }),
      )!;
      noShift.approvals = { take: (t, p) => granted.delete(`${p}:${t}`) };
      noShift.setActor(EMPLOYEE);
      granted.add('discount:t1');
      const cart = setUnitPrice(ok(addToCart([], ring, 'خاتم', 1)), '', 0);
      const cheap = setUnitPrice(cart, cart[0].key, 200_000);
      expect(() =>
        checkout(noShift, {
          cart: cheap,
          paymentMethod: 'cash',
          discountReason: 'عرض',
          approval: 't1',
        }),
      ).toThrow('وردية');
      expect(granted.has('discount:t1')).toBe(true);
    } finally {
      noShift.close();
    }
  });
});

describe('F-8: sales by seller', () => {
  it('counts the owner’s sales from before phase S3 as the owner’s', () => {
    const ring = product('خاتم', 350_000);
    checkout(ctx, { cart: ok(addToCart([], ring, 'خاتم', 1)), paymentMethod: 'cash' });
    const s = checkout(ctx, { cart: ok(addToCart([], ring, 'خاتم', 1)), paymentMethod: 'cash' });
    ctx.db.run('UPDATE sales SET seller = NULL, seller_name = NULL WHERE id = ?', [s.saleId]);
    expect(breakdown(ctx, ['2026-11'], 'seller')).toEqual([
      { key: 'المالك', total: 700_000, quantity: 2, profit: 500_000 },
    ]);
  });
});
