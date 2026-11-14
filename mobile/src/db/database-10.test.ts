/**
 * @jest-environment node
 *
 * Database 10 (phase G1): the customer's optional details (birthday, how they heard, ring size,
 * metal, colours, offers), the owner's VIP choice, the reward taken off a sale and its receipt
 * (used by G2), the receipt footer, and the wanted pieces list (G3).
 */
import { checksumOf, exportBackup, restoreBackup } from '@/domain/backup';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import {
  AUTO_NOTE,
  birthdayText,
  ensureCustomer,
  getCustomer,
  listCustomers,
  saveCustomer,
  setVip,
  validBirthday,
} from '@/domain/customers';
import {
  birthdayNote,
  customerSales,
  customerStats,
  daysToBirthday,
  isVip,
  sinceText,
  spendingByCustomer,
} from '@/domain/customer-stats';
import { listActivity } from '@/domain/activity';
import { exchange } from '@/domain/exchange';
import { getPolicies } from '@/domain/policies';
import { getProduct, saveProduct } from '@/domain/products';
import { DEFAULT_REWARDS, REWARDS_KEY, spendRange } from '@/domain/rewards';
import { addReturn, getSale } from '@/domain/sales';
import { setSetting } from '@/domain/settings';
import { PermissionError, RuleError } from '@/domain/context';
import { EMPLOYEE, makeCtx, type TestCtx } from '@/domain/testing/ctx';

import { migrate, schemaVersion } from './migrate';
import { migrations } from './schema';
import { openMemoryDb } from './testing/node-db';

describe('the upgrade from database 9', () => {
  it('keeps every row, adds the new columns empty and the wanted pieces table', () => {
    const db = openMemoryDb();
    migrate(db, migrations.slice(0, 9));
    expect(schemaVersion(db)).toBe(9);
    db.run(
      "INSERT INTO customers (name, name_key, phone, phone_key, created_at) VALUES ('هدى', 'هدى', '0912222222', '912222222', '2026-11-01')",
    );
    const before = db.all('SELECT * FROM customers');
    migrate(db, migrations.slice(0, 10));
    expect(schemaVersion(db)).toBe(10);
    expect(db.all('SELECT * FROM customers')).toEqual(
      before.map((c) => ({
        ...(c as object),
        birth_month: null,
        birth_day: null,
        heard: null,
        ring_size: null,
        metal: null,
        colours: null,
        offers: 0,
        vip: null,
      })),
    );
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
    // Only real values get in.
    expect(() => db.run('UPDATE customers SET birth_month = 13')).toThrow(/CHECK/);
    expect(() => db.run('UPDATE customers SET birth_day = 0')).toThrow(/CHECK/);
    expect(() => db.run("UPDATE customers SET heard = 'radio'")).toThrow(/CHECK/);
    expect(() => db.run("UPDATE customers SET vip = 'maybe'")).toThrow(/CHECK/);
    expect(() => db.run('UPDATE customers SET offers = 2')).toThrow(/CHECK/);
    db.run(
      "INSERT INTO wanted_pieces (customer_id, text, created_at, month) VALUES (1, 'خاتم ذهب', 'x', 'x')",
    );
    expect(db.get<{ uid: string }>('SELECT uid FROM wanted_pieces')?.uid).toMatch(/^[0-9a-f]{32}$/);
    // A wanted piece goes with its customer.
    db.run('DELETE FROM customers');
    expect(db.all('SELECT * FROM wanted_pieces')).toEqual([]);
    db.close();
  });
});

let ctx: TestCtx;
let ring: number;
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 50 });
});
afterEach(() => ctx.close());

const cart = (price = 1_000_000, qty = 1): CartLine[] => {
  const p = getProduct(ctx, ring)!;
  if (p.price !== price) saveProduct(ctx, { ...p, id: ring, brand: p.brand, price });
  return (addToCart([], getProduct(ctx, ring)!, 'Ring', qty) as { cart: CartLine[] }).cart;
};
const sell = (price = 1_000_000, qty = 1, phone = '0912345678') =>
  checkout(ctx, {
    cart: cart(price, qty),
    paymentMethod: 'cash',
    customer: { name: 'هدى', phone },
  });
const answers = () => Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true]));
const returnOne = (saleId: number, quantity = 1) => {
  const line = getSale(ctx, saleId)!.lines[0];
  return addReturn(ctx, { saleLineId: line.id, quantity, photo: 'p.jpg', answers: answers() });
};
const day = (d: number, h = 10) => ctx.setNow(new Date(2026, 10, d, h, 0, 0));

describe('the customer details', () => {
  it('saves them, tidied, and keeps them on an edit that leaves them out', () => {
    const id = saveCustomer(ctx, {
      name: 'هدى',
      birthMonth: 3,
      birthDay: 14,
      heard: 'instagram',
      ringSize: ' ١٦ ',
      metal: 'ذهب',
      offers: true,
    });
    expect(getCustomer(ctx, id)).toMatchObject({
      birthMonth: 3,
      birthDay: 14,
      heard: 'instagram',
      ringSize: '16',
      metal: 'ذهب',
      colours: null,
      offers: true,
      vip: null,
    });
    saveCustomer(ctx, { id, name: 'هدى علي' });
    expect(getCustomer(ctx, id)).toMatchObject({ name: 'هدى علي', birthDay: 14, offers: true });
    saveCustomer(ctx, { id, name: 'هدى علي', birthMonth: null, birthDay: null, offers: false });
    expect(getCustomer(ctx, id)).toMatchObject({ birthMonth: null, birthDay: null, offers: false });
    expect(birthdayText(3, 14)).toBe('14 مارس');
  });

  it('refuses an impossible or half birthday and too long a text', () => {
    expect(() => saveCustomer(ctx, { name: 'هدى', birthMonth: 2, birthDay: 30 })).toThrow(
      RuleError,
    );
    expect(() => saveCustomer(ctx, { name: 'هدى', birthMonth: 4 })).toThrow(RuleError);
    expect(() => saveCustomer(ctx, { name: 'هدى', ringSize: '12345678901' })).toThrow(RuleError);
    expect(validBirthday(2, 29)).toEqual({ month: 2, day: 29 });
    expect(validBirthday(4, 31)).toBeNull();
    expect(listCustomers(ctx)).toEqual([]);
  });

  it('at checkout fills only what the customer does not have yet', () => {
    checkout(ctx, {
      cart: cart(),
      paymentMethod: 'cash',
      customer: {
        name: 'منى',
        phone: '0920000000',
        details: {
          gender: 'female',
          birthMonth: 5,
          birthDay: 2,
          heard: 'tiktok',
          notes: 'تحب الذهب',
        },
      },
    });
    const [mona] = listCustomers(ctx);
    expect(mona).toMatchObject({
      gender: 'female',
      birthMonth: 5,
      birthDay: 2,
      heard: 'tiktok',
      notes: 'تحب الذهب',
    });
    // A second sale's details never overwrite what is saved; empty fields are filled.
    ensureCustomer(ctx, 'منى', '0920000000', undefined, {
      gender: 'male',
      birthMonth: 6,
      birthDay: 6,
      heard: 'facebook',
      ringSize: '17',
      notes: 'ملاحظة أخرى',
      offers: true,
    });
    expect(getCustomer(ctx, mona.id)).toMatchObject({
      gender: 'female',
      birthMonth: 5,
      heard: 'tiktok',
      ringSize: '17',
      notes: 'تحب الذهب',
      offers: true,
    });
  });

  it('a new customer from a sale keeps the automatic note until a note is typed', () => {
    const id = ensureCustomer(ctx, 'سلمى', '0930000000')!;
    expect(getCustomer(ctx, id)?.notes).toBe(AUTO_NOTE);
    ensureCustomer(ctx, 'سلمى', '0930000000', undefined, { notes: 'زبونة من بنغازي' });
    expect(getCustomer(ctx, id)?.notes).toBe('زبونة من بنغازي');
  });

  it('a bad birthday at checkout sells nothing', () => {
    expect(() =>
      checkout(ctx, {
        cart: cart(),
        paymentMethod: 'cash',
        customer: { name: 'منى', details: { birthMonth: 2, birthDay: 31 } },
      }),
    ).toThrow(RuleError);
    expect(getProduct(ctx, ring)?.stock).toBe(50);
    expect(listCustomers(ctx)).toEqual([]);
  });
});

describe('VIP by hand', () => {
  it('is the owner’s, logged, and refused to an employee', () => {
    const id = saveCustomer(ctx, { name: 'هدى' });
    setVip(ctx, id, 'always');
    expect(getCustomer(ctx, id)?.vip).toBe('always');
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'customer.vip' });
    ctx.setActor(EMPLOYEE);
    expect(() => setVip(ctx, id, null)).toThrow(PermissionError);
    ctx.setActor(null);
  });

  it('the choice comes first, else the spending in the window', () => {
    expect(isVip('always', 0, DEFAULT_REWARDS)).toBe(true);
    expect(isVip('never', 99_000_000, DEFAULT_REWARDS)).toBe(false);
    expect(isVip(null, 5_000_000, DEFAULT_REWARDS)).toBe(false);
    expect(isVip(null, 5_000_001, DEFAULT_REWARDS)).toBe(true);
  });
});

describe('the customer card numbers', () => {
  it('counts visits by day, spending less returns, and the last purchases', () => {
    day(1);
    const first = sell(1_000_000).saleId;
    day(1, 15);
    sell(500_000);
    day(5);
    const third = sell(2_000_000).saleId;
    returnOne(third);
    const huda = listCustomers(ctx)[0].id;
    day(9);
    const s = customerStats(ctx, huda);
    // The 5th was returned whole: no visit, no spending.
    expect(s.visits).toBe(1);
    expect(s.spent).toBe(1_500_000);
    expect(s.badge).toBe('new');
    expect(s.lastVisit?.slice(0, 10)).toBe('2026-11-01');
    expect(s.lastPurchases.map((p) => p.pieces)).toEqual(['Ring', 'Ring']);
    expect(customerSales(ctx, huda).find((x) => x.id === first)?.fullyReturned).toBe(false);
    day(10);
    sell(600_000);
    expect(customerStats(ctx, huda)).toMatchObject({ visits: 2, badge: 'returning' });
  });

  it('a part return lowers the spending by the piece’s share', () => {
    const { saleId } = sell(1_000_000, 2);
    returnOne(saleId, 1);
    const huda = listCustomers(ctx)[0].id;
    expect(customerStats(ctx, huda)).toMatchObject({ visits: 1, spent: 1_000_000 });
    expect(spendingByCustomer(ctx).get(huda)).toEqual({ spent: 1_000_000, inWindow: 1_000_000 });
  });

  it('an exchange is money spent but not a new visit', () => {
    day(1);
    const { saleId } = sell(1_000_000);
    day(1, 16);
    const line = getSale(ctx, saleId)!.lines[0];
    exchange(ctx, {
      ret: { saleLineId: line.id, quantity: 1, photo: 'p.jpg', answers: answers() },
      sale: { cart: cart(1_200_000), paymentMethod: 'cash', customer: { phone: '0912345678' } },
    });
    const huda = listCustomers(ctx)[0].id;
    // The first sale was returned whole (exchanged), the new sale is an exchange: no visit.
    expect(customerStats(ctx, huda)).toMatchObject({ visits: 0, spent: 1_200_000 });
  });

  it('is VIP over 5,000 د.ل in the last 12 months only', () => {
    ctx.setNow(new Date(2025, 9, 1));
    sell(3_000_000);
    ctx.setNow(new Date(2026, 9, 1));
    sell(3_000_000);
    const huda = listCustomers(ctx)[0].id;
    ctx.setNow(new Date(2026, 9, 15));
    expect(customerStats(ctx, huda)).toMatchObject({ vip: false, spent: 6_000_000 });
    expect(spendingByCustomer(ctx).get(huda)).toEqual({ spent: 6_000_000, inWindow: 3_000_000 });
    sell(2_500_000);
    expect(customerStats(ctx, huda)).toMatchObject({ vip: true, badge: 'vip' });
    setVip(ctx, huda, 'never');
    expect(customerStats(ctx, huda).vip).toBe(false);
  });

  it('follows the owner’s VIP rule from the settings', () => {
    sell(2_000_000);
    const huda = listCustomers(ctx)[0].id;
    setSetting(ctx, REWARDS_KEY, JSON.stringify({ vipSpend: 1_000_000 }));
    expect(customerStats(ctx, huda).vip).toBe(true);
  });

  it('shows an employee a range, never the total', () => {
    const r = DEFAULT_REWARDS.ranges;
    expect(spendRange(0, r)).toBe('لا مشتريات');
    expect(spendRange(300_000, r)).toBe('أقل من 500 د.ل');
    expect(spendRange(2_400_000, r)).toBe('أكثر من 2,000 د.ل');
    expect(spendRange(50_000_000, r)).toBe('أكثر من 10,000 د.ل');
  });
});

describe('birthdays and dates', () => {
  it('counts the days to the next birthday, 29 February on the 28th', () => {
    const now = new Date(2026, 10, 9);
    expect(daysToBirthday({ birthMonth: 11, birthDay: 9 }, now)).toBe(0);
    expect(daysToBirthday({ birthMonth: 11, birthDay: 12 }, now)).toBe(3);
    expect(daysToBirthday({ birthMonth: 11, birthDay: 8 }, now)).toBe(364);
    expect(daysToBirthday({ birthMonth: 2, birthDay: 29 }, new Date(2027, 1, 27))).toBe(1);
    expect(daysToBirthday({ birthMonth: null, birthDay: null }, now)).toBeNull();
  });

  it('notes a birthday within the week', () => {
    const id = saveCustomer(ctx, { name: 'هدى', gender: 'female', birthMonth: 11, birthDay: 11 });
    const huda = getCustomer(ctx, id)!;
    expect(birthdayNote(huda, new Date(2026, 10, 9))).toBe('عيد ميلادها بعد يومين 🎂');
    expect(birthdayNote(huda, new Date(2026, 10, 11))).toBe('عيد ميلادها اليوم 🎂');
    expect(birthdayNote(huda, new Date(2026, 10, 1))).toBeNull();
  });

  it('says how long ago', () => {
    const now = new Date(2026, 10, 14, 9);
    expect(sinceText('2026-11-14T08:00:00', now)).toBe('اليوم');
    expect(sinceText('2026-11-13T20:00:00', now)).toBe('أمس');
    expect(sinceText('2026-11-09T20:00:00', now)).toBe('منذ 5 أيام');
    expect(sinceText('2026-10-14T20:00:00', now)).toBe('منذ 31 يوماً');
  });
});

describe('backups', () => {
  it('carry the new details and wanted pieces both ways', () => {
    const id = saveCustomer(ctx, { name: 'هدى', birthMonth: 3, birthDay: 14, offers: true });
    setVip(ctx, id, 'always');
    ctx.db.run(
      "INSERT INTO wanted_pieces (customer_id, text, created_at, month) VALUES (?, 'خاتم', 'x', 'x')",
      [id],
    );
    const backup = exportBackup(ctx);
    expect(backup.tables.wanted_pieces).toHaveLength(1);
    ctx.db.run('DELETE FROM customers');
    restoreBackup(ctx, backup);
    expect(getCustomer(ctx, id)).toMatchObject({ birthDay: 14, offers: true, vip: 'always' });
    expect(ctx.db.all('SELECT text FROM wanted_pieces')).toEqual([{ text: 'خاتم' }]);
  });

  it('restores a backup made before database 10, the new fields empty', () => {
    saveCustomer(ctx, { name: 'هدى', birthMonth: 3, birthDay: 14, heard: 'tiktok' });
    sell();
    const backup = exportBackup(ctx);
    const drop = ['birth_month', 'birth_day', 'heard', 'ring_size', 'metal', 'colours'];
    for (const row of backup.tables.customers)
      for (const k of [...drop, 'offers', 'vip']) delete row[k];
    for (const row of backup.tables.sales) delete row.reward_off;
    for (const row of backup.tables.receipts) {
      delete row.reward_off;
      delete row.footer;
    }
    delete (backup.tables as Record<string, unknown>).wanted_pieces;
    backup.schema = 9;
    backup.checksum = checksumOf(
      JSON.stringify({
        system: backup.system,
        schema: backup.schema,
        sequences: backup.sequences,
        tables: backup.tables,
      }),
    );
    restoreBackup(ctx, backup);
    expect(listCustomers(ctx)[0]).toMatchObject({
      name: 'هدى',
      birthMonth: null,
      heard: null,
      offers: false,
      vip: null,
    });
    expect(ctx.db.get('SELECT reward_off FROM sales')).toEqual({ reward_off: 0 });
  });
});
