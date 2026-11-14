/**
 * Features 10 and 26 (phase F1): the quick percentage discount at checkout, through the same
 * limits, approval and log as any discount; and customers' phone numbers hidden from employees
 * unless the owner gives one of them the permission.
 */
import { EMPTY_STAFF, addEmployee, parseStaff, setGrant } from '@/staff/model';
import { can, setGrantsLookup } from '@/staff/permissions';

import { listActivity } from './activity';
import { addToCart, percentOff, type CartLine } from './cart';
import { ApprovalNeeded, checkout } from './checkout';
import { RuleError } from './context';
import {
  customerSuggestions,
  ensureCustomer,
  listCustomers,
  maskPhone,
  saveCustomer,
  shownName,
  shownPhone,
} from './customers';
import { getPolicies, setPolicies } from './policies';
import { getProduct, saveProduct } from './products';
import { getSale } from './sales';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
afterEach(() => ctx?.close());

describe('quick discount at checkout (feature 10)', () => {
  let ring: number;
  let granted: Set<string>;
  beforeEach(() => {
    ctx = makeCtx();
    granted = new Set();
    ctx.approvals = { take: (t, p) => granted.delete(`${p}:${t}`) };
    ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 250_000, stock: 5 });
  });
  const listed = (id: number) => getProduct(ctx, id)?.price;
  const cartOf = (qty: number): CartLine[] => {
    const p = getProduct(ctx, ring)!;
    return (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  };

  it('starts at 3%, and the owner changes the percentages (logged)', () => {
    expect(getPolicies(ctx).quickDiscounts).toEqual([3]);
    setPolicies(ctx, { quickDiscounts: [5, 3, 5] });
    expect(getPolicies(ctx).quickDiscounts).toEqual([3, 5]);
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toContain('الخصم السريع: 3%، 5%');
    setPolicies(ctx, { quickDiscounts: [] });
    expect(listActivity(ctx, {}, { limit: 1 })[0].summary).toContain('الخصم السريع متوقف');
    expect(() => setPolicies(ctx, { quickDiscounts: [0] })).toThrow(RuleError);
    expect(() => setPolicies(ctx, { quickDiscounts: [2.5] })).toThrow(RuleError);
    expect(() => setPolicies(ctx, { quickDiscounts: [1, 2, 3, 4, 5] })).toThrow(RuleError);
  });

  it('sells at 3% off rounded down to a whole dinar, for the owner', () => {
    const { cart, total } = percentOff(cartOf(1), listed, 3);
    expect(total).toBe(7_000); // 7.5 → 7
    const { saleId } = checkout(ctx, { cart, paymentMethod: 'cash' });
    expect(getSale(ctx, saleId)).toMatchObject({ total: 243_000, discount: 7_000 });
  });

  it('needs the owner for an employee past the limits, like a typed discount', () => {
    ctx.setActor(EMPLOYEE);
    const { cart } = percentOff(cartOf(1), listed, 3);
    expect(() => checkout(ctx, { cart, paymentMethod: 'cash', discountReason: 'عرض' })).toThrow(
      ApprovalNeeded,
    );
    granted.add('discount:t1');
    const { saleId } = checkout(ctx, {
      cart,
      paymentMethod: 'cash',
      discountReason: 'عرض',
      approval: 't1',
    });
    expect(getSale(ctx, saleId)).toMatchObject({ discount: 7_000, approvedBy: 'owner' });
  });

  it('goes through for an employee within the limits', () => {
    setPolicies(ctx, { discountPerPiece: 10_000, discountPerSale: 20_000 });
    ctx.setActor(EMPLOYEE);
    const { cart } = percentOff(cartOf(2), listed, 3);
    const { saleId } = checkout(ctx, { cart, paymentMethod: 'cash' });
    // 3% of 500 is 15, but 15 dinars can't be split evenly over 2 pieces of one line: each
    // piece takes 7 (whole dinars, never more than the percentage).
    expect(getSale(ctx, saleId)).toMatchObject({ discount: 14_000, approvedBy: null });
  });
});

describe('customer phones hidden from employees (feature 26)', () => {
  beforeEach(() => {
    ctx = makeCtx();
    saveCustomer(ctx, { name: 'منى', phone: '0912345678' });
    saveCustomer(ctx, { name: 'سعاد', phone: '0923456789' });
    ensureCustomer(ctx, undefined, '0945678901');
  });

  it('masks a number as its first 3 and last 4 digits', () => {
    expect(maskPhone('0912345678')).toBe('091•••5678');
    expect(maskPhone('+218 91 234 5678')).toBe('218•••5678');
    expect(maskPhone('١٢٣٤٥')).toBe('•••45');
    expect(maskPhone(null)).toBeNull();
    expect(shownPhone('0912345678', true)).toBe('0912345678');
    expect(shownPhone('0912345678', false)).toBe('091•••5678');
    expect(shownName('زبون 0945678901', false)).toBe('زبون 094•••8901');
    expect(shownName('زبون 0945678901', true)).toBe('زبون 0945678901');
  });

  it('finds a customer by part of a number only for those who see the numbers', () => {
    const names = (full: boolean, q: string) => listCustomers(ctx, q, full).map((c) => c.name);
    expect(names(true, '091')).toEqual(['منى']);
    expect(names(true, '09')).toHaveLength(3);
    expect(names(false, '091')).toEqual([]);
    // Not through the name of a customer added from a sale by phone either.
    expect(names(false, '0945')).toEqual([]);
    expect(names(false, '0912345678')).toEqual(['منى']);
    expect(names(false, '+218912345678')).toEqual(['منى']);
    expect(names(false, 'سعاد')).toEqual(['سعاد']);
  });

  it('suggests at checkout by the whole number only, for an employee', () => {
    expect(customerSuggestions(ctx, '0912', 4, true).map((c) => c.name)).toEqual(['منى']);
    expect(customerSuggestions(ctx, '0912', 4, false)).toEqual([]);
    expect(customerSuggestions(ctx, '0912345678', 4, false).map((c) => c.name)).toEqual(['منى']);
    expect(customerSuggestions(ctx, 'من', 4, false).map((c) => c.name)).toEqual(['منى']);
  });

  it('is the owner’s, and the owner can give it to one employee', () => {
    let staff = addEmployee(EMPTY_STAFF, 'سارة', 'e1', new Date());
    staff = addEmployee(staff, 'هدى', 'e2', new Date());
    setGrantsLookup((id) => staff.employees.find((e) => e.id === id)?.grants ?? []);
    const hoda = { kind: 'employee' as const, id: 'e2', name: 'هدى' };
    expect(can({ kind: 'owner' }, 'customers.phones')).toBe(true);
    expect(can(EMPLOYEE, 'customers.phones')).toBe(false);
    staff = setGrant(staff, 'e1', 'customers.phones', true);
    expect(can(EMPLOYEE, 'customers.phones')).toBe(true);
    expect(can(hoda, 'customers.phones')).toBe(false);
    // Only what can be given is kept: nothing else comes in through a saved list.
    staff = setGrant(staff, 'e1', 'sales.delete', true);
    expect(can(EMPLOYEE, 'sales.delete')).toBe(false);
    const read = parseStaff(
      JSON.stringify({
        ...staff,
        employees: staff.employees.map((e) => ({
          ...e,
          grants: ['customers.phones', 'sales.delete'],
        })),
      }),
    );
    expect(read.employees[0].grants).toEqual(['customers.phones']);
    staff = setGrant(staff, 'e1', 'customers.phones', false);
    expect(can(EMPLOYEE, 'customers.phones')).toBe(false);
    setGrantsLookup(() => []);
  });
});
