/**
 * @jest-environment node
 */
import { backupContents, checksumOf, exportBackup, restoreBackup, validateBackup } from './backup';
import { addToCart } from './cart';
import { checkout, type PaymentMethod } from './checkout';
import {
  closeQuarter,
  deleteClosing,
  existingClosing,
  listClosings,
  previewQuarter,
} from './closing';
import { addExpense } from './expenses';
import { getProduct, listProducts, saveProduct, type Product } from './products';
import { listReceipts } from './receipts';
import {
  breakdown,
  dailySales,
  monthlyComparison,
  stockBySize,
  stockSummary,
  summary,
  today,
  topProducts,
} from './reports';
import { addReturn, getSale } from './sales';
import { setRate } from './settings';
import { makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx('jewelry');
  setRate(ctx, 7_000);
});
afterEach(() => ctx.close());

function product(
  name: string,
  price: number,
  stock: number,
  cost: number,
  extra: { brand?: string; category?: string; size?: string } = {},
): Product {
  return getProduct(
    ctx,
    saveProduct(ctx, {
      name,
      price,
      stock,
      cost,
      category: extra.category ?? 'خواتم',
      brand: extra.brand,
      size: extra.size,
    }),
  )!;
}

function sell(
  p: Product,
  qty: number,
  method: PaymentMethod = 'cash',
  customer?: { name: string },
) {
  const r = addToCart([], getProduct(ctx, p.id)!, p.name, qty);
  if ('problem' in r) throw new Error('cart');
  return checkout(ctx, { cart: r.cart, paymentMethod: method, customer });
}

describe('summary', () => {
  it('adds sales, refunds and expenses into net profit, in LYD and USD', () => {
    const ring = product('خاتم', 350_000, 10, 200_000, { brand: 'Pandora' });
    const neck = product('قلادة', 700_000, 10, 300_000, { brand: 'Swarovski', category: 'قلادات' });
    const s1 = sell(ring, 2); // 700 sales, 300 profit
    sell(neck, 1, 'credit', { name: 'سارة' }); // 700 sales, 400 profit
    addReturn(ctx, { saleLineId: getSale(ctx, s1.saleId)!.lines[0].id, quantity: 1 }); // refund 350, cost back 200
    addExpense(ctx, { description: 'إيجار', amount: 100_000 });
    const s = summary(ctx, ['2026-11']);
    expect(s).toMatchObject({
      grossSales: 1_400_000,
      costOfSales: 700_000,
      grossProfit: 700_000,
      refunds: 350_000,
      returnedCost: 200_000,
      expenses: 100_000,
      transactions: 2,
      itemsSold: 3,
      itemsReturned: 1,
      netSales: 1_050_000,
      netProfit: 450_000, // 700 − (350 − 200) − 100
      grossSalesUsd: 20_000, // 1,400 LYD at 7.000 = $200.00
      netProfitUsd: 6_429,
    });
    expect(summary(ctx, ['2026-10']).grossSales).toBe(0);
    expect(summary(ctx, []).transactions).toBe(0);
  });

  it('breaks sales down by brand, category, payment method and top products', () => {
    const ring = product('خاتم', 350_000, 10, 200_000, { brand: 'Pandora' });
    const neck = product('قلادة', 700_000, 10, 300_000, { brand: 'Swarovski', category: 'قلادات' });
    sell(ring, 3);
    sell(neck, 1, 'card');
    expect(breakdown(ctx, ['2026-11'], 'brand').map((r) => [r.key, r.total, r.quantity])).toEqual([
      ['Pandora', 1_050_000, 3],
      ['Swarovski', 700_000, 1],
    ]);
    expect(breakdown(ctx, ['2026-11'], 'category').map((r) => r.key)).toEqual(['خواتم', 'قلادات']);
    expect(breakdown(ctx, ['2026-11'], 'payment').map((r) => [r.key, r.total, r.quantity])).toEqual(
      [
        ['cash', 1_050_000, 3],
        ['card', 700_000, 1],
      ],
    );
    expect(topProducts(ctx, ['2026-11'], 1)).toEqual([
      { productId: ring.id, key: 'خاتم', total: 1_050_000, quantity: 3, profit: 450_000 },
    ]);
  });

  it('shows daily sales, today with cash vs credit, and the monthly comparison', () => {
    const ring = product('خاتم', 350_000, 10, 200_000);
    sell(ring, 1);
    sell(ring, 2, 'credit', { name: 'منى' });
    ctx.setNow(new Date(2026, 10, 10, 12, 0));
    sell(ring, 1);
    const days = dailySales(ctx, '2026-11');
    expect(days).toHaveLength(30);
    expect(days[8]).toEqual({ day: 9, total: 1_050_000 });
    expect(days[9]).toEqual({ day: 10, total: 350_000 });
    expect(today(ctx)).toEqual({
      total: 350_000,
      profit: 150_000,
      sales: 1,
      pieces: 1,
      byMethod: { cash: 350_000, card: 0, transfer: 0, credit: 0 },
    });
    ctx.setNow(new Date(2026, 10, 9, 18, 0));
    expect(today(ctx).byMethod).toMatchObject({ cash: 350_000, credit: 700_000 });
    expect(monthlyComparison(ctx, '2026-10', '2026-11').map((m) => [m.month, m.netSales])).toEqual([
      ['2026-10', 0],
      ['2026-11', 1_400_000],
    ]);
  });

  it('summarises stock and scarf sizes', () => {
    product('خاتم', 350_000, 2, 200_000);
    product('سوار', 100_000, 0, 50_000);
    product('قلادة', 700_000, 1, 300_000);
    expect(stockSummary(ctx)).toEqual({
      items: 3,
      pieces: 3,
      costValue: 700_000,
      priceValue: 1_400_000,
      low: 2,
      out: 1,
    });
    const s = makeCtx('scarves');
    saveProduct(s, { name: 'وشاح', category: 'حرير', price: 1, stock: 4, size: '90×90' });
    expect(stockBySize(s)).toEqual([{ size: '90×90', pieces: 4 }]);
    s.close();
  });
});

describe('quarterly closing', () => {
  it('closes only that quarter, re-issues by replacing, and deletes', () => {
    const ring = product('خاتم', 350_000, 10, 200_000);
    ctx.setNow(new Date(2026, 8, 15)); // September: Q3
    sell(ring, 1);
    ctx.setNow(new Date(2026, 9, 2)); // October: Q4
    sell(ring, 2);
    const q3 = { year: 2026, quarter: 3 } as const;
    expect(previewQuarter(ctx, q3).grossSales).toBe(350_000);
    const c = closeQuarter(ctx, q3, 'إغلاق');
    expect(c).toMatchObject({
      periodKey: '2026-Q3',
      title: 'الربع الثالث 2026',
      totalSales: 350_000,
      netProfit: 150_000,
      transactions: 1,
      itemsSold: 1,
      notes: 'إغلاق',
    });
    addExpense(ctx, { description: 'متأخر', amount: 50_000, month: '2026-09' });
    const again = closeQuarter(ctx, q3);
    expect(again.id).toBe(c.id);
    expect(again.netProfit).toBe(100_000);
    closeQuarter(ctx, { year: 2026, quarter: 4 });
    expect(listClosings(ctx).map((x) => x.periodKey)).toEqual(['2026-Q4', '2026-Q3']);
    deleteClosing(ctx, c.id);
    expect(existingClosing(ctx, q3)).toBeUndefined();
  });
});

describe('backup', () => {
  function fill() {
    const ring = product('خاتم', 350_000, 5, 200_000, { brand: 'Pandora' });
    sell(ring, 2, 'credit', { name: 'سارة' });
    addExpense(ctx, { description: 'إيجار', amount: 100_000 });
  }

  it('exports every table with a checksum and restores it exactly', () => {
    fill();
    const backup = JSON.parse(JSON.stringify(exportBackup(ctx)));
    expect(backupContents(backup)).toMatchObject({
      products: 1,
      sales: 1,
      customers: 1,
      receipts: 1,
    });
    const other = makeCtx('jewelry');
    const { safetyCopy } = restoreBackup(other, backup);
    expect(safetyCopy.tables.products).toHaveLength(0);
    expect(listProducts(other)[0]).toMatchObject({ name: 'خاتم', brand: 'Pandora', stock: 3 });
    expect(listReceipts(other)[0].receiptNo).toBe('GR-2026-0001');
    expect(summary(other, ['2026-11'])).toEqual(summary(ctx, ['2026-11']));
    // Ids continue after the restored ones, never reusing them.
    const next = saveProduct(other, { name: 'جديد', category: 'خواتم', price: 1, stock: 0 });
    expect(next).toBeGreaterThan(listProducts(other).find((p) => p.name === 'خاتم')!.id);
    other.close();
  });

  it('refuses damaged files, other systems and newer versions without changing anything', () => {
    fill();
    const good = JSON.parse(JSON.stringify(exportBackup(ctx)));
    const target = makeCtx('jewelry');
    saveProduct(target, { name: 'يبقى', category: 'خواتم', price: 1, stock: 1 });
    const tampered = { ...good, tables: { ...good.tables, expenses: [] } };
    expect(() => restoreBackup(target, tampered)).toThrow('تالف');
    expect(() => restoreBackup(target, { hello: 1 })).toThrow('ليس نسخة احتياطية');
    expect(() => restoreBackup(target, { ...good, version: 99 })).toThrow('إصدار أحدث');
    const scarves = makeCtx('scarves');
    expect(() => validateBackup(scarves, good)).toThrow('نظام المجوهرات');
    expect(listProducts(target).map((p) => p.name)).toEqual(['يبقى']);
    target.close();
    scarves.close();
  });

  it('uses a stable checksum', () => {
    expect(checksumOf('abc')).toBe(checksumOf('abc'));
    expect(checksumOf('abc')).not.toBe(checksumOf('abd'));
  });
});
