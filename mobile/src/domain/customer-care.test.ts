/**
 * Looking after customers (phase G3): birthdays this week, who hasn't come back, WhatsApp links,
 * wanted pieces and their reminder, duplicates and the merge, and the owner's report.
 */
import { OWNER } from '@/staff/model';
import { listActivity } from './activity';
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { PermissionError, RuleError } from './context';
import {
  addWanted,
  birthdayMessage,
  birthdaysThisWeek,
  customerReport,
  deleteWanted,
  duplicateCustomers,
  listWanted,
  mergeCustomers,
  notBack,
  setWantedDone,
  waLink,
  wantedMatches,
} from './customer-care';
import { getCustomer, listCustomers, saveCustomer } from './customers';
import { recordPayment } from './debts';
import { getProduct, saveProduct } from './products';
import { setRewards } from './rewards';
import { listSales } from './sales';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 100 });
});
afterEach(() => ctx.close());

const cart = (): CartLine[] =>
  (addToCart([], getProduct(ctx, ring)!, 'Ring', 1) as { cart: CartLine[] }).cart;
const sellTo = (name: string, phone?: string, method: 'cash' | 'credit' = 'cash') =>
  checkout(ctx, { cart: cart(), paymentMethod: method, customer: { name, phone } });

describe('WhatsApp', () => {
  it('links a Libyan number in international form, with the message', () => {
    expect(waLink('0912345678', 'مرحبا')).toBe(
      `https://wa.me/218912345678?text=${encodeURIComponent('مرحبا')}`,
    );
    expect(waLink('+218 92 111 2222', 'x')).toMatch(/^https:\/\/wa\.me\/218921112222\?/);
    expect(waLink('123', 'x')).toBeNull();
    expect(waLink(null, 'x')).toBeNull();
  });

  it('writes the birthday message with the gift', () => {
    expect(birthdayMessage({ name: 'هدى', gender: 'female' }, 'هدية مجانية')).toContain(
      'عزيزتنا هدى',
    );
    expect(birthdayMessage({ name: 'علي', gender: 'male' }, '')).not.toContain('هديتك');
  });
});

describe('birthdays and who hasn’t come back', () => {
  it('lists the birthdays of the next 7 days, today first', () => {
    // Today is 9 November.
    saveCustomer(ctx, { name: 'بعد', birthMonth: 11, birthDay: 12 });
    saveCustomer(ctx, { name: 'اليوم', birthMonth: 11, birthDay: 9 });
    saveCustomer(ctx, { name: 'بعيد', birthMonth: 12, birthDay: 1 });
    expect(birthdaysThisWeek(ctx).map((b) => [b.customer.name, b.days])).toEqual([
      ['اليوم', 0],
      ['بعد', 3],
    ]);
  });

  it('lists customers with no purchase in 90 days', () => {
    ctx.setNow(new Date(2026, 4, 1));
    sellTo('قديمة', '0911111111');
    sellTo('عائدة', '0922222222');
    ctx.setNow(new Date(2026, 9, 1));
    sellTo('عائدة', '0922222222');
    ctx.setNow(new Date(2026, 10, 9));
    expect(notBack(ctx).map((x) => x.customer.name)).toEqual(['قديمة']);
  });
});

describe('wanted pieces', () => {
  it('are added, found, deleted and logged', () => {
    const huda = saveCustomer(ctx, { name: 'هدى' });
    expect(() => addWanted(ctx, huda, '  ')).toThrow(RuleError);
    const id = addWanted(ctx, huda, 'سوار ذهب عيار 21');
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'wanted.add' });
    setWantedDone(ctx, id, true);
    expect(listWanted(ctx, huda)[0].doneAt).not.toBeNull();
    setWantedDone(ctx, id, false);
    deleteWanted(ctx, id);
    expect(listWanted(ctx, huda)).toEqual([]);
  });

  it('remind who wanted a matching new piece', () => {
    const huda = saveCustomer(ctx, { name: 'هدى' });
    addWanted(ctx, huda, 'سوار ذهب عيار 21');
    const done = addWanted(ctx, huda, 'سوار فضة');
    setWantedDone(ctx, done, true);
    expect(wantedMatches(ctx, { name: 'سوار ناعم', category: 'أساور' })).toHaveLength(1);
    expect(wantedMatches(ctx, { name: 'Ring', category: 'خواتم' })).toEqual([]);
  });

  it('employees may add them', () => {
    const huda = saveCustomer(ctx, { name: 'هدى' });
    ctx.setActor(EMPLOYEE);
    expect(addWanted(ctx, huda, 'خاتم')).toBeGreaterThan(0);
    ctx.setActor(OWNER);
  });
});

describe('duplicates and the merge', () => {
  it('finds the same name with two phones', () => {
    saveCustomer(ctx, { name: 'منى علي', phone: '0911111111' });
    saveCustomer(ctx, { name: 'منى  علي', phone: '0922222222' });
    saveCustomer(ctx, { name: 'سارة', phone: '0933333333' });
    expect(duplicateCustomers(ctx).map((g) => g.map((c) => c.phone))).toEqual([
      ['0911111111', '0922222222'],
    ]);
  });

  it('moves everything to the one kept, fills its details, and is the owner’s', () => {
    const keep = saveCustomer(ctx, { name: 'منى', phone: '0911111111', notes: 'أولى' });
    const drop = saveCustomer(ctx, {
      name: 'منى',
      phone: '0922222222',
      notes: 'ثانية',
      birthMonth: 3,
      birthDay: 14,
      offers: true,
    });
    sellTo('منى', '0922222222', 'credit');
    recordPayment(ctx, { customerId: drop, amount: 500_000, method: 'cash' });
    addWanted(ctx, drop, 'خاتم');
    ctx.setActor(EMPLOYEE);
    expect(() => mergeCustomers(ctx, keep, drop)).toThrow(PermissionError);
    ctx.setActor(OWNER);
    expect(() => mergeCustomers(ctx, keep, keep)).toThrow(RuleError);
    mergeCustomers(ctx, keep, drop);
    expect(getCustomer(ctx, drop)).toBeUndefined();
    expect(getCustomer(ctx, keep)).toMatchObject({
      phone: '0911111111',
      notes: 'أولى\nثانية',
      birthMonth: 3,
      birthDay: 14,
      offers: true,
    });
    expect(listSales(ctx, { customerId: keep })).toHaveLength(1);
    expect(listWanted(ctx, keep)).toHaveLength(1);
    expect(listCustomers(ctx)).toHaveLength(1);
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'customer.merge' });
  });

  it('takes the other’s phone when the one kept has none', () => {
    const keep = saveCustomer(ctx, { name: 'منى' });
    const drop = saveCustomer(ctx, { name: 'منى', phone: '0922222222' });
    mergeCustomers(ctx, keep, drop);
    expect(getCustomer(ctx, keep)?.phone).toBe('0922222222');
  });
});

describe('the owner’s report', () => {
  it('shows where customers come from, the top ones and who came back', () => {
    saveCustomer(ctx, { name: 'هدى', phone: '0911111111', heard: 'instagram' });
    saveCustomer(ctx, { name: 'منى', phone: '0922222222', heard: 'tiktok' });
    setRewards(ctx, { enabled: true });
    ctx.setNow(new Date(2026, 10, 1));
    sellTo('هدى', '0911111111');
    ctx.setNow(new Date(2026, 10, 2));
    sellTo('هدى', '0911111111');
    sellTo('منى', '0922222222');
    const r = customerReport(ctx);
    expect(r.bySource.find((s) => s.heard === 'instagram')).toEqual({
      heard: 'instagram',
      customers: 1,
      spent: 2_000_000,
    });
    expect(r.topMonth[0]).toMatchObject({ spent: 2_000_000 });
    expect(r.topMonth[0].customer.name).toBe('هدى');
    expect(r).toMatchObject({ buyers: 2, returning: 1, rewards: { count: 0, off: 0 } });
    ctx.setActor(EMPLOYEE);
    expect(() => customerReport(ctx)).toThrow(PermissionError);
    ctx.setActor(OWNER);
  });
});
