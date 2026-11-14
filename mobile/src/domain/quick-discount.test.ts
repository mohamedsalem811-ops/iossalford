import { hasPercentOff, listPrices, percentOff, type CartLine } from './cart';

const line = (key: string, productId: number, unitPrice: number, quantity = 1): CartLine => ({
  key,
  productId,
  name: key,
  quantity,
  unitPrice,
  listPrice: unitPrice,
});
const prices: Record<number, number> = { 1: 150_000, 2: 20_000, 3: 75_500 };
const list = (id: number) => prices[id];
const total = (cart: CartLine[]) => cart.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

describe('quick percentage discount (feature 10)', () => {
  it('takes the percentage of the sale, rounded down to a whole dinar', () => {
    // 150 + 20 = 170 dinars; 3% = 5.1 → 5 dinars.
    const cart = [line('a', 1, 150_000), line('b', 2, 20_000)];
    const r = percentOff(cart, list, 3);
    expect(r.total).toBe(5_000);
    expect(total(r.cart)).toBe(165_000);
    // Every piece keeps a whole-dinar price.
    for (const l of r.cart) expect(l.unitPrice % 1000).toBe(0);
  });

  it('counts the pieces of a line and the cheap pieces too', () => {
    // 3 × 20 = 60 dinars; 3% = 1.8 → 1 dinar, given to a piece where it fits.
    const cart = [line('a', 2, 20_000, 3)];
    const r = percentOff(cart, list, 3);
    // One dinar can't be split over 3 pieces of the same line: nothing is taken rather than more.
    expect(r.total).toBe(0);
    expect(total(r.cart)).toBe(60_000);
    const two = percentOff([line('a', 2, 20_000, 3), line('b', 1, 150_000)], list, 3);
    // 210 dinars → 6; the 150 piece takes 4 + the leftover, the 3 scarves take 0 or 1 each.
    expect(two.total).toBe(6_000);
    expect(total(two.cart)).toBe(204_000);
  });

  it('starts from the list price, so pressing it twice is the same', () => {
    const cart = [line('a', 1, 140_000)]; // already negotiated down
    const once = percentOff(cart, list, 3);
    expect(once.cart[0].unitPrice).toBe(146_000); // 150 − 4.5 → 4
    expect(percentOff(once.cart, list, 3).cart).toEqual(once.cart);
    expect(hasPercentOff(once.cart, list, 3)).toBe(true);
    expect(hasPercentOff(cart, list, 3)).toBe(false);
    expect(listPrices(once.cart, list)[0].unitPrice).toBe(150_000);
  });

  it('leaves sets at their own price', () => {
    const set: CartLine = {
      ...line('s', 3, 70_000),
      bundleGroup: 'g',
      setId: 1,
      lineTotal: 70_000,
    };
    const r = percentOff([set, line('a', 1, 150_000)], list, 3);
    expect(r.cart[0]).toBe(set);
    expect(r.total).toBe(4_000);
    expect(listPrices(r.cart, list)[0]).toBe(set);
  });

  it('gives nothing on an empty or tiny sale', () => {
    expect(percentOff([], list, 3).total).toBe(0);
    expect(percentOff([line('a', 2, 20_000)], list, 3).total).toBe(0);
    expect(hasPercentOff([line('a', 2, 20_000)], list, 3)).toBe(false);
  });
});
