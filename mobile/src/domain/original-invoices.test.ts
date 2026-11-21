/**
 * @jest-environment node
 *
 * Original invoices (jewelry): the owner adds them and links pieces; an employee opens one only
 * with the owner's invoice code (a one-time token); every opening is logged and alerts the owner.
 */
import { OWNER } from '@/staff/model';

import { listActivity } from './activity';
import { ownerAlerts } from './alerts';
import {
  addOriginalInvoice,
  invoicesOf,
  InvoiceCodeNeeded,
  listOriginalInvoices,
  newInvoiceName,
  openOriginalInvoice,
  removeOriginalInvoice,
  setInvoiceProducts,
} from './original-invoices';
import { saveProduct } from './products';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let ring: number;
let chain: number;
let granted: Set<string>;
const grant = () => {
  const t = `t${granted.size}`;
  granted.add(`invoice:${t}`);
  return t;
};
const file = newInvoiceName('image', 'A1b2C3d4E5f6');

beforeEach(() => {
  ctx = makeCtx('jewelry');
  granted = new Set();
  ctx.approvals = { take: (t, p) => granted.delete(`${p}:${t}`) };
  ctx.setActor(OWNER);
  ring = saveProduct(ctx, { name: 'خاتم سواروفسكي', category: 'خواتم', price: 300_000, stock: 2 });
  chain = saveProduct(ctx, {
    name: 'سلسلة سواروفسكي',
    category: 'سلاسل',
    price: 400_000,
    stock: 1,
  });
});
afterEach(() => ctx.close());

it('names the file at random, and only an invoice file is taken', () => {
  expect(file).toBe('invoice-a1b2c3d4e5f6.jpg');
  expect(newInvoiceName('pdf', 'x-Y_z123456')).toBe('invoice-xyz123456.pdf');
  expect(() =>
    addOriginalInvoice(ctx, { file: '../secret.db', kind: 'image', productIds: [ring] }),
  ).toThrow('غير صالح');
  expect(() => addOriginalInvoice(ctx, { file, kind: 'pdf', productIds: [ring] })).toThrow(
    'غير صالح',
  );
});

it('links one invoice to several pieces, and is the owner’s to add, change and remove', () => {
  const id = addOriginalInvoice(ctx, {
    file,
    kind: 'image',
    title: 'سواروفسكي نيويورك',
    productIds: [ring, chain, ring],
  });
  expect(listOriginalInvoices(ctx)[0]).toMatchObject({ id, productIds: [ring, chain].sort() });
  expect(invoicesOf(ctx, chain)).toEqual([{ id, kind: 'image', title: 'سواروفسكي نيويورك' }]);
  expect(() => addOriginalInvoice(ctx, { file, kind: 'image', productIds: [] })).toThrow(
    'قطعة واحدة',
  );
  setInvoiceProducts(ctx, id, [ring]);
  expect(invoicesOf(ctx, chain)).toEqual([]);

  ctx.setActor(EMPLOYEE);
  expect(() => addOriginalInvoice(ctx, { file, kind: 'image', productIds: [ring] })).toThrow();
  expect(() => removeOriginalInvoice(ctx, id)).toThrow();
  expect(() => listOriginalInvoices(ctx)).toThrow();
  ctx.setActor(OWNER);
  expect(removeOriginalInvoice(ctx, id)).toBe(file);
  expect(invoicesOf(ctx, ring)).toEqual([]);
});

it('opens for an employee only with the invoice code, used once, and alerts the owner', () => {
  const id = addOriginalInvoice(ctx, { file, kind: 'image', productIds: [ring] });
  ctx.setActor(EMPLOYEE);
  expect(() => openOriginalInvoice(ctx, id)).toThrow(InvoiceCodeNeeded);
  expect(() => openOriginalInvoice(ctx, id, { approval: 'wrong' })).toThrow(InvoiceCodeNeeded);
  const token = grant();
  expect(openOriginalInvoice(ctx, id, { approval: token, productId: ring })).toEqual({
    file,
    kind: 'image',
  });
  // The code opened it once; again needs the code again.
  expect(() => openOriginalInvoice(ctx, id, { approval: token })).toThrow(InvoiceCodeNeeded);

  ctx.setActor(OWNER);
  expect(listActivity(ctx, {})[0].summary).toContain('لقطعة «خاتم سواروفسكي»');
  expect(ownerAlerts(ctx).filter((a) => a.kind === 'invoice')).toHaveLength(1);
  // The owner opens it without a code, and raises no alert.
  openOriginalInvoice(ctx, id);
  expect(ownerAlerts(ctx).filter((a) => a.kind === 'invoice')).toHaveLength(1);
});

it('belongs to the jewelry system only', () => {
  const scarves = makeCtx('scarves');
  scarves.setActor(OWNER);
  const scarf = saveProduct(scarves, { name: 'شال', category: 'شالات', price: 50_000, stock: 1 });
  expect(() => addOriginalInvoice(scarves, { file, kind: 'image', productIds: [scarf] })).toThrow(
    'المجوهرات',
  );
  expect(invoicesOf(scarves, scarf)).toEqual([]);
  scarves.close();
});
