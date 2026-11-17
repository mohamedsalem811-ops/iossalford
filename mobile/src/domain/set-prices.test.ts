/**
 * A set's price spread over its pieces (J1, from the full check): whole dinars a piece, so the
 * receipt (price × quantity per line) adds up to exactly what the customer paid.
 */
import { addSet, lineTotal, priceChanges, type CartLine, type SetForCart } from './cart';
import { checkout } from './checkout';
import { getProduct, saveProduct, type Product } from './products';
import { getReceipt } from './receipts';
import { getSale } from './sales';
import { getSet, saveSet, setForCart } from './sets';
import { makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let chain: number;
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 350_000, stock: 9 });
  chain = saveProduct(ctx, { name: 'سلسلة', category: 'قلادات', price: 500_000, stock: 9 });
});
afterEach(() => ctx.close());

const cartOf = (discount: number, items: { productId: number; quantity: number }[]) => {
  const id = saveSet(ctx, { name: 'طقم', discount, items });
  const r = addSet([], setForCart(ctx, getSet(ctx, id)!));
  if (!('cart' in r)) throw new Error('the set did not go into the cart');
  return r.cart;
};

const wholeDinars = (cart: CartLine[]) =>
  cart.every((l) => l.unitPrice % 1_000 === 0 && l.unitPrice * l.quantity === lineTotal(l));

describe('set prices', () => {
  it('gives each piece a whole-dinar price that adds up to the set price', () => {
    const cart = cartOf(50_000, [
      { productId: ring, quantity: 1 },
      { productId: chain, quantity: 1 },
    ]);
    expect(wholeDinars(cart)).toBe(true);
    expect(cart.reduce((t, l) => t + lineTotal(l), 0)).toBe(800_000);
  });

  it('prints a receipt that adds up to the sale with 2 of the same piece', () => {
    const cart = cartOf(100_000, [
      { productId: ring, quantity: 2 },
      { productId: chain, quantity: 1 },
    ]);
    expect(wholeDinars(cart)).toBe(true);
    const sold = checkout(ctx, { cart, paymentMethod: 'cash' });
    const sale = getSale(ctx, sold.saleId)!;
    expect(sale.total).toBe(1_100_000);
    expect(getReceipt(ctx, sold.receipt.id)!.total).toBe(sale.total);
    for (const l of sale.lines) expect(l.unitPrice * l.quantity).toBe(l.lineTotal);
  });

  it('puts a discount with dirhams on one piece, still exact', () => {
    const cart = cartOf(50_500, [
      { productId: ring, quantity: 1 },
      { productId: chain, quantity: 2 },
    ]);
    expect(cart.reduce((t, l) => t + lineTotal(l), 0)).toBe(1_350_000 - 50_500);
    expect(cart.every((l) => l.unitPrice * l.quantity === lineTotal(l))).toBe(true);
    expect(cart.filter((l) => l.unitPrice % 1_000 !== 0)).toHaveLength(1);
  });

  it('keeps every line exact when no piece can carry the dirhams alone', () => {
    const cart = cartOf(50_500, [
      { productId: ring, quantity: 2 },
      { productId: chain, quantity: 2 },
    ]);
    expect(cart.reduce((t, l) => t + lineTotal(l), 0)).toBe(1_700_000 - 50_500);
  });

  it('does not report a price change for a set kept in a cart from before (same price)', () => {
    const set: SetForCart = setForCart(
      ctx,
      getSet(
        ctx,
        saveSet(ctx, {
          name: 'طقم',
          discount: 50_000,
          items: [
            { productId: ring, quantity: 1 },
            { productId: chain, quantity: 1 },
          ],
        }),
      )!,
    );
    // The split the app used before: to the dirham (329.412 + 470.588).
    const kept: CartLine[] = [
      {
        key: 'a',
        productId: ring,
        name: 'خاتم',
        quantity: 1,
        unitPrice: 329_412,
        lineTotal: 329_412,
        setId: set.id,
        setName: 'طقم',
        bundleGroup: 'g',
      },
      {
        key: 'b',
        productId: chain,
        name: 'سلسلة',
        quantity: 1,
        unitPrice: 470_588,
        lineTotal: 470_588,
        setId: set.id,
        setName: 'طقم',
        bundleGroup: 'g',
      },
    ];
    const current = (id: number): Product | undefined => getProduct(ctx, id);
    expect(priceChanges(kept, current, () => set)).toEqual([]);
  });
});
