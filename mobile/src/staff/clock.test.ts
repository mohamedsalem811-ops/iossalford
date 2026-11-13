import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import { ClockError } from '@/domain/context';
import { getProduct, listProducts, saveProduct } from '@/domain/products';
import { makeCtx } from '@/domain/testing/ctx';

import { CLOCK_TOLERANCE_MS, ClockGuard } from './clock';
import { WRITES } from './permissions';

const memory = () => {
  let v: string | null = null;
  return { get: () => v, set: (x: string) => void (v = x), peek: () => v };
};
const at = (h: number, m = 0) => new Date(2026, 10, 13, h, m);

describe('the clock guard', () => {
  it('remembers the latest time and refuses once the clock goes back beyond a few minutes', () => {
    const store = memory();
    const onBack = jest.fn();
    const g = new ClockGuard(store, onBack);
    expect(g.check(at(10))).toBeNull();
    expect(g.check(at(12))).toBeNull();
    // A few minutes back (the clock syncing) is fine.
    expect(g.check(new Date(at(12).getTime() - CLOCK_TOLERANCE_MS + 1000))).toBeNull();
    // Back to 11:00: refused, reported once.
    expect(g.check(at(11))).toContain(
      'ساعة الجهاز أقدم من آخر وقت سجّله التطبيق (2026-11-13 12:00)',
    );
    expect(g.check(at(11, 5))).not.toBeNull();
    expect(onBack).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledWith(at(12), at(11));
    // Put right: allowed again.
    expect(g.check(at(12, 30))).toBeNull();
  });

  it('keeps the latest time across app runs', () => {
    const store = memory();
    new ClockGuard(store).check(at(15));
    const again = new ClockGuard(store);
    expect(again.latest()).toEqual(at(15));
    expect(again.behind(at(9))).toBe(true);
  });

  it('lets the owner accept the device time', () => {
    const g = new ClockGuard(memory());
    g.check(at(18));
    g.accept(at(9));
    expect(g.check(at(9, 1))).toBeNull();
  });

  it('applies only to actions that change data', () => {
    expect(WRITES['sales.create']).toBe(true);
    expect(WRITES['backup.restore']).toBe(true);
    expect(WRITES['reports.view']).toBeUndefined();
    expect(WRITES['log.view']).toBeUndefined();
  });
});

describe('inside the business rules', () => {
  it('refuses a sale dated in the past, writing nothing, while reading still works', () => {
    const ctx = makeCtx('jewelry', at(12));
    const guard = new ClockGuard(memory());
    ctx.clock = guard;
    const ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 1_000, stock: 3 });
    ctx.setNow(at(8));
    const p = getProduct(ctx, ring)!;
    const cart = (addToCart([], p, p.name, 1) as { cart: CartLine[] }).cart;
    expect(() => checkout(ctx, { cart, paymentMethod: 'cash' })).toThrow(ClockError);
    expect(getProduct(ctx, ring)?.stock).toBe(3);
    expect(listProducts(ctx)).toHaveLength(1);
    ctx.close();
  });
});
