/**
 * @jest-environment node
 *
 * Credit (آجل) needs the owner's credit code (rule B): an employee gives credit only with the
 * code the owner gives them, on a sale, an exchange on credit, the delivery of a deposit order
 * (a sale) and the rest of a repair. The owner needs no code. A missing code is asked before
 * any other approval is used up.
 */
import { OWNER } from '@/staff/model';

import { addToCart, type CartLine } from './cart';
import { ApprovalNeeded, checkout, CreditCodeNeeded } from './checkout';
import { balance } from './debts';
import { exchange } from './exchange';
import { displayName, getProduct, saveProduct } from './products';
import { deliverRepair, moveRepair, takeRepair } from './repairs';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let granted: Set<string>;
const grant = (purpose: string) => {
  const token = `t${granted.size}`;
  granted.add(`${purpose}:${token}`);
  return token;
};
const MONA = { name: 'منى', phone: '0912345678' };
const cart = (id: number, price?: number): CartLine[] => {
  const p = getProduct(ctx, id)!;
  const c = (addToCart([], p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart;
  return price === undefined ? c : c.map((l) => ({ ...l, unitPrice: price }));
};

beforeEach(() => {
  ctx = makeCtx();
  granted = new Set();
  ctx.approvals = { take: (t, p) => granted.delete(`${p}:${t}`) };
  ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 100_000, stock: 9 });
  ctx.setActor(EMPLOYEE);
});
afterEach(() => ctx.close());

describe('a sale on credit', () => {
  it('needs the credit code from an employee, and nothing is sold without it', () => {
    expect(() =>
      checkout(ctx, { cart: cart(ring), paymentMethod: 'credit', customer: MONA }),
    ).toThrow(CreditCodeNeeded);
    expect(() =>
      checkout(ctx, {
        cart: cart(ring),
        paymentMethod: 'credit',
        customer: MONA,
        creditApproval: 'wrong',
      }),
    ).toThrow(CreditCodeNeeded);
    expect(getProduct(ctx, ring)!.stock).toBe(9);
    const { saleId } = checkout(ctx, {
      cart: cart(ring),
      paymentMethod: 'credit',
      customer: MONA,
      creditApproval: grant('credit'),
    });
    expect(saleId).toBeGreaterThan(0);
    expect(getProduct(ctx, ring)!.stock).toBe(8);
  });

  it('needs no code from the owner, nor for cash', () => {
    checkout(ctx, { cart: cart(ring), paymentMethod: 'cash' });
    ctx.setActor(OWNER);
    checkout(ctx, { cart: cart(ring), paymentMethod: 'credit', customer: MONA });
    expect(getProduct(ctx, ring)!.stock).toBe(7);
  });

  it('asks the code before the discount approval, and uses neither until both are given', () => {
    const discounted = cart(ring, 60_000);
    const sale = { cart: discounted, paymentMethod: 'credit' as const, customer: MONA };
    expect(() => checkout(ctx, { ...sale, discountReason: 'زبونة دائمة' })).toThrow(
      CreditCodeNeeded,
    );
    const code = grant('credit');
    expect(() =>
      checkout(ctx, { ...sale, discountReason: 'زبونة دائمة', creditApproval: code }),
    ).toThrow(ApprovalNeeded);
    // The code was not used up by the sale the discount stopped.
    expect(granted.has(`credit:${code}`)).toBe(true);
    checkout(ctx, {
      ...sale,
      discountReason: 'زبونة دائمة',
      creditApproval: code,
      approval: grant('discount'),
    });
    expect(granted.size).toBe(0);
  });
});

it('needs the code for an exchange on a credit sale', () => {
  const chain = saveProduct(
    { ...ctx, actor: OWNER },
    { name: 'سلسلة', category: 'سلاسل', price: 150_000, stock: 3 },
  );
  const { saleId } = checkout(ctx, {
    cart: cart(ring),
    paymentMethod: 'credit',
    customer: MONA,
    creditApproval: grant('credit'),
  });
  const line = ctx.db.get<{ id: number }>('SELECT id FROM sale_lines WHERE sale_id = ?', [
    saleId,
  ])!.id;
  const input = {
    ret: { ...passing(ctx), saleLineId: line, quantity: 1 },
    sale: { cart: cart(chain), paymentMethod: 'credit' as const },
  };
  expect(() => exchange(ctx, input)).toThrow(CreditCodeNeeded);
  const r = exchange(ctx, { ...input, sale: { ...input.sale, creditApproval: grant('credit') } });
  expect(r.difference).toBe(50_000);
});

it('needs the code for the rest of a repair left on credit', () => {
  const { repairId } = takeRepair(ctx, {
    customer: MONA,
    description: 'خاتم ذهب',
    work: 'resize',
    price: 50_000,
    readyBy: '2026-11-20',
  });
  moveRepair(ctx, repairId, 'ready');
  expect(() => deliverRepair(ctx, repairId, { method: 'credit' })).toThrow(CreditCodeNeeded);
  deliverRepair(ctx, repairId, { method: 'credit', creditApproval: grant('credit') });
  const customerId = ctx.db.get<{ customer_id: number }>(
    'SELECT customer_id FROM repairs WHERE id = ?',
    [repairId],
  )!.customer_id;
  expect(balance(ctx, customerId)).toBe(50_000);
});
