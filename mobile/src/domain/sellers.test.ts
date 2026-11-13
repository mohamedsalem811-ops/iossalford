/**
 * @jest-environment node
 *
 * Who sold each sale (phase S2, schema 2): recorded at checkout, older sales are the owner's, an
 * employee sees only their own sales everywhere, and backups made before schema 2 (both kinds)
 * still restore, their sales becoming the owner's.
 */
import { migrate, schemaVersion } from '@/db/migrate';
import { LATEST_VERSION, migrations } from '@/db/schema';
import { openFileDb, openMemoryDb } from '@/db/testing/node-db';
import { tempDir, type TempDir } from '@/db/testing/temp-files';
import type { Db } from '@/db/types';
import { restoreSnapshot, writeSnapshot } from '@/backup/engine';
import { OWNER, type Actor } from '@/staff/model';

import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  checksumOf,
  restoreBackup,
  TABLES,
  type Backup,
} from './backup';
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { PermissionError, type Ctx } from './context';
import { breakdown } from './reports';
import { monthKey } from '@/lib/dates';
import { displayName, getProduct, saveProduct } from './products';
import {
  countReceipts,
  getReceipt,
  issueReceipt,
  listReceipts,
  receiptForSale,
  receiptMonths,
  updateReceipt,
} from './receipts';
import { getSale, listSales, saleMonths, salesSummary } from './sales';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

const OTHER: Actor = { kind: 'employee', id: 'e2', name: 'ليلى' };

function sell(ctx: Ctx, productId: number) {
  const p = getProduct(ctx, productId)!;
  const cart = (addToCart([], p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: 'cash' }).saleId;
}

describe('the seller of a sale', () => {
  let ctx: TestCtx;
  let ring: number;
  beforeEach(() => {
    ctx = makeCtx();
    ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 1_000, stock: 10 });
  });
  afterEach(() => ctx.close());

  it('is recorded at checkout, with a copy of the name', () => {
    const mine = sell(ctx, ring);
    ctx.setActor(EMPLOYEE);
    const hers = sell(ctx, ring);
    ctx.setActor(OWNER);
    expect(getSale(ctx, mine)).toMatchObject({ seller: 'owner', sellerName: 'المالك' });
    expect(getSale(ctx, hers)).toMatchObject({ seller: 'emp-e1', sellerName: 'سارة' });
  });

  it('gives the month summary per seller, the owner included', () => {
    sell(ctx, ring);
    ctx.setActor(EMPLOYEE);
    sell(ctx, ring);
    sell(ctx, ring);
    ctx.setActor(OWNER);
    const rows = breakdown(ctx, [monthKey(ctx.now())], 'seller');
    expect(rows.map((r) => [r.key, r.total, r.quantity])).toEqual([
      ['سارة', 2_000, 2],
      ['المالك', 1_000, 1],
    ]);
    ctx.setActor(EMPLOYEE);
    expect(() => breakdown(ctx, [monthKey(ctx.now())], 'seller')).toThrow(PermissionError);
  });

  it('lets an employee see only their own sales, and the owner every sale', () => {
    const owners = sell(ctx, ring);
    ctx.setActor(EMPLOYEE);
    const hers = [sell(ctx, ring), sell(ctx, ring)];
    ctx.setActor(OTHER);
    const others = sell(ctx, ring);

    ctx.setActor(EMPLOYEE);
    expect(listSales(ctx).map((s) => s.id)).toEqual([...hers].reverse());
    expect(salesSummary(ctx)).toEqual({ count: 2, total: 2_000 });
    expect(getSale(ctx, owners)).toBeUndefined();
    expect(getSale(ctx, others)).toBeUndefined();
    expect(getSale(ctx, hers[0])?.id).toBe(hers[0]);
    expect(saleMonths(ctx)).toEqual(['2026-11']);

    ctx.setActor(OTHER);
    expect(listSales(ctx).map((s) => s.id)).toEqual([others]);

    ctx.setActor(OWNER);
    expect(salesSummary(ctx).count).toBe(4);

    // Nobody signed in sees nothing.
    ctx.setActor(null);
    expect(listSales(ctx)).toEqual([]);
    expect(salesSummary(ctx).count).toBe(0);
    expect(saleMonths(ctx)).toEqual([]);
  });

  it('lets an employee see and edit only the receipts they issued', () => {
    const ownerSale = sell(ctx, ring);
    const ownerReceipt = receiptForSale(ctx, ownerSale)!;
    ctx.setActor(EMPLOYEE);
    const herSale = sell(ctx, ring);
    const hers = issueReceipt(ctx, { items: [{ name: 'قطعة', quantity: 1, price: 5 }] });
    expect(getReceipt(ctx, hers.id)).toMatchObject({ id: hers.id });
    expect(receiptForSale(ctx, herSale)).toBeDefined();
    expect(listReceipts(ctx).map((r) => r.id)).toHaveLength(2);
    expect(countReceipts(ctx)).toBe(2);
    expect(getReceipt(ctx, ownerReceipt.id)).toBeUndefined();
    expect(receiptForSale(ctx, ownerSale)).toBeUndefined();
    expect(() =>
      updateReceipt(ctx, ownerReceipt.id, { items: [{ name: 'x', quantity: 1, price: 1 }] }),
    ).toThrow('الإيصال غير موجود');
    ctx.setActor(OWNER);
    expect(countReceipts(ctx)).toBe(3);
    expect(receiptMonths(ctx)).toEqual(['2026-11']);
  });

  it('shows nothing to a new employee before their first sale', () => {
    sell(ctx, ring);
    ctx.setActor(EMPLOYEE);
    expect(salesSummary(ctx)).toEqual({ count: 0, total: 0 });
    expect(saleMonths(ctx)).toEqual([]);
  });
});

/** A database as the app made it before staff (schema 1), with one sale. */
function schemaOne(db: Db) {
  migrate(db, migrations.slice(0, 1));
  db.run(
    "INSERT INTO products (sku, name, category, price, cost, stock, created_at, updated_at) VALUES ('R1', 'خاتم', 'خواتم', 1000, 400, 4, '2026-10-01T10:00:00', '2026-10-01T10:00:00')",
  );
  db.run(
    "INSERT INTO sales (created_at, month, payment_method, rate, total, total_cost) VALUES ('2026-10-01T10:05:00', '2026-10', 'cash', 7000, 1000, 400)",
  );
  db.run(
    `INSERT INTO sale_lines (sale_id, product_id, name, sku, quantity, unit_cost, list_price, unit_price, line_total, line_cost)
     VALUES (1, 1, 'خاتم', 'R1', 1, 400, 1000, 1000, 1000, 400)`,
  );
}

describe('data from before staff', () => {
  let dir: TempDir;
  beforeEach(() => {
    dir = tempDir();
  });
  afterEach(() => dir.remove());

  const ctxOn = (db: Db, actor: Actor | null = OWNER): Ctx => ({
    db,
    system: 'jewelry',
    now: () => new Date(2026, 10, 12, 10),
    actor,
  });

  it('upgrades, and every older sale is the owner’s', () => {
    const db = openMemoryDb();
    schemaOne(db);
    expect(schemaVersion(db)).toBe(1);
    migrate(db);
    expect(schemaVersion(db)).toBe(LATEST_VERSION);
    expect(getSale(ctxOn(db), 1)).toMatchObject({ seller: 'owner', sellerName: 'المالك' });
    expect(listSales(ctxOn(db, EMPLOYEE))).toEqual([]);
    db.close();
  });

  it('restores a database backup made at schema 1', () => {
    const old = openFileDb(dir.at('old-live.db'));
    schemaOne(old);
    writeSnapshot(old, openFileDb, dir.at('old.db'), {
      system: 'jewelry',
      madeAt: '2026-10-01T11:00:00',
    });
    old.close();

    const live = openFileDb(dir.at('live.db'));
    migrate(live);
    restoreSnapshot(live, openFileDb, dir.at('old.db'));
    expect(getSale(ctxOn(live), 1)).toMatchObject({ seller: 'owner', total: 1000 });
    live.close();
  });

  it('restores a Phase 7 (.json) backup made at schema 1', () => {
    const old = openMemoryDb();
    schemaOne(old);
    // Made as the older app made it: schema 1 tables only, rows without the newer columns.
    const tables = Object.fromEntries(
      TABLES.filter((t) => t !== 'activity' && t !== 'staff_ledger').map((t) => [
        t,
        old.all(`SELECT * FROM ${t}`),
      ]),
    ) as Backup['tables'];
    const body = { system: 'jewelry' as const, schema: 1, sequences: {}, tables };
    const backup: Backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: '2026-10-01T11:00:00',
      ...body,
      checksum: checksumOf(
        JSON.stringify({ system: body.system, schema: 1, sequences: {}, tables }),
      ),
    };
    expect(Object.keys(backup.tables.sales[0])).not.toContain('seller');
    old.close();

    const live = openMemoryDb();
    migrate(live);
    restoreBackup(ctxOn(live), backup);
    expect(getSale(ctxOn(live), 1)).toMatchObject({ seller: 'owner', total: 1000 });
    live.close();
  });
});
