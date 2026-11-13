/**
 * @jest-environment node
 *
 * The speed test (plan step 8.0l): a shop with 2,000 products and 10,000 sales, then 30,000 sales
 * (about 5 to 10 years), timing what each screen reads, a checkout and the backups. Runs only on
 * request, because building the data takes a while:
 *
 *   npm run speed
 *
 * Times are measured on the computer running the test with the same SQL the app runs; an iPhone
 * or iPad is in the same range for this kind of work. Each line must stay under the target.
 */
import { daySummary } from '@/domain/day-summary';
import { OWNER } from '@/staff/model';
import { copyDatabase, restoreSnapshot, writeSnapshot } from '@/backup/engine';
import { migrate } from '@/db/migrate';
import { openFileDb } from '@/db/testing/node-db';
import { tempDir } from '@/db/testing/temp-files';
import type { Db } from '@/db/types';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { ensureCustomer, listCustomers } from '@/domain/customers';
import { allBalances, creditBalances, debtors } from '@/domain/debts';
import { displayName, getProduct, listProducts } from '@/domain/products';
import { countReceipts, listReceipts, receiptMonths } from '@/domain/receipts';
import {
  breakdown,
  dailySales,
  monthlyComparison,
  stockSummary,
  summary,
  today,
  topProducts,
} from '@/domain/reports';
import { listReturns, listSales, saleMonths, salesSummary } from '@/domain/sales';
import { dayKey, recentMonths } from '@/lib/dates';

const run = process.env.SPEED === '1' ? describe : describe.skip;

/** The target for anything a screen reads when it opens (the plan: under a third of a second). */
const SCREEN_MS = 333;

const BRANDS = Array.from({ length: 30 }, (_, i) => `Brand ${i + 1}`);
const CATEGORIES = ['خواتم', 'قلادات', 'أساور', 'أقراط', 'ساعات', 'أطقم', 'دبابيس', 'خلاخيل'];
const now = new Date(2026, 10, 12, 12, 0);

/** Fills the database the way the app would (same tables and columns), quickly. */
function seed(db: Db, products: number, sales: number) {
  db.transaction(() => {
    const at = '2026-01-01T10:00:00';
    for (const b of BRANDS) db.run('INSERT INTO brands (name, created_at) VALUES (?, ?)', [b, at]);
    for (let i = 1; i <= products; i++) {
      db.run(
        `INSERT INTO products (sku, name, brand_id, category, price, cost, stock, low_stock, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 2, ?, ?)`,
        [
          `P-${String(i).padStart(5, '0')}`,
          `${CATEGORIES[i % CATEGORIES.length]} ${i}`,
          (i % BRANDS.length) + 1,
          CATEGORIES[i % CATEGORIES.length],
          100_000 + (i % 50) * 10_000,
          50_000 + (i % 50) * 5_000,
          i % 17 === 0 ? 0 : 5 + (i % 9),
          at,
          at,
        ],
      );
    }
    for (let i = 1; i <= 1_500; i++) {
      const phone = `09${String(10_000_000 + i)}`;
      db.run(
        'INSERT INTO customers (name, name_key, phone, phone_key, created_at) VALUES (?, ?, ?, ?, ?)',
        [`زبون ${i}`, `زبون ${i}`, phone, phone, at],
      );
    }
    const methods = ['cash', 'cash', 'cash', 'card', 'transfer', 'credit'];
    let receipt = 0;
    for (let s = 1; s <= sales; s++) {
      // Spread over the last 60 months, newest last.
      const d = new Date(2021, 11, 1 + Math.floor((s / sales) * 1_800));
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00`;
      const month = stamp.slice(0, 7);
      const method = methods[s % methods.length];
      const customer = method === 'credit' || s % 4 === 0 ? (s % 1_500) + 1 : null;
      const lines = 1 + (s % 3);
      let total = 0;
      let cost = 0;
      const rows: [number, number, number][] = [];
      for (let l = 0; l < lines; l++) {
        const p = ((s * 7 + l * 13) % products) + 1;
        const price = 100_000 + (p % 50) * 10_000;
        rows.push([p, price, 50_000 + (p % 50) * 5_000]);
        total += price;
        cost += rows[rows.length - 1][2];
      }
      const saleId = db.run(
        `INSERT INTO sales (created_at, month, payment_method, customer_id, customer_name, rate, total, total_cost)
         VALUES (?, ?, ?, ?, ?, 7000, ?, ?)`,
        [stamp, month, method, customer, customer ? `زبون ${customer}` : null, total, cost],
      ).lastInsertRowId;
      receipt++;
      const receiptId = db.run(
        `INSERT INTO receipts (receipt_no, date, time, customer, template, show_prices, sale_id, created_at)
         VALUES (?, ?, '12:00', ?, 'royal', 1, ?, ?)`,
        [
          `GR-${d.getFullYear()}-${String(receipt).padStart(6, '0')}`,
          stamp.slice(0, 10),
          customer ? `زبون ${customer}` : '',
          saleId,
          stamp,
        ],
      ).lastInsertRowId;
      rows.forEach(([p, price, c], pos) => {
        const lineId = db.run(
          `INSERT INTO sale_lines (sale_id, product_id, name, sku, brand, category, quantity, unit_cost, list_price, unit_price, line_total, line_cost)
           VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)`,
          [
            saleId,
            p,
            `${CATEGORIES[p % CATEGORIES.length]} ${p}`,
            `P-${String(p).padStart(5, '0')}`,
            BRANDS[p % BRANDS.length],
            CATEGORIES[p % CATEGORIES.length],
            c,
            price,
            price,
            price,
            c,
          ],
        ).lastInsertRowId;
        db.run(
          `INSERT INTO receipt_items (receipt_id, position, name, brand, code, quantity, price) VALUES (?, ?, ?, ?, ?, 1, ?)`,
          [
            receiptId,
            pos,
            `${CATEGORIES[p % CATEGORIES.length]} ${p}`,
            BRANDS[p % BRANDS.length],
            `P-${p}`,
            price,
          ],
        );
        db.run(
          `INSERT INTO stock_moves (product_id, delta, kind, ref_id, created_at) VALUES (?, -1, 'sale', ?, ?)`,
          [p, lineId, stamp],
        );
        if (s % 33 === 0 && pos === 0) {
          db.run(
            `INSERT INTO returns (sale_line_id, product_id, name, quantity, refund, cost, created_at, month)
             VALUES (?, ?, 'مرتجع', 1, ?, ?, ?, ?)`,
            [lineId, p, price, c, stamp, month],
          );
        }
      });
      if (method === 'credit' && s % 2 === 0) {
        db.run(
          `INSERT INTO payments (customer_id, amount, method, created_at, month) VALUES (?, ?, 'cash', ?, ?)`,
          [customer, Math.floor(total / 2), stamp, month],
        );
      }
    }
    for (let m = 0; m < 60; m++) {
      const d = new Date(2021, 11 + m, 15);
      db.run('INSERT INTO expenses (description, amount, month, created_at) VALUES (?, ?, ?, ?)', [
        'إيجار',
        1_500_000,
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        '2026-01-01T10:00:00',
      ]);
    }
    db.run(
      "INSERT OR REPLACE INTO settings (key, value) VALUES ('receipt_year', '2026'), ('receipt_counter', ?)",
      [String(receipt)],
    );
  });
}

/** The fastest of three runs, in milliseconds. */
function time(fn: () => unknown): number {
  let best = Infinity;
  for (let i = 0; i < 3; i++) {
    const t = performance.now();
    fn();
    best = Math.min(best, performance.now() - t);
  }
  return Math.round(best * 10) / 10;
}

function measure(sales: number) {
  const dir = tempDir();
  const db = openFileDb(dir.at('jewelry.db'));
  migrate(db);
  db.exec('PRAGMA journal_mode = WAL;');
  seed(db, 2_000, sales);
  const ctx: Ctx = { db, system: 'jewelry', now: () => now, actor: OWNER };
  const month = '2026-11';
  const months = recentMonths(12, now);
  const results: [string, number, number][] = [];
  const check = (what: string, fn: () => unknown, target = SCREEN_MS) =>
    results.push([what, time(fn), target]);

  check('Products / Sale tab: every product', () => listProducts(ctx));
  check('Sales history: first page + count + months', () => {
    listSales(ctx, {}, { limit: 60 });
    salesSummary(ctx);
    saleMonths(ctx);
  });
  check('Sales history: search', () => listSales(ctx, { search: 'قلادات 1' }, { limit: 60 }));
  check('Sales history: next page deep down', () =>
    listSales(ctx, {}, { limit: 60, offset: sales - 100 }),
  );
  check('Receipts: first page + count + months', () => {
    listReceipts(ctx, {}, { limit: 60 });
    countReceipts(ctx);
    receiptMonths(ctx);
  });
  check('Receipts: search', () => listReceipts(ctx, { search: 'زبون 12' }, { limit: 60 }));
  check('Returns: first page', () => listReturns(ctx, undefined, { limit: 60 }));
  check('Customers: list with each balance', () => {
    const b = allBalances(ctx);
    return listCustomers(ctx).map((c) => b.get(c.id) ?? 0);
  });
  check('Debts: who owes, who is owed', () => {
    debtors(ctx);
    creditBalances(ctx);
  });
  check('Dashboard: today + month + breakdowns + chart + stock', () => {
    today(ctx);
    summary(ctx, [month]);
    dailySales(ctx, month);
    for (const by of ['brand', 'category', 'payment'] as const) breakdown(ctx, [month], by);
    topProducts(ctx, [month]);
    stockSummary(ctx);
  });
  check('End-of-day summary: a day with its shifts', () => daySummary(ctx, dayKey(now)));
  check('Checkout: find a customer by name (no phone)', () => ensureCustomer(ctx, 'زبون 1200'));
  check('Comparison: 12 months', () =>
    monthlyComparison(ctx, months[months.length - 1], months[0]),
  );
  check(
    'Checkout: one sale of 2 pieces',
    () => {
      let cart: CartLine[] = [];
      for (const id of [5, 6]) {
        const p = getProduct(ctx, id)!;
        cart = (addToCart(cart, p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart;
      }
      checkout(ctx, { cart, paymentMethod: 'cash' });
    },
    100,
  );
  let n = 0;
  check('Backup: copy of the database', () => copyDatabase(db, dir.at(`b${n++}.db`)), 1_000);
  writeSnapshot(db, openFileDb, dir.at('restore.db'), { system: 'jewelry', madeAt: 'x' });
  check(
    'Restore: replace everything from a backup',
    () => restoreSnapshot(db, openFileDb, dir.at('restore.db')),
    3_000,
  );

  db.close();
  dir.remove();
  return results;
}

run('speed with years of data (8.0l)', () => {
  jest.setTimeout(600_000);
  for (const sales of [10_000, 30_000]) {
    it(`stays fast with 2,000 products and ${sales.toLocaleString('en')} sales`, () => {
      const results = measure(sales);
      const table = results
        .map(
          ([what, ms, target]) =>
            `${ms <= target ? '✓' : '✗'} ${String(ms).padStart(7)} ms  (target ${target})  ${what}`,
        )
        .join('\n');
      console.log(`\n2,000 products, ${sales.toLocaleString('en')} sales:\n${table}`);
      for (const [what, ms, target] of results)
        expect({ what, ms: ms <= target }).toEqual({ what, ms: true });
    });
  }
});
