/**
 * @jest-environment node
 *
 * Phase L: the staff target, the ranking, the bonus on slow pieces and the owner's monthly report.
 */
import { OWNER, type Actor } from '@/staff/model';

import { addToCart } from './cart';
import { checkout } from './checkout';
import { PermissionError } from './context';
import { getProduct, saveProduct } from './products';
import { addReturn, getSale } from './sales';
import { employeeStatement, payEmployee } from './staff-ledger';
import {
  bonusesToCredit,
  bonusPieces,
  creditBonuses,
  getGoals,
  myGoal,
  setGoals,
  setProductBonus,
  staffReport,
} from './staff-goals';
import { EMPLOYEE, makeCtx, passing, type TestCtx } from './testing/ctx';

const ALI: Actor = { kind: 'employee', id: 'e2', name: 'علي' };
const people = [
  { key: 'emp-e1', name: 'سارة' },
  { key: 'emp-e2', name: 'علي' },
  { key: 'emp-e3', name: 'هدى' },
];

let ctx: TestCtx;
let ring: number;
let chain: number;
beforeEach(() => {
  // 10 November 2026: 21 days left in the month, today included.
  ctx = makeCtx('jewelry', new Date(2026, 10, 10, 10));
  ring = saveProduct(ctx, {
    name: 'خاتم',
    category: 'خواتم',
    price: 300_000,
    cost: 100_000,
    stock: 20,
  });
  chain = saveProduct(ctx, {
    name: 'سلسلة',
    category: 'قلادات',
    price: 200_000,
    cost: 80_000,
    stock: 20,
  });
});
afterEach(() => ctx.close());

function sell(as: Actor, id: number, qty = 1, customer?: { name: string; phone: string }) {
  ctx.setActor(as);
  const r = addToCart([], getProduct(ctx, id)!, 'قطعة', qty);
  if ('problem' in r) throw new Error('cart');
  const { saleId } = checkout(ctx, { cart: r.cart, paymentMethod: 'cash', customer });
  ctx.setActor(OWNER);
  return saleId;
}

function returnOne(saleId: number) {
  ctx.setActor(OWNER);
  const line = getSale(ctx, saleId)!.lines[0];
  // A late return: the owner accepts it with a reason.
  return addReturn(ctx, {
    ...passing(ctx),
    saleLineId: line.id,
    quantity: 1,
    override: { reason: 'قبول المالك' },
  });
}

describe('the monthly target and the ranking', () => {
  it('counts an employee’s sales less their returns, with what a day needs', () => {
    setGoals(ctx, { target: 1_000_000 });
    const a = sell(EMPLOYEE, ring, 2);
    sell(EMPLOYEE, chain);
    returnOne(a);
    ctx.setActor(EMPLOYEE);
    const g = myGoal(ctx, people)!;
    // 600 + 200 sold, 300 returned: 500 of 1000.
    expect(g).toMatchObject({ target: 1_000_000, net: 500_000, percent: 50, left: 500_000 });
    expect(g).toMatchObject({ daysLeft: 21, perDay: Math.ceil(500_000 / 21), reached: false });
  });

  it('ranks by % of the target, with no one else’s amounts, best seller first', () => {
    setGoals(ctx, { target: 1_000_000 });
    sell(EMPLOYEE, chain);
    sell(ALI, ring, 3);
    ctx.setActor(EMPLOYEE);
    const g = myGoal(ctx, people)!;
    expect(g.ranking).toEqual([
      { key: 'emp-e2', name: 'علي', percent: 90, best: true },
      { key: 'emp-e1', name: 'سارة', percent: 20, best: false },
      { key: 'emp-e3', name: 'هدى', percent: 0, best: false },
    ]);
    expect(g).toMatchObject({ place: 2, of: 3 });
    expect(JSON.stringify(g.ranking)).not.toContain('900');
    // The owner sells too, but is not in the ranking, and has no goal of their own.
    sell(OWNER, ring, 5);
    ctx.setActor(EMPLOYEE);
    expect(myGoal(ctx, people)!.ranking.map((r) => r.key)).not.toContain('owner');
    ctx.setActor(OWNER);
    expect(myGoal(ctx, people)).toBeNull();
  });

  it('marks the target reached, and with no target shows the order only', () => {
    setGoals(ctx, { target: 500_000 });
    sell(EMPLOYEE, ring, 2);
    ctx.setActor(EMPLOYEE);
    expect(myGoal(ctx, people)).toMatchObject({ reached: true, percent: 120, left: 0, perDay: 0 });
    ctx.setActor(OWNER);
    setGoals(ctx, { target: 0 });
    ctx.setActor(EMPLOYEE);
    expect(myGoal(ctx, people)).toMatchObject({ reached: false, percent: 0, place: 1 });
  });

  it('is the owner’s to set', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => setGoals(ctx, { target: 5 })).toThrow(PermissionError);
    ctx.setActor(OWNER);
    expect(() => setGoals(ctx, { target: -1 })).toThrow('الهدف');
    expect(getGoals(ctx)).toEqual({ target: 0, bonusDefault: 20_000 });
  });
});

describe('the bonus on slow pieces', () => {
  it('is earned by an employee at checkout, as it was then, never by the owner', () => {
    setProductBonus(ctx, ring, 20_000);
    const hers = sell(EMPLOYEE, ring, 2);
    const mine = sell(OWNER, ring);
    // Turning it off later doesn't take back what was earned.
    setProductBonus(ctx, ring, null);
    sell(EMPLOYEE, ring);
    const bonusOf = (saleId: number) =>
      ctx.db.get<{ b: number }>('SELECT bonus b FROM sale_lines WHERE sale_id = ?', [saleId])!.b;
    expect(bonusOf(hers)).toBe(20_000);
    expect(bonusOf(mine)).toBe(0);
    ctx.setActor(EMPLOYEE);
    expect(myGoal(ctx, people)!.bonus).toEqual({ earned: 40_000, returned: 0, net: 40_000 });
  });

  it('is taken back by a return, in the month of the return', () => {
    setProductBonus(ctx, ring, 20_000);
    const sale = sell(EMPLOYEE, ring, 2);
    ctx.setNow(new Date(2026, 11, 3, 10));
    returnOne(sale);
    ctx.setActor(EMPLOYEE);
    expect(myGoal(ctx, people)!.bonus).toEqual({ earned: 0, returned: 20_000, net: -20_000 });
    ctx.setActor(OWNER);
    expect(staffReport(ctx, '2026-11', people).rows[0]).toMatchObject({ bonus: 40_000 });
  });

  it('goes into the account once, after the month ends, and the owner pays it out', () => {
    setProductBonus(ctx, ring, 20_000);
    sell(EMPLOYEE, ring, 3);
    const ali = sell(ALI, ring);
    expect(() => creditBonuses(ctx, '2026-11', people)).toThrow('بعد نهايته');
    // December: Ali's November piece comes back, more than he earned in December.
    ctx.setNow(new Date(2026, 11, 2, 10));
    // The dashboard reminds the owner until last month's bonuses are added.
    expect(bonusesToCredit(ctx)).toBe(2);
    expect(creditBonuses(ctx, '2026-11', people)).toBe(2);
    expect(bonusesToCredit(ctx)).toBe(0);
    expect(creditBonuses(ctx, '2026-11', people)).toBe(0);
    returnOne(ali);
    ctx.setNow(new Date(2027, 0, 2, 10));
    expect(creditBonuses(ctx, '2026-12', people)).toBe(1);
    // Sara: the shop owes her 60 (a balance under 0); paid, nothing is left.
    expect(employeeStatement(ctx, 'emp-e1').balance).toBe(-60_000);
    payEmployee(ctx, { key: 'emp-e1', name: 'سارة' }, 60_000);
    expect(employeeStatement(ctx, 'emp-e1').balance).toBe(0);
    // Ali: 20 in November, 20 taken back in December.
    expect(employeeStatement(ctx, 'emp-e2').lines.map((l) => [l.kind, l.amount])).toEqual([
      ['bonus', 20_000],
      ['bonus_back', 20_000],
    ]);
    expect(employeeStatement(ctx, 'emp-e2').balance).toBe(0);
  });

  it('lists the pieces with a bonus, for the owner to see and turn off', () => {
    setProductBonus(ctx, chain, 15_000);
    setProductBonus(ctx, ring, 20_000);
    expect(bonusPieces(ctx)).toEqual([
      { productId: ring, name: 'خاتم', size: null, stock: 20, bonus: 20_000 },
      { productId: chain, name: 'سلسلة', size: null, stock: 20, bonus: 15_000 },
    ]);
    setProductBonus(ctx, ring, null);
    expect(bonusPieces(ctx).map((p) => p.productId)).toEqual([chain]);
    ctx.setActor(EMPLOYEE);
    expect(() => bonusPieces(ctx)).toThrow(PermissionError);
  });

  it('is the owner’s to put on a piece, and to add to the accounts', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => setProductBonus(ctx, ring, 20_000)).toThrow(PermissionError);
    ctx.setNow(new Date(2026, 11, 2, 10));
    expect(() => creditBonuses(ctx, '2026-11', people)).toThrow(PermissionError);
    ctx.setActor(OWNER);
    expect(() => setProductBonus(ctx, ring, 0)).toThrow('المكافأة');
  });
});

describe('the owner’s monthly staff report', () => {
  it('shows each person’s month, best first, with what is still to add to the accounts', () => {
    setGoals(ctx, { target: 1_000_000 });
    setProductBonus(ctx, chain, 15_000);
    sell(EMPLOYEE, chain, 1, { name: 'منى', phone: '0912345678' });
    sell(EMPLOYEE, ring);
    sell(ALI, ring, 3);
    const r = staffReport(ctx, '2026-11', people);
    expect(r.rows.map((x) => x.name)).toEqual(['علي', 'سارة', 'هدى']);
    expect(r.rows[1]).toMatchObject({
      sales: 2,
      total: 500_000,
      pieces: 2,
      average: 250_000,
      net: 500_000,
      percent: 50,
      newCustomers: 1,
      bonus: 15_000,
      credited: false,
    });
    expect(r.rows[0]).toMatchObject({ best: true, percent: 90 });
    expect(r).toMatchObject({ ended: false, toCredit: 1 });
    ctx.setActor(EMPLOYEE);
    expect(() => staffReport(ctx, '2026-11', people)).toThrow(PermissionError);
  });
});
