/**
 * @jest-environment node
 *
 * A sale's receipt is a record of that sale (audit 11): an employee changes its design, hides
 * the prices or the specs, but never its pieces, prices or customer, which come from the sale.
 * A receipt made by hand is the owner's (K review); the owner may still correct a sale's receipt.
 */
import { OWNER } from '@/staff/model';

import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { RuleError, type Ctx } from './context';
import { displayName, getProduct, saveProduct } from './products';
import { getReceipt, issueReceipt, receiptForSale, updateReceipt } from './receipts';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

function sell(ctx: Ctx, productId: number) {
  const p = getProduct(ctx, productId)!;
  const cart = (addToCart([], p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: 'cash', customer: { name: 'منى' } }).saleId;
}

describe("a sale's receipt", () => {
  let ctx: TestCtx;
  let ring: number;
  beforeEach(() => {
    ctx = makeCtx();
    ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 500, stock: 5 });
  });
  afterEach(() => ctx.close());

  it('refuses an employee changing its pieces, prices or customer', () => {
    ctx.setActor(EMPLOYEE);
    const r = receiptForSale(ctx, sell(ctx, ring))!;
    const items = r.items.map((i) => ({ ...i }));
    expect(() =>
      updateReceipt(ctx, r.id, { items: [{ ...items[0], price: 700 }], customer: r.customer }),
    ).toThrow(RuleError);
    expect(() =>
      updateReceipt(ctx, r.id, { items: [...items, { name: 'قطعة', quantity: 1, price: 50 }] }),
    ).toThrow(RuleError);
    expect(() => updateReceipt(ctx, r.id, { items, customer: 'شخص آخر' })).toThrow(RuleError);
    expect(getReceipt(ctx, r.id)!.items[0].price).toBe(500);
    expect(getReceipt(ctx, r.id)!.customer).toBe('منى');
  });

  it('lets an employee change only its design and what it shows', () => {
    ctx.setActor(EMPLOYEE);
    const r = receiptForSale(ctx, sell(ctx, ring))!;
    const saved = updateReceipt(ctx, r.id, {
      items: r.items,
      customer: r.customer,
      showPrices: false,
      showSpecs: false,
    });
    expect(saved).toMatchObject({ showPrices: false, showSpecs: false, customer: 'منى' });
    expect(saved.items[0].price).toBe(500);
  });

  it('lets the owner correct it', () => {
    const r = receiptForSale(ctx, sell(ctx, ring))!;
    ctx.setActor(OWNER);
    expect(updateReceipt(ctx, r.id, { items: r.items, customer: 'منى علي' }).customer).toBe(
      'منى علي',
    );
  });
});

describe('a receipt made by hand', () => {
  let ctx: TestCtx;
  beforeEach(() => (ctx = makeCtx()));
  afterEach(() => ctx.close());

  it("is the owner's: an employee can't make one, nor change its pieces (K review)", () => {
    ctx.setActor(EMPLOYEE);
    expect(() => issueReceipt(ctx, { items: [{ name: 'قطعة', quantity: 1, price: 5 }] })).toThrow(
      'إيصال يدوي: للمالك فقط.',
    );
    ctx.setActor(OWNER);
    const manual = issueReceipt(ctx, { items: [{ name: 'قطعة', quantity: 1, price: 5 }] });
    ctx.setActor(EMPLOYEE);
    expect(() =>
      updateReceipt(ctx, manual.id, { items: [{ name: 'قطعة', quantity: 2, price: 5 }] }),
    ).toThrow(RuleError);
    expect(getReceipt(ctx, manual.id)).toBeUndefined();
    ctx.setActor(OWNER);
    expect(getReceipt(ctx, manual.id)!.items[0].quantity).toBe(1);
  });
});
