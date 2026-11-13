/**
 * @jest-environment node
 *
 * The activity log (phase S3): every action adds a line in its own transaction, the hash chain
 * finds any line changed, removed or reordered outside the app, and only the owner reads it.
 */
import { OWNER } from '@/staff/model';

import {
  activityDays,
  activityPeople,
  countActivity,
  GENESIS,
  listActivity,
  recordSignIn,
  recordWrongPin,
  verifyLog,
} from './activity';
import { addToCart, type CartLine } from './cart';
import { checkout } from './checkout';
import { PermissionError } from './context';
import { addExpense } from './expenses';
import { adjustStock, getProduct, saveProduct } from './products';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
beforeEach(() => {
  ctx = makeCtx();
  ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 350_000, stock: 5 });
});
afterEach(() => ctx.close());

function sell(qty = 1) {
  const p = getProduct(ctx, ring)!;
  const cart = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  return checkout(ctx, { cart, paymentMethod: 'cash' });
}

describe('the log', () => {
  it('has a line for every action, by whoever did it, newest first', () => {
    ctx.setActor(EMPLOYEE);
    const { saleId } = sell(2);
    ctx.setActor(OWNER);
    adjustStock(ctx, ring, 3, 'وصول بضاعة');
    const lines = listActivity(ctx);
    expect(lines.map((l) => l.action)).toEqual(['stock.adjust', 'sale.create', 'product.add']);
    expect(lines[1]).toMatchObject({
      actor: 'emp-e1',
      actorName: 'سارة',
      summary: `بيعة رقم ${saleId}: 2 قطعة بـ 700 د.ل (كاش)`,
      details: expect.objectContaining({ saleId, pieces: 2 }),
    });
    expect(lines[0].summary).toBe('مخزون «خاتم» +3: وصول بضاعة');
    expect(verifyLog(ctx)).toMatchObject({ ok: true, lines: 3 });
  });

  it('adds nothing when the action is refused or fails', () => {
    const before = countActivity(ctx);
    ctx.setActor(EMPLOYEE);
    expect(() => adjustStock(ctx, ring, 1, 'x')).toThrow(PermissionError);
    ctx.setActor(OWNER);
    expect(() => sell(99)).toThrow();
    expect(() => addExpense(ctx, { description: '', amount: 5 })).toThrow();
    expect(countActivity(ctx)).toBe(before);
  });

  it('records sign-ins and wrong PINs with the person', () => {
    recordSignIn(ctx, EMPLOYEE);
    recordWrongPin(ctx, EMPLOYEE);
    recordWrongPin(ctx, EMPLOYEE, 5 * 60_000);
    expect(listActivity(ctx, { actor: 'emp-e1' }).map((l) => l.summary)).toEqual([
      'رمز خاطئ لـ سارة: أُقفل الحساب 5 دقيقة',
      'رمز خاطئ لـ سارة',
      'دخول سارة',
    ]);
    expect(activityPeople(ctx)).toEqual([
      { key: 'owner', name: 'المالك' },
      { key: 'emp-e1', name: 'سارة' },
    ]);
    expect(activityDays(ctx)).toEqual(['2026-11-09']);
    expect(countActivity(ctx, { day: '2026-11-08' })).toBe(0);
  });

  it('is for the owner only', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => listActivity(ctx)).toThrow('سجل النشاط: للمالك فقط.');
    expect(() => activityPeople(ctx)).toThrow(PermissionError);
  });
});

describe('the chain', () => {
  beforeEach(() => {
    sell();
    sell();
    adjustStock(ctx, ring, 1, 'تصحيح');
  });

  it('starts from the genesis line and holds while nothing is touched', () => {
    const first = ctx.db.get<{ prev_hash: string }>(
      'SELECT prev_hash FROM activity ORDER BY id LIMIT 1',
    );
    expect(first?.prev_hash).toBe(GENESIS);
    const check = verifyLog(ctx);
    expect(check.ok).toBe(true);
    if (check.ok) expect(verifyLog(ctx, check.last)).toEqual(check);
  });

  it('finds a line changed outside the app', () => {
    ctx.db.run("UPDATE activity SET summary = 'لا شيء' WHERE id = 2");
    expect(verifyLog(ctx)).toMatchObject({ ok: false, broken: [2] });
  });

  it('finds a line removed from the middle', () => {
    ctx.db.run('DELETE FROM activity WHERE id = 2');
    expect(verifyLog(ctx)).toMatchObject({ ok: false, broken: [3] });
  });

  it('finds lines removed from the end, against the line remembered outside the database', () => {
    const check = verifyLog(ctx);
    if (!check.ok) throw new Error('chain');
    const lastId = check.last.id;
    ctx.db.run('DELETE FROM activity WHERE id = ?', [lastId]);
    // The chain alone is still whole...
    expect(verifyLog(ctx).ok).toBe(true);
    // ...but the remembered last line is gone.
    expect(verifyLog(ctx, check.last)).toMatchObject({ ok: false, broken: [lastId] });
  });

  it('goes on after a break, so a later change is found too', () => {
    ctx.db.run("UPDATE activity SET summary = 'x' WHERE id = 1");
    ctx.db.run("UPDATE activity SET summary = 'y' WHERE id = 3");
    expect(verifyLog(ctx).broken).toEqual([1, 3]);
  });

  it('finds a line whose fingerprint was recomputed after a change', () => {
    // Someone changes a line and fixes its own hash: the next line no longer chains to it.
    ctx.db.run("UPDATE activity SET summary = 'x', hash = 'f' || substr(hash, 2) WHERE id = 2");
    expect(verifyLog(ctx)).toMatchObject({ ok: false, broken: [2, 3] });
  });
});

describe('unique ids', () => {
  it('gives every new record a unique id and this device’s id', () => {
    ctx.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('device_id', 'ipad-1')");
    const { saleId } = sell();
    const s = ctx.db.get<{ uid: string; device: string }>(
      'SELECT uid, device FROM sales WHERE id = ?',
      [saleId],
    );
    expect(s?.uid).toMatch(/^[0-9a-f]{32}$/);
    expect(s?.device).toBe('ipad-1');
    const lines = ctx.db.all<{ uid: string }>('SELECT uid FROM sale_lines');
    expect(new Set(lines.map((l) => l.uid)).size).toBe(lines.length);
    const log = ctx.db.get<{ uid: string; device: string }>(
      'SELECT uid, device FROM activity ORDER BY id DESC LIMIT 1',
    );
    expect(log?.device).toBe('ipad-1');
    // The trigger's own update never breaks the chain (uid and device are outside the hash).
    expect(verifyLog(ctx).ok).toBe(true);
  });
});
