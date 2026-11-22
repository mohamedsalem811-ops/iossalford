import { workText, type Repair } from '@/domain/repairs';

import {
  emptyRepairForm,
  moneyLine,
  needsAttention,
  reminderRows,
  repairFormProblem,
  repairTicketData,
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
  services: null,
  unpriced: 0,
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
      needPrice: [repair({ id: 3, unpriced: 1 })],
    });
    expect(rows.map((r) => r.key)).toEqual(['late', 'needPrice', 'dueToday']);
  });
});

it('prints the new ticket: the services, the money, the ready date and the shop note', () => {
  const lines = [
    { id: 1, serviceId: 3, name: 'تلميع', price: 20_000 },
    { id: 2, serviceId: 4, name: 'تبديل حجر', price: null },
  ];
  const t = repairTicketData(repair({ price: 20_000 }), lines, 'jewelry', 'أحضري الإيصال', true);
  expect(t).toMatchObject({
    system: 'jewelry',
    ticketNo: 'R-2026-0001',
    date: '17/11/2026',
    customer: 'منى',
    phone: '0912345678',
    description: 'خاتم ذهب',
    services: [
      { name: 'تلميع', price: 20_000 },
      { name: 'تبديل حجر', price: null },
    ],
    total: 20_000,
    paid: 20_000,
    readyBy: '2026-11-20',
    terms: 'أحضري الإيصال',
    takenBy: 'سارة',
  });
  // Someone who may not see phones prints it masked; a repair from before the services shows
  // its kind of work at its price.
  const old = repairTicketData(repair(), [], 'jewelry', '', false);
  expect(old.phone).toBe('091•••5678');
  expect(old.services).toEqual([{ name: workText(repair()), price: 50_000 }]);
});
