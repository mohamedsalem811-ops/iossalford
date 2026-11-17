import type { Repair } from '@/domain/repairs';
import { pointsLines } from '@/receipts/templates/html';

import {
  emptyRepairForm,
  moneyLine,
  needsAttention,
  reminderRows,
  repairFormProblem,
  repairTicketDoc,
  statusLine,
} from './model';

const repair = (o: Partial<Repair> = {}): Repair => ({
  id: 1,
  ticketNo: 'R-2026-0001',
  status: 'received',
  customerId: 1,
  customerName: 'منى',
  customerPhone: '0912345678',
  description: 'خاتم ذهب',
  work: 'resize',
  photos: [],
  note: null,
  price: 50_000,
  paid: 20_000,
  remaining: 30_000,
  readyBy: '2026-11-20',
  cost: null,
  workshopAt: null,
  readyAt: null,
  deliveredAt: null,
  cancelledAt: null,
  cancelHow: null,
  settled: 0,
  createdAt: '2026-11-17T10:00:00',
  byName: 'سارة',
  ...o,
});

describe('the repair form', () => {
  const ok = {
    ...emptyRepairForm('2026-11-20'),
    name: 'منى',
    phone: '0912345678',
    description: 'خاتم',
    price: '50',
  };
  it('says what is missing', () => {
    expect(repairFormProblem({ ...ok, name: '' })).toContain('اسم');
    expect(repairFormProblem({ ...ok, phone: '' })).toContain('هاتف');
    expect(repairFormProblem({ ...ok, description: '' })).toContain('القطعة');
    expect(repairFormProblem({ ...ok, price: '' })).toContain('السعر');
    expect(repairFormProblem({ ...ok, deposit: '60' })).toContain('العربون');
    expect(repairFormProblem(ok)).toBeNull();
    // Free: price 0, no deposit.
    expect(repairFormProblem({ ...ok, price: '0' })).toBeNull();
  });
});

describe('the lines shown', () => {
  it('names the stage, and a late one', () => {
    expect(statusLine(repair(), '2026-11-18')).toBe('استُلمت • جاهزة 20/11/2026');
    expect(statusLine(repair(), '2026-11-21')).toContain('متأخرة');
    expect(needsAttention(repair(), '2026-11-21')).toBe(true);
    expect(statusLine(repair({ status: 'ready' }), '2026-11-21')).toBe('جاهزة للاستلام');
    expect(needsAttention(repair({ status: 'ready' }), '2026-11-21')).toBe(false);
  });
  it('shows the money, and a free repair', () => {
    expect(moneyLine(repair())).toBe('50 د.ل • مدفوع 20 د.ل • الباقي 30 د.ل');
    expect(moneyLine(repair({ price: 0, paid: 0, remaining: 0 }))).toBe('مجانية');
  });
  it('lists the reminders, the most urgent first', () => {
    const rows = reminderRows({
      dueToday: [repair()],
      late: [repair({ id: 2 })],
      waiting: [],
    });
    expect(rows.map((r) => r.key)).toEqual(['late', 'dueToday']);
  });
});

it('prints a ticket with its number, the work, the deposit and the shop note', () => {
  const doc = repairTicketDoc(repair(), 'jewelry', 'أحضري الإيصال');
  expect(doc).toMatchObject({
    kind: 'repair',
    receiptNo: 'R-2026-0001',
    deposit: 20_000,
    customer: 'منى',
    items: [{ name: 'خاتم ذهب', quantity: 1, price: 50_000 }],
  });
  expect(doc.footer).toContain('أحضري الإيصال');
  expect(doc.footer).toContain('2026-11-20');
  expect(pointsLines(doc)).toContain('Remaining');
});
