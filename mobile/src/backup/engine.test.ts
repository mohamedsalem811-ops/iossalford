/**
 * @jest-environment node
 *
 * The backup engine on real database files: a copy is complete and labelled, checks catch every
 * wrong file, photos go in and come out one at a time, and restoring replaces the data exactly,
 * also from a backup made by an older version of the app.
 */
import { migrate } from '@/db/migrate';
import { migrations } from '@/db/schema';
import { openFileDb } from '@/db/testing/node-db';
import { tempDir, type TempDir } from '@/db/testing/temp-files';
import type { Db } from '@/db/types';
import { checkout } from '@/domain/checkout';
import { addToCart, type CartLine } from '@/domain/cart';
import type { Ctx } from '@/domain/context';
import { displayName, getProduct, listProducts, saveProduct } from '@/domain/products';
import { listReceipts } from '@/domain/receipts';
import { listSales } from '@/domain/sales';

import { addPhotos, checkSnapshot, eachPhoto, restoreSnapshot, writeSnapshot } from './engine';

let dir: TempDir;
let live: Db;
let ctx: Ctx;
const label = { system: 'jewelry' as const, madeAt: '2026-11-12T10:00:00' };
const at = (name: string) => dir.at(name);

function sell(productId: number) {
  const p = getProduct(ctx, productId)!;
  const cart = (addToCart([], p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: 'cash' });
}

beforeEach(() => {
  dir = tempDir();
  live = openFileDb(at('jewelry.db'));
  migrate(live);
  live.exec('PRAGMA journal_mode = WAL;');
  ctx = { db: live, system: 'jewelry', now: () => new Date(2026, 10, 12, 10) };
  const ring = saveProduct(ctx, {
    name: 'خاتم',
    brand: 'Pandora',
    category: 'خواتم',
    price: 350_000,
    cost: 200_000,
    stock: 5,
  });
  sell(ring);
  sell(ring);
});
afterEach(() => {
  live.close();
  dir.remove();
});

describe('a copy of the database', () => {
  it('holds everything, says which system it is, and passes the checks', () => {
    writeSnapshot(live, openFileDb, at('b.db'), label);
    const info = checkSnapshot(openFileDb, at('b.db'), 'jewelry');
    expect(info).toMatchObject({
      system: 'jewelry',
      products: 1,
      sales: 2,
      receipts: 2,
      photos: 0,
    });
    expect(info.madeAt).toBe(label.madeAt);
    expect(info.schema).toBe(migrations[migrations.length - 1].version);
  });

  it('is refused for the other system, when damaged, or when not a backup', () => {
    writeSnapshot(live, openFileDb, at('b.db'), label);
    expect(() => checkSnapshot(openFileDb, at('b.db'), 'scarves')).toThrow('نظام المجوهرات');

    dir.write('junk.db', 'not a database at all');
    expect(() => checkSnapshot(openFileDb, at('junk.db'), 'jewelry')).toThrow('تالف');

    const other = openFileDb(at('other.db'));
    other.exec('CREATE TABLE t (x INTEGER)');
    other.close();
    expect(() => checkSnapshot(openFileDb, at('other.db'), 'jewelry')).toThrow('ليس نسخة');
  });

  it('is refused when made by a newer app', () => {
    writeSnapshot(live, openFileDb, at('b.db'), label);
    const b = openFileDb(at('b.db'));
    b.exec('PRAGMA user_version = 999;');
    b.close();
    expect(() => checkSnapshot(openFileDb, at('b.db'), 'jewelry')).toThrow('إصدار أحدث');
  });

  it('carries photos and gives them back one at a time', () => {
    writeSnapshot(live, openFileDb, at('copy.db'), label);
    const reads: string[] = [];
    const n = addPhotos(openFileDb, at('copy.db'), [
      { name: 'a.jpg', read: () => (reads.push('a'), new Uint8Array([1, 2, 3])) },
      { name: 'gone.jpg', read: () => null },
      { name: 'b.jpg', read: () => (reads.push('b'), new Uint8Array([9])) },
    ]);
    expect(n).toBe(2);
    expect(checkSnapshot(openFileDb, at('copy.db'), 'jewelry').photos).toBe(2);
    const out: Record<string, number[]> = {};
    eachPhoto(openFileDb, at('copy.db'), (name, bytes) => (out[name] = [...bytes]));
    expect(out).toEqual({ 'a.jpg': [1, 2, 3], 'b.jpg': [9] });
  });
});

describe('restoring', () => {
  it('replaces the data exactly and keeps record numbers from being reused', () => {
    writeSnapshot(live, openFileDb, at('b.db'), label);
    const before = listSales(ctx);
    // Changes after the backup: a new piece and a third sale.
    const neck = saveProduct(ctx, {
      name: 'قلادة',
      brand: 'Swarovski',
      category: 'قلادات',
      price: 600_000,
      cost: 300_000,
      stock: 2,
    });
    sell(neck);
    expect(listSales(ctx)).toHaveLength(3);

    const after = listReceipts(ctx)[0].receiptNo;
    restoreSnapshot(live, openFileDb, at('b.db'));
    expect(listSales(ctx)).toEqual(before);
    expect(listProducts(ctx).map((p) => p.name)).toEqual(['خاتم']);
    // The third sale's number and its receipt number (maybe already printed) are not given out
    // again.
    const thirdReceipt = after;
    const next = sell(listProducts(ctx)[0].id);
    expect(next.saleId).toBe(4);
    expect(next.receipt.receiptNo).not.toBe(thirdReceipt);
    expect(next.receipt.receiptNo.endsWith('4')).toBe(true);
  });

  it('restores a backup made by an older version, upgrading it first', () => {
    // A backup from "version 1"; this app has one more migration that adds a column.
    writeSnapshot(live, openFileDb, at('old.db'), label);
    const newer = [
      ...migrations,
      {
        version: migrations[migrations.length - 1].version + 1,
        name: 'add note',
        sql: "ALTER TABLE products ADD COLUMN note TEXT NOT NULL DEFAULT 'none';",
      },
    ];
    migrate(live, newer);
    jest.isolateModules(() => {
      jest.doMock('@/db/schema', () => ({
        migrations: newer,
        LATEST_VERSION: newer[newer.length - 1].version,
      }));
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- a fresh copy of the module
      const engine = require('./engine') as typeof import('./engine');
      engine.restoreSnapshot(live, openFileDb, at('old.db'));
    });
    const row = live.get<{ name: string; note: string }>('SELECT name, note FROM products');
    expect(row).toEqual({ name: 'خاتم', note: 'none' });
  });

  it('changes nothing when the copy is broken', () => {
    dir.write('junk.db', 'not a database at all');
    expect(() => restoreSnapshot(live, openFileDb, at('junk.db'))).toThrow();
    expect(listSales(ctx)).toHaveLength(2);
  });
});
