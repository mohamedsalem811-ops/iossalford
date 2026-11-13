/**
 * @jest-environment node
 *
 * Phase S4: discount limits with the owner's approval on the spot, the new return rules (the
 * window, the conditions, the photo, the refund), the owner's override, exchanges and the
 * employee's account. The edges: exactly at a limit, at the window, one condition "no".
 */
import { OWNER } from '@/staff/model';

import { listActivity } from './activity';
import { addToCart, setUnitPrice, type CartLine } from './cart';
import { ApprovalNeeded, checkout } from './checkout';
import { PermissionError, RuleError, type ApprovalPurpose } from './context';
import { balance } from './debts';
import { exchange } from './exchange';
import { getPolicies, setPolicies } from './policies';
import { getProduct, saveProduct } from './products';
import {
  addReturn,
  addReturnWithoutSale,
  findSaleForReturn,
  getReturn,
  getSale,
  ReturnRefused,
} from './sales';
import {
  chargeReturn,
  employeeStatement,
  ledgerBalances,
  recordRepayment,
  returnCharge,
  waiveCharge,
} from './staff-ledger';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let chain: number;
/** One-time approvals the owner gave on the spot ("discount:t1"). */
let granted: Set<string>;
const approve = (purpose: ApprovalPurpose, token = 't1') => granted.add(`${purpose}:${token}`);

beforeEach(() => {
  ctx = makeCtx();
  granted = new Set();
  ctx.approvals = { take: (t, p) => granted.delete(`${p}:${t}`) };
  ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 100_000, stock: 10 });
  chain = saveProduct(ctx, { name: 'سلسلة', category: 'سلاسل', price: 50_000, stock: 10 });
  setPolicies(ctx, { discountPerPiece: 10_000, discountPerSale: 15_000 });
});
afterEach(() => ctx.close());

/** A cart of pieces at a price per piece. */
function cart(...items: [id: number, qty: number, price?: number][]): CartLine[] {
  let c: CartLine[] = [];
  for (const [id, qty, price] of items) {
    const p = getProduct(ctx, id)!;
    c = (addToCart(c, p, p.name, qty) as { cart: CartLine[] }).cart;
    if (price !== undefined) c = setUnitPrice(c, c[c.length - 1].key, price);
  }
  return c;
}

const sell = (c: CartLine[], extra = {}) =>
  checkout(ctx, { cart: c, paymentMethod: 'cash', ...extra });

describe('discounts', () => {
  beforeEach(() => ctx.setActor(EMPLOYEE));

  it('lets an employee give up to each limit, exactly at it', () => {
    const { saleId } = sell(cart([ring, 1, 90_000], [chain, 1, 45_000]));
    expect(getSale(ctx, saleId)).toMatchObject({ discount: 15_000, approvedBy: null });
  });

  it('needs the owner past the per-piece limit, even by one dirham', () => {
    expect(() => sell(cart([ring, 1, 89_999]), { discountReason: 'زبون دائم' })).toThrow(
      ApprovalNeeded,
    );
  });

  it('needs the owner past the per-sale limit', () => {
    // 5 pieces at 4 off each: no piece over 10, the sale 20 over 15.
    expect(() => sell(cart([chain, 5, 46_000]), { discountReason: 'عرض' })).toThrow('خصم البيعة');
  });

  it('asks for the reason first, then the approval, and records both', () => {
    const c = cart([ring, 1, 80_000]);
    expect(() => sell(c)).toThrow('سبب الخصم');
    approve('discount');
    const { saleId } = sell(c, { discountReason: 'زبون دائم', approval: 't1' });
    expect(getSale(ctx, saleId)).toMatchObject({
      discount: 20_000,
      discountReason: 'زبون دائم',
      approvedBy: 'owner',
    });
    expect(listActivity(ctxAsOwner(), {}, { limit: 1 })[0].summary).toContain('بموافقة المالك');
  });

  it('uses an approval once, and only for discounts', () => {
    const c = cart([ring, 1, 80_000]);
    approve('return');
    expect(() => sell(c, { discountReason: 'عرض', approval: 't1' })).toThrow(ApprovalNeeded);
    approve('discount');
    sell(c, { discountReason: 'عرض', approval: 't1' });
    expect(() => sell(cart([ring, 1, 80_000]), { discountReason: 'عرض', approval: 't1' })).toThrow(
      ApprovalNeeded,
    );
  });

  it('never counts a set’s own price or a price above the list', () => {
    const { saleId } = sell(cart([ring, 1, 120_000]));
    expect(getSale(ctx, saleId)!.discount).toBe(0);
  });

  it('lets the owner give any discount', () => {
    ctx.setActor(OWNER);
    const { saleId } = sell(cart([ring, 1, 10_000]));
    expect(getSale(ctx, saleId)).toMatchObject({ discount: 90_000, approvedBy: null });
  });
});

function ctxAsOwner() {
  ctx.setActor(OWNER);
  return ctx;
}

describe('returns', () => {
  let line: number;
  let soldAt: Date;
  beforeEach(() => {
    soldAt = ctx.now();
    const { saleId } = sell(cart([ring, 2]));
    line = getSale(ctx, saleId)!.lines[0].id;
    ctx.setActor(EMPLOYEE);
  });
  const later = (hours: number) => ctx.setNow(new Date(soldAt.getTime() + hours * 3_600_000));
  const ret = (extra = {}) =>
    addReturn(ctx, { ...passing(ctx), saleLineId: line, quantity: 1, ...extra });

  it('takes a return at 1 hour, and exactly at 24, refunding what the customer paid', () => {
    later(1);
    expect(getReturn(ctx, ret())).toMatchObject({ refund: 100_000, photo: 'piece.jpg' });
    later(24);
    expect(getReturn(ctx, ret())).toMatchObject({ byName: 'سارة' });
  });

  it('refuses at 25 hours, with no way around it for an employee', () => {
    later(25);
    expect(() => ret()).toThrow(ReturnRefused);
    expect(() => ret({ override: { reason: 'زبون دائم' } })).toThrow('أكثر من 24 ساعة');
  });

  it('refuses when any condition is not "yes"', () => {
    const answers = { ...passing(ctx).answers, 'القطعة لم تُلبس': false };
    expect(() => ret({ answers })).toThrow('لم يتحقق الشرط: القطعة لم تُلبس');
    expect(() => ret({ answers: {} })).toThrow(ReturnRefused);
  });

  it('needs a photo of the piece', () => {
    expect(() => ret({ photo: undefined })).toThrow('صوّر القطعة');
    ctx.setActor(OWNER);
    expect(() => ret({ photo: ' ' })).toThrow('صوّر القطعة');
  });

  it('never lets an employee change the refund', () => {
    expect(() => ret({ refund: 90_000 })).toThrow('لا يغيّره إلا المالك');
    ctx.setActor(OWNER);
    expect(getReturn(ctx, ret({ refund: 90_000 }))!.refund).toBe(90_000);
  });

  it('lets the owner allow it past the rules, with a reason, logged', () => {
    later(30);
    ctx.setActor(OWNER);
    expect(() => ret()).toThrow(ReturnRefused);
    const id = ret({ override: { reason: 'زبون دائم' } });
    expect(getReturn(ctx, id)).toMatchObject({ overrideReason: 'زبون دائم' });
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toContain('بموافقة المالك: زبون دائم');
  });

  it('lets the owner approve it on the employee’s screen, once', () => {
    later(30);
    approve('return');
    const id = ret({ override: { reason: 'هدية', approval: 't1' } });
    expect(getReturn(ctx, id)!.overrideReason).toBe('هدية');
    expect(() => ret({ override: { reason: 'هدية', approval: 't1' } })).toThrow(ReturnRefused);
  });

  it('lowers the customer’s debt on a credit sale', () => {
    ctx.setActor(OWNER);
    const { saleId } = checkout(ctx, {
      cart: cart([chain, 1]),
      paymentMethod: 'credit',
      customer: { name: 'منى', phone: '0912345678' },
    });
    const sale = getSale(ctx, saleId)!;
    expect(balance(ctx, sale.customerId!)).toBe(50_000);
    ctx.setActor(EMPLOYEE);
    addReturn(ctx, { ...passing(ctx), saleLineId: sale.lines[0].id, quantity: 1 });
    expect(balance(ctx, sale.customerId!)).toBe(0);
  });

  it('keeps returns without a sale for the owner', () => {
    expect(() =>
      addReturnWithoutSale(ctx, { productId: ring, quantity: 1, refund: 1, photo: 'p.jpg' }),
    ).toThrow(PermissionError);
  });

  it('finds the sale by its number or its receipt number, whoever sold it', () => {
    const sale = getSale(ctxAsOwner(), getReturnableSaleId())!;
    ctx.setActor(EMPLOYEE);
    expect(findSaleForReturn(ctx, String(sale.id))?.lines[0]).toMatchObject({ name: 'خاتم' });
    const byReceipt = findSaleForReturn(ctx, findSaleForReturn(ctx, String(sale.id))!.receiptNo!);
    expect(byReceipt?.saleId).toBe(sale.id);
    expect(findSaleForReturn(ctx, '999')).toBeUndefined();
    // Never the cost.
    expect(JSON.stringify(byReceipt)).not.toContain('cost');
  });

  function getReturnableSaleId() {
    return ctx.db.get<{ id: number }>('SELECT id FROM sales ORDER BY id LIMIT 1')!.id;
  }
});

describe('exchanges', () => {
  let line: number;
  beforeEach(() => {
    const { saleId } = sell(cart([ring, 1]));
    line = getSale(ctx, saleId)!.lines[0].id;
    ctx.setActor(EMPLOYEE);
  });

  it('returns one piece and sells another in one step, with the difference', () => {
    const r = exchange(ctx, {
      ret: { ...passing(ctx), saleLineId: line, quantity: 1 },
      sale: { cart: cart([chain, 1]), paymentMethod: 'cash' },
    });
    expect(r).toMatchObject({ refund: 100_000, total: 50_000, difference: -50_000 });
    expect(getReturn(ctx, r.returnId)!.exchangeSaleId).toBe(r.saleId);
    expect(getProduct(ctx, ring)!.stock).toBe(10);
  });

  it('saves nothing when either half is refused', () => {
    const before = getProduct(ctx, ring)!.stock;
    expect(() =>
      exchange(ctx, {
        ret: { ...passing(ctx), saleLineId: line, quantity: 1 },
        sale: { cart: cart([chain, 1, 1_000]), paymentMethod: 'cash' },
      }),
    ).toThrow(ApprovalNeeded);
    expect(getProduct(ctx, ring)!.stock).toBe(before);
    expect(getSale(ctxAsOwner(), 2)).toBeUndefined();
  });
});

describe('the employee’s account', () => {
  let ret: number;
  const SARA = { key: 'emp-e1', name: 'سارة' };
  beforeEach(() => {
    const { saleId } = sell(cart([ring, 1]));
    ret = addReturn(ctx, {
      ...passing(ctx),
      saleLineId: getSale(ctx, saleId)!.lines[0].id,
      quantity: 1,
    });
  });

  it('charges a return to an employee, then waives it', () => {
    chargeReturn(ctx, ret, SARA);
    expect(() => chargeReturn(ctx, ret, SARA)).toThrow('بالفعل');
    expect(ledgerBalances(ctx).get('emp-e1')).toBe(100_000);
    waiveCharge(ctx, ret, 'خطأ في الفحص');
    expect(returnCharge(ctx, ret)).toBeUndefined();
    expect(ledgerBalances(ctx).get('emp-e1')).toBe(0);
    // Charged again after the waive: a new line.
    chargeReturn(ctx, ret, SARA);
    expect(employeeStatement(ctx, 'emp-e1').lines.map((l) => [l.kind, l.balance])).toEqual([
      ['charge', 100_000],
      ['waive', 0],
      ['charge', 100_000],
    ]);
  });

  it('records repayments, and lets each employee read only their own statement', () => {
    chargeReturn(ctx, ret, SARA);
    recordRepayment(ctx, SARA, 40_000);
    expect(employeeStatement(ctx, 'emp-e1').balance).toBe(60_000);
    ctx.setActor(EMPLOYEE);
    expect(employeeStatement(ctx, 'emp-e1').balance).toBe(60_000);
    expect(() => employeeStatement(ctx, 'emp-e2')).toThrow(PermissionError);
    expect(() => ledgerBalances(ctx)).toThrow(PermissionError);
    expect(() => recordRepayment(ctx, SARA, 1)).toThrow(PermissionError);
  });

  it('refuses a repayment of nothing', () => {
    expect(() => recordRepayment(ctx, SARA, 0)).toThrow(RuleError);
  });
});

describe('the owner’s rules', () => {
  it('starts with no discount without approval and 24 hours', () => {
    const fresh = makeCtx('scarves');
    expect(getPolicies(fresh)).toMatchObject({
      discountPerPiece: 0,
      discountPerSale: 0,
      returnHours: 24,
      returnConditions: ['لم يُلبس', 'لم يُغسل', 'بدون رائحة عطر', 'في تغليفه الأصلي'],
    });
    fresh.close();
  });

  it('logs what changed, and refuses wrong values', () => {
    setPolicies(ctx, { returnHours: 48, returnConditions: ['  القطعة   سليمة ', ''] });
    expect(getPolicies(ctx)).toMatchObject({ returnHours: 48, returnConditions: ['القطعة سليمة'] });
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toBe(
      'مدة الإرجاع 48 ساعة؛ شروط الإرجاع: القطعة سليمة',
    );
    expect(() => setPolicies(ctx, { returnHours: 0 })).toThrow('مدة الإرجاع');
    expect(() => setPolicies(ctx, { discountPerPiece: -1 })).toThrow('حد الخصم');
    expect(() => setPolicies(ctx, { returnConditions: [] })).toThrow('شرطاً');
    ctx.setActor(EMPLOYEE);
    expect(() => setPolicies(ctx, { returnHours: 72 })).toThrow(PermissionError);
  });
});
