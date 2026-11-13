/**
 * @jest-environment node
 *
 * The app side of the activity log (phase S3): lines that wait for the database, the check of
 * the chain against the line remembered outside it, and the owner's alert.
 */
import { countActivity, listActivity, recordSignIn, walkLog } from '@/domain/activity';
import { saveProduct } from '@/domain/products';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { OWNER } from '@/staff/model';

import {
  acknowledgeBreaks,
  forgetLog,
  readAnchor,
  readVerified,
  saveAnchor,
  stampDevice,
  takeWaiting,
  useLogAlerts,
  whenOpen,
} from './guards';
import { checkLog, FULL_CHECK_MS } from './log-guard';

const mockKeychain = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItem: (k: string) => mockKeychain.get(k) ?? null,
  setItem: (k: string, v: string) => mockKeychain.set(k, v),
}));

let ctx: TestCtx;
beforeEach(() => {
  mockKeychain.clear();
  ctx = makeCtx();
  saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 350_000, stock: 5 });
  saveProduct(ctx, { name: 'سوار', category: 'أساور', price: 200_000, stock: 2 });
  useLogAlerts.getState().set(ctx.system, []);
});
afterEach(() => ctx.close());

const alerts = () => useLogAlerts.getState().broken[ctx.system] ?? [];

it('writes the sign-ins and wrong PINs that waited for the database, once', () => {
  whenOpen(ctx.system, (c: TestCtx) => recordSignIn(c, OWNER));
  whenOpen('scarves', (c: TestCtx) => recordSignIn(c, OWNER));
  for (const write of takeWaiting<TestCtx>(ctx.system)) write(ctx);
  expect(listActivity(ctx)[0].action).toBe('signin');
  expect(takeWaiting(ctx.system)).toEqual([]);
  // The other system's line waits for that system.
  expect(takeWaiting('scarves')).toHaveLength(1);
});

it('finds nothing in an untouched log and remembers its last line', () => {
  checkLog(ctx);
  expect(alerts()).toEqual([]);
  expect(readAnchor(ctx.system)).toMatchObject({ id: 2 });
});

it('reports a changed line once, shows it to the owner until acknowledged', () => {
  checkLog(ctx);
  ctx.db.run("UPDATE activity SET summary = 'شيء آخر' WHERE id = 1");
  // An old line (before the last one checked) is found by the weekly walk of the whole chain.
  checkLog(ctx);
  expect(alerts()).toEqual([]);
  const week = Date.now() + FULL_CHECK_MS;
  checkLog(ctx, week);
  expect(alerts()).toEqual([1]);
  const lines = countActivity(ctx);
  expect(listActivity(ctx)[0]).toMatchObject({ action: 'log.broken', actor: 'system' });
  // Checked again (the whole chain, while a break is there): no second line, the alert stays
  // until the owner has seen it.
  checkLog(ctx);
  expect(countActivity(ctx)).toBe(lines);
  expect(alerts()).toEqual([1]);
  acknowledgeBreaks(ctx.system);
  checkLog(ctx);
  expect(alerts()).toEqual([]);
});

it('checks only the lines added since the last check, and finds a change among them', () => {
  checkLog(ctx);
  expect(readVerified(ctx.system)).toMatchObject({ id: 2 });
  saveProduct(ctx, { name: 'عقد', category: 'عقود', price: 100_000, stock: 1 });
  saveProduct(ctx, { name: 'حلق', category: 'أقراط', price: 90_000, stock: 1 });
  ctx.db.run("UPDATE activity SET summary = 'شيء آخر' WHERE id = 4");
  checkLog(ctx);
  expect(alerts()).toEqual([4]);
});

it('walks the whole chain when the last line checked was changed', () => {
  checkLog(ctx);
  const from = readVerified(ctx.system)!;
  ctx.db.run("UPDATE activity SET summary = 'شيء آخر' WHERE id = 2");
  const walk = walkLog(ctx, null, 500, from);
  let step = walk.next();
  while (!step.done) step = walk.next();
  expect(step.value).toMatchObject({ full: true, broken: [2], lines: 2 });
  checkLog(ctx);
  expect(alerts()).toEqual([2]);
});

it('finds lines removed from the end, using the line remembered outside the database', () => {
  checkLog(ctx);
  ctx.db.run('DELETE FROM activity WHERE id = 2');
  checkLog(ctx);
  expect(alerts()).toEqual([2]);
});

it('starts again from a restored log', () => {
  saveAnchor(ctx.system, { id: 99, hash: 'x' });
  forgetLog(ctx.system);
  checkLog(ctx);
  expect(alerts()).toEqual([]);
});

it('stamps the device id on the records made here', () => {
  stampDevice(ctx.db);
  saveProduct(ctx, { name: 'عقد', category: 'عقود', price: 100_000, stock: 1 });
  const row = ctx.db.get<{ device: string }>("SELECT device FROM products WHERE name = 'عقد'");
  expect(row?.device).toMatch(/^[0-9a-f]{32}$/);
  expect(mockKeychain.get('device.id')).toBe(row?.device);
});
