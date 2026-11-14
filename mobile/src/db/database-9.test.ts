/**
 * @jest-environment node
 *
 * Database 9 (phase F2): products' specs and material (feature 16), customers' gender and photo
 * (feature 30), the specs on the receipt, and the loyalty points ledger used by F3.
 */
import { exportBackup, restoreBackup, checksumOf } from '@/domain/backup';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import { getCustomer, listCustomers, saveCustomer } from '@/domain/customers';
import { photoInUse } from '@/domain/photos';
import { getProduct, listProducts, saveProduct, SPECS_MAX } from '@/domain/products';
import { getReceipt, updateReceipt } from '@/domain/receipts';
import { RuleError } from '@/domain/context';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { receiptDoc } from '@/features/receipts/model';
import { receiptHtml } from '@/receipts/templates/html';

import { migrate, schemaVersion } from './migrate';
import { migrations } from './schema';
import { openMemoryDb } from './testing/node-db';

describe('the upgrade from database 8', () => {
  it('keeps every row and adds the new columns empty, and the points ledger', () => {
    const db = openMemoryDb();
    migrate(db, migrations.slice(0, 8));
    expect(schemaVersion(db)).toBe(8);
    db.run(
      "INSERT INTO products (sku, name, category, cost, price, stock, created_at, updated_at) VALUES ('RNG-0001', 'Ring', 'خواتم', 0, 1000, 1, '2026-11-01', '2026-11-01')",
    );
    db.run(
      "INSERT INTO customers (name, name_key, phone, phone_key, created_at) VALUES ('هدى', 'هدى', '0912222222', '912222222', '2026-11-01')",
    );
    const products = db.all('SELECT * FROM products');
    migrate(db);
    expect(schemaVersion(db)).toBe(9);
    expect(db.all('SELECT * FROM products')).toEqual(
      products.map((p) => ({ ...(p as object), specs: null })),
    );
    expect(db.get('SELECT gender, image_file FROM customers')).toEqual({
      gender: null,
      image_file: null,
    });
    expect(db.all('PRAGMA foreign_key_check')).toEqual([]);
    // Only the two genders, and a move is never zero points.
    expect(() => db.run("UPDATE customers SET gender = 'other'")).toThrow(/CHECK/);
    expect(() =>
      db.run(
        "INSERT INTO loyalty_moves (customer_id, kind, points, created_at, month) VALUES (1, 'adjust', 0, 'x', 'x')",
      ),
    ).toThrow(/CHECK/);
    db.run(
      "INSERT INTO loyalty_moves (customer_id, kind, points, created_at, month) VALUES (1, 'adjust', 5, 'x', 'x')",
    );
    expect(db.get<{ uid: string }>('SELECT uid FROM loyalty_moves')?.uid).toMatch(/^[0-9a-f]{32}$/);
    db.close();
  });
});

describe('specs and material (feature 16)', () => {
  let ctx: TestCtx;
  beforeEach(() => {
    ctx = makeCtx();
  });
  afterEach(() => ctx.close());

  it('is optional free text, tidied, up to 300 letters, kept on edits that leave it out', () => {
    const id = saveProduct(ctx, {
      name: 'Swarovski Ring',
      category: 'خواتم',
      price: 100_000,
      stock: 1,
      specs: '  روديوم ،  كريستال \n\n عيار ٩٢٥ ',
    });
    expect(getProduct(ctx, id)?.specs).toBe('روديوم ، كريستال\nعيار 925');
    saveProduct(ctx, { id, name: 'Swarovski Ring', category: 'خواتم', price: 120_000, stock: 1 });
    expect(getProduct(ctx, id)?.specs).toBe('روديوم ، كريستال\nعيار 925');
    saveProduct(ctx, {
      id,
      name: 'Swarovski Ring',
      category: 'خواتم',
      price: 1,
      stock: 1,
      specs: '',
    });
    expect(getProduct(ctx, id)?.specs).toBeNull();
    expect(() =>
      saveProduct(ctx, {
        name: 'x',
        category: 'خواتم',
        price: 1,
        stock: 1,
        specs: 'a'.repeat(SPECS_MAX + 1),
      }),
    ).toThrow(RuleError);
    expect(saveProduct(ctx, { name: 'y', category: 'خواتم', price: 1, stock: 1 })).toBeGreaterThan(
      0,
    );
  });

  it('is found by search', () => {
    saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1, stock: 1, specs: 'فضة 925' });
    saveProduct(ctx, { name: 'Chain', category: 'سلاسل', price: 1, stock: 1 });
    expect(listProducts(ctx, { search: '925' }).map((p) => p.name)).toEqual(['Ring']);
  });

  it('goes on the sale receipt under its piece, unless the receipt hides it', () => {
    const id = saveProduct(ctx, {
      name: 'Ring',
      category: 'خواتم',
      price: 100_000,
      stock: 2,
      specs: 'روديوم <مطلي>',
    });
    const p = getProduct(ctx, id)!;
    const cart = (addToCart([], p, p.name, 1) as { cart: CartLine[] }).cart;
    const receiptId = checkout(ctx, { cart, paymentMethod: 'cash' }).receipt.id;
    const r = getReceipt(ctx, receiptId)!;
    expect(r.showSpecs).toBe(true);
    expect(r.items[0].specs).toBe('روديوم <مطلي>');
    expect(receiptHtml(receiptDoc(r))).toContain('class="specs">روديوم &lt;مطلي&gt;');
    const hidden = updateReceipt(ctx, receiptId, { items: r.items, showSpecs: false });
    expect(hidden.showSpecs).toBe(false);
    expect(receiptHtml(receiptDoc(hidden))).not.toContain('class="specs"');
    // Editing other things keeps the choice.
    expect(updateReceipt(ctx, receiptId, { items: r.items, customer: 'Huda' }).showSpecs).toBe(
      false,
    );
  });
});

describe('customer gender and photo (feature 30)', () => {
  let ctx: TestCtx;
  beforeEach(() => {
    ctx = makeCtx();
  });
  afterEach(() => ctx.close());

  it('saves them, keeps them on edits that leave them out, and keeps the photo in use', () => {
    const id = saveCustomer(ctx, { name: 'منى', gender: 'female', imageFile: 'jewelry-a.jpg' });
    expect(getCustomer(ctx, id)).toMatchObject({ gender: 'female', imageFile: 'jewelry-a.jpg' });
    expect(photoInUse(ctx, 'jewelry-a.jpg')).toBe(true);
    saveCustomer(ctx, { id, name: 'منى علي' });
    expect(getCustomer(ctx, id)).toMatchObject({ gender: 'female', imageFile: 'jewelry-a.jpg' });
    saveCustomer(ctx, { id, name: 'منى علي', gender: null, imageFile: null });
    expect(getCustomer(ctx, id)).toMatchObject({ gender: null, imageFile: null });
    expect(photoInUse(ctx, 'jewelry-a.jpg')).toBe(false);
  });

  it('restores a backup made before database 9, the new fields empty', () => {
    saveCustomer(ctx, { name: 'هدى', gender: 'female' });
    saveProduct(ctx, { name: 'Ring', category: 'خواتم', price: 1, stock: 1, specs: 'فضة' });
    const backup = exportBackup(ctx);
    // As database 8 made it: none of database 9's columns or tables.
    for (const row of backup.tables.customers) {
      delete row.gender;
      delete row.image_file;
    }
    for (const row of backup.tables.products) delete row.specs;
    delete (backup.tables as Record<string, unknown>).loyalty_moves;
    backup.schema = 8;
    backup.checksum = checksumOf(
      JSON.stringify({
        system: backup.system,
        schema: backup.schema,
        sequences: backup.sequences,
        tables: backup.tables,
      }),
    );
    restoreBackup(ctx, backup);
    expect(listCustomers(ctx)[0]).toMatchObject({ name: 'هدى', gender: null, imageFile: null });
    expect(listProducts(ctx)[0].specs).toBeNull();
  });
});
