/**
 * Repairs (J3, صيانة): a piece taken in for work, its stages, its ticket number, the deposit and
 * the rest at delivery (any way, or on credit), cancelling (the deposit back or to her balance),
 * the workshop's cost (the owner's), and the money: in the shift, the day summary, the reports
 * and the quarterly closing as «دخل الصيانة», apart from product sales, with no stock moves.
 */
import { OWNER } from '@/staff/model';

import { listActivity } from './activity';
import { exportBackup, restoreBackup } from './backup';
import { closeQuarter } from './closing';
import { PermissionError } from './context';
import { mergeCustomers } from './customer-care';
import { saveCustomer } from './customers';
import { daySummary } from './day-summary';
import { allBalances, balance, deleteCustomer, statement } from './debts';
import { photoInUse } from './photos';
import {
  cancelRepair,
  deliverRepair,
  getRepair,
  listRepairs,
  moveRepair,
  repairPayments,
  repairReadyMessage,
  repairReminders,
  setRepairCost,
  setRepairDate,
  setRepairRules,
  takeRepair,
  type TakeRepairInput,
} from './repairs';
import { summary } from './reports';
import { getShift, openShift, shiftTotals } from './shifts';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';
import { dayKey } from '@/lib/dates';

let ctx: TestCtx;
const MONA = { name: 'منى', phone: '0912345678' };
beforeEach(() => {
  ctx = makeCtx('jewelry', new Date(2026, 10, 17, 10), { autoShift: false });
});
afterEach(() => ctx.close());

const take = (extra: Partial<TakeRepairInput> = {}) =>
  takeRepair(ctx, {
    customer: MONA,
    description: 'خاتم ذهب',
    work: 'resize',
    price: 50_000,
    readyBy: '2026-11-20',
    ...extra,
  });
const shift = () => {
  ctx.setActor(EMPLOYEE);
  return openShift(ctx, 10_000);
};
const expected = (id: number) => shiftTotals(ctx, getShift(ctx, id)!).expected;
const ready = (id: number) => {
  moveRepair(ctx, id, 'workshop');
  moveRepair(ctx, id, 'ready');
};

describe('taking a repair', () => {
  it('numbers the ticket R-year-0001 and keeps what was asked', () => {
    const { repairId, ticketNo } = take({
      photos: ['a.jpg', 'b.jpg'],
      note: 'خدش صغير',
      deposit: { amount: 20_000, method: 'cash' },
    });
    expect(ticketNo).toBe('R-2026-0001');
    expect(take().ticketNo).toBe('R-2026-0002');
    expect(getRepair(ctx, repairId)).toMatchObject({
      ticketNo: 'R-2026-0001',
      status: 'received',
      customerName: 'منى',
      description: 'خاتم ذهب',
      work: 'resize',
      photos: ['a.jpg', 'b.jpg'],
      note: 'خدش صغير',
      price: 50_000,
      paid: 20_000,
      remaining: 30_000,
      readyBy: '2026-11-20',
      cost: null,
    });
  });

  it('needs her name and phone, the piece, the work and a date not before today', () => {
    expect(() => take({ customer: { name: '', phone: '0912345678' } })).toThrow('اسم');
    expect(() => take({ customer: { name: 'منى', phone: '' } })).toThrow('هاتف');
    expect(() => take({ description: ' ' })).toThrow('القطعة');
    expect(() => take({ work: 'paint' as never })).toThrow('العمل');
    expect(() => take({ readyBy: '2026-11-16' })).toThrow('قبل اليوم');
    expect(() => take({ readyBy: '2026-02-30' })).toThrow('تاريخ');
    expect(() => take({ price: -1 })).toThrow('السعر');
  });

  it('may be free (price 0), and takes no deposit bigger than the price', () => {
    expect(getRepair(ctx, take({ price: 0 }).repairId)!.remaining).toBe(0);
    expect(() => take({ deposit: { amount: 60_000, method: 'cash' } })).toThrow('العربون');
    expect(() => take({ deposit: { amount: 10_000, method: 'credit' as never } })).toThrow('طريقة');
  });

  it('writes who took it and touches no stock', () => {
    take();
    expect(listActivity(ctx, {})[0]).toMatchObject({ action: 'repair.take' });
    expect(listActivity(ctx, {})[0].summary).toContain('R-2026-0001');
    expect(ctx.db.get<{ n: number }>('SELECT count(*) n FROM stock_moves')!.n).toBe(0);
  });
});

describe('the stages', () => {
  it('goes received → workshop → ready → delivered, never back', () => {
    const { repairId } = take();
    moveRepair(ctx, repairId, 'workshop');
    expect(getRepair(ctx, repairId)!.status).toBe('workshop');
    expect(() => moveRepair(ctx, repairId, 'workshop')).toThrow();
    moveRepair(ctx, repairId, 'ready');
    expect(getRepair(ctx, repairId)!.readyAt).not.toBeNull();
    deliverRepair(ctx, repairId, { method: 'cash' });
    expect(getRepair(ctx, repairId)!.status).toBe('delivered');
    expect(() => moveRepair(ctx, repairId, 'ready')).toThrow();
  });

  it('is delivered only when ready', () => {
    const { repairId } = take();
    expect(() => deliverRepair(ctx, repairId, { method: 'cash' })).toThrow('جاهزة');
  });

  it('lets anyone change the ready date, never before today', () => {
    const { repairId } = take();
    setRepairDate(ctx, repairId, '2026-11-25');
    expect(getRepair(ctx, repairId)!.readyBy).toBe('2026-11-25');
    expect(() => setRepairDate(ctx, repairId, '2026-11-01')).toThrow('قبل اليوم');
  });
});

describe('the money', () => {
  it('counts the deposit and the rest in cash in the drawer of the shift that took them', () => {
    const id = shift();
    const { repairId } = take({ deposit: { amount: 20_000, method: 'cash' } });
    ready(repairId);
    deliverRepair(ctx, repairId, { method: 'cash' });
    expect(shiftTotals(ctx, getShift(ctx, id)!)).toMatchObject({
      repairs: 50_000,
      cashRepairs: 50_000,
      expected: 10_000 + 50_000,
    });
    expect(repairPayments(ctx, repairId).map((p) => [p.kind, p.amount, p.method])).toEqual([
      ['pay', 20_000, 'cash'],
      ['pay', 30_000, 'cash'],
    ]);
  });

  it('keeps card and transfer out of the drawer', () => {
    const id = shift();
    const { repairId } = take({ deposit: { amount: 20_000, method: 'card' } });
    ready(repairId);
    deliverRepair(ctx, repairId, { method: 'transfer' });
    expect(shiftTotals(ctx, getShift(ctx, id)!)).toMatchObject({
      repairs: 50_000,
      cashRepairs: 0,
      expected: 10_000,
    });
  });

  it('puts the rest on her account when delivered on credit', () => {
    const { repairId } = take({ deposit: { amount: 20_000, method: 'cash' } });
    const customerId = getRepair(ctx, repairId)!.customerId;
    ready(repairId);
    deliverRepair(ctx, repairId, { method: 'credit' });
    expect(balance(ctx, customerId)).toBe(30_000);
    expect(allBalances(ctx).get(customerId)).toBe(30_000);
    expect(statement(ctx, customerId).at(-1)).toMatchObject({ kind: 'repair', amount: 30_000 });
    expect(() => deleteCustomer(ctx, customerId)).toThrow();
  });

  it('shows the day: taken, refunded and the income of what was delivered', () => {
    ctx.setActor(OWNER);
    const a = take({ deposit: { amount: 20_000, method: 'cash' } }).repairId;
    const b = take({ price: 80_000, deposit: { amount: 30_000, method: 'card' } }).repairId;
    ready(a);
    deliverRepair(ctx, a, { method: 'cash' });
    cancelRepair(ctx, b, { how: 'refund' });
    const day = daySummary(ctx, dayKey(ctx.now()));
    expect(day.repairs).toEqual({
      delivered: 1,
      income: 50_000,
      taken: { cash: 50_000, other: 30_000 },
      refunded: { cash: 0, other: 30_000 },
    });
    expect(day.cashNet).toBe(50_000);
  });

  it('is «دخل الصيانة» in the reports and the closing, less the workshop cost', () => {
    ctx.setActor(OWNER);
    const { repairId } = take();
    setRepairCost(ctx, repairId, 15_000);
    ready(repairId);
    deliverRepair(ctx, repairId, { method: 'cash' });
    const s = summary(ctx, ['2026-11']);
    expect(s).toMatchObject({
      grossSales: 0,
      repairIncome: 50_000,
      repairCost: 15_000,
      netProfit: 35_000,
    });
    const closing = closeQuarter(ctx, { year: 2026, quarter: 4 });
    expect(closing).toMatchObject({ repairIncome: 50_000, repairCost: 15_000, netProfit: 35_000 });
  });

  it('counts a repair not delivered yet as no income', () => {
    ctx.setActor(OWNER);
    take({ deposit: { amount: 20_000, method: 'cash' } });
    expect(summary(ctx, ['2026-11']).repairIncome).toBe(0);
  });
});

describe('cancelling (the owner)', () => {
  it('gives the deposit back the way she paid', () => {
    const id = shift();
    const { repairId } = take({ deposit: { amount: 20_000, method: 'cash' } });
    ctx.setActor(OWNER);
    openShift(ctx, 0);
    cancelRepair(ctx, repairId, { how: 'refund', reason: 'غيرت رأيها' });
    expect(getRepair(ctx, repairId)).toMatchObject({
      status: 'cancelled',
      paid: 0,
      settled: 20_000,
    });
    expect(expected(id)).toBe(10_000 + 20_000);
    expect(repairPayments(ctx, repairId).at(-1)).toMatchObject({ kind: 'refund', method: 'cash' });
  });

  it('or moves it to her balance, with no money moving', () => {
    const { repairId } = take({ deposit: { amount: 20_000, method: 'card' } });
    const customerId = getRepair(ctx, repairId)!.customerId;
    cancelRepair(ctx, repairId, { how: 'balance' });
    expect(balance(ctx, customerId)).toBe(-20_000);
  });

  it('is refused to an employee, and so is the workshop cost', () => {
    shift();
    const { repairId } = take();
    expect(() => cancelRepair(ctx, repairId, { how: 'refund' })).toThrow(PermissionError);
    expect(() => setRepairCost(ctx, repairId, 1_000)).toThrow(PermissionError);
    // Staff take, move and deliver.
    ready(repairId);
    deliverRepair(ctx, repairId, { method: 'cash' });
  });

  it('is not possible once delivered', () => {
    const { repairId } = take();
    ready(repairId);
    deliverRepair(ctx, repairId, { method: 'cash' });
    expect(() => cancelRepair(ctx, repairId, { how: 'refund' })).toThrow();
  });
});

describe('the lists and reminders', () => {
  it('finds repairs by her name, phone, the piece or the ticket, by stage and by customer', () => {
    take({ description: 'سوار فضة' });
    take({ customer: { name: 'هدى', phone: '0923333333' } });
    expect(listRepairs(ctx, { search: 'سوار' })).toHaveLength(1);
    expect(listRepairs(ctx, { search: '0923333' })).toHaveLength(1);
    expect(listRepairs(ctx, { search: 'R-2026-0002' })).toHaveLength(1);
    expect(listRepairs(ctx, { status: 'received' })).toHaveLength(2);
    const huda = listRepairs(ctx, { search: 'هدى' })[0].customerId;
    expect(listRepairs(ctx, { customerId: huda })).toHaveLength(1);
  });

  it('reminds of repairs due today, late, and ready and not collected after 14 days', () => {
    const today = take({ readyBy: '2026-11-17' }).repairId;
    const later = take({ readyBy: '2026-11-18' }).repairId;
    const waiting = take().repairId;
    ready(waiting);
    ctx.setNow(new Date(2026, 10, 19, 10));
    let r = repairReminders(ctx);
    expect(r.late.map((x) => x.id)).toEqual([today, later]);
    expect(r.waiting).toEqual([]);
    ctx.setNow(new Date(2026, 11, 1, 10));
    r = repairReminders(ctx);
    expect(r.waiting.map((x) => x.id)).toEqual([waiting]);
    ctx.setNow(new Date(2026, 10, 18, 10));
    expect(repairReminders(ctx).dueToday.map((x) => x.id)).toEqual([later]);
    setRepairRules(ctx, { remindDays: 3 });
    ctx.setNow(new Date(2026, 10, 21, 10));
    expect(repairReminders(ctx).waiting.map((x) => x.id)).toEqual([waiting]);
  });

  it('prepares «جاهزة للاستلام» from the owner’s message', () => {
    const { repairId } = take({ deposit: { amount: 20_000, method: 'cash' } });
    const text = repairReadyMessage(getRepair(ctx, repairId)!);
    expect(text).toContain('منى');
    expect(text).toContain('R-2026-0001');
    expect(text).toContain('30');
  });
});

describe('the customer, photos and backups', () => {
  it('moves her repairs when she is merged, and keeps her from being deleted', () => {
    const { repairId } = take();
    const twin = saveCustomer(ctx, { name: 'منى', phone: '0919999999' });
    const mona = getRepair(ctx, repairId)!.customerId;
    mergeCustomers(ctx, twin, mona);
    expect(getRepair(ctx, repairId)!.customerId).toBe(twin);
    expect(() => deleteCustomer(ctx, twin)).toThrow('صيانة');
  });

  it('keeps its photos in use, and in the backup', () => {
    const { repairId } = take({ photos: ['r1.jpg'] });
    expect(photoInUse(ctx, 'r1.jpg')).toBe(true);
    const backup = exportBackup(ctx);
    cancelRepair(ctx, repairId, { how: 'refund' });
    restoreBackup(ctx, backup);
    expect(getRepair(ctx, repairId)).toMatchObject({ status: 'received', photos: ['r1.jpg'] });
  });
});
