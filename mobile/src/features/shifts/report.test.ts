import type { Shift, ShiftTotals } from '@/domain/shifts';

import { reportRows, shiftReportHtml } from './report';

jest.mock('expo-print', () => ({}));
jest.mock('expo-sharing', () => ({}));
jest.mock('expo-file-system', () => ({}));

const shift: Shift = {
  id: 7,
  person: 'emp-s1',
  personName: 'سارة <b>',
  openedAt: '2026-11-13T09:00:00',
  openingCash: 100_000,
  closedAt: '2026-11-13T17:00:00',
  countedCash: 425_000,
  expectedCash: 430_000,
  difference: -5_000,
  note: null,
  closedByName: 'سارة',
};

const totals: ShiftTotals = {
  byMethod: { cash: 350_000, card: 200_000, transfer: 0, credit: 0 },
  sales: 2,
  returns: 1,
  refunded: 0,
  cashRefunds: 0,
  cashPayments: 0,
  cashIn: 0,
  cashOut: 20_000,
  discounts: 10_000,
  approvals: 1,
  expected: 430_000,
} as ShiftTotals;

describe('the shift report', () => {
  const report = { shift, totals, moves: [], shop: 'SALFORD المجوهرات' };

  it('lists the sales by payment method, the count and the shortage', () => {
    const rows = Object.fromEntries(reportRows(report).map((r) => [r.label, r.value]));
    expect(rows['المتوقع في الدرج']).toMatch(/430/);
    expect(rows['المعدود']).toMatch(/425/);
    expect(rows['الفرق']).toMatch(/عجز 5/);
    expect(rows['موافقات المالك']).toBe('1');
  });

  it('is an Arabic right-to-left page, with names escaped', () => {
    const html = shiftReportHtml(report);
    expect(html).toContain('dir="rtl"');
    expect(html).toContain('تقرير الوردية رقم 7');
    expect(html).toContain('سارة &lt;b&gt;');
    expect(html).not.toContain('سارة <b>');
  });

  it('shows no count on an open shift', () => {
    const open = {
      ...shift,
      closedAt: null,
      countedCash: null,
      expectedCash: null,
      difference: null,
    };
    const labels = reportRows({ ...report, shift: open }).map((r) => r.label);
    expect(labels).not.toContain('الفرق');
    expect(shiftReportHtml({ ...report, shift: open })).toContain('مفتوحة');
  });
});
