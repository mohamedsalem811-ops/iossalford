/** @jest-environment node */
import { repairTicketHtml, type RepairTicket } from './repair-ticket';

const ticket: RepairTicket = {
  system: 'jewelry',
  ticketNo: 'R-2026-0042',
  date: '21/11/2026',
  time: '15:42',
  customer: 'منى <b>',
  phone: '09•••••678',
  description: 'خاتم ذهب',
  note: null,
  services: [
    { name: 'تلميع', price: 20_000 },
    { name: 'تبديل حجر', price: null },
  ],
  total: 20_000,
  paid: 5_000,
  readyBy: '2026-11-30',
  terms: 'يُرجى إحضار هذا الإيصال عند الاستلام.',
  takenBy: 'سارة',
};

describe('the repair ticket', () => {
  it('prints the number, the services and their prices, the money and the ready date', () => {
    const html = repairTicketHtml(ticket);
    expect(html.match(/R-2026-0042/g)!.length).toBeGreaterThanOrEqual(2);
    expect(html).toContain('20.00 <small>LYD</small>');
    expect(html).toContain('15.00 <small>LYD</small>'); // due at pickup
    expect(html).toContain('يحدده المالك');
    expect(html).toContain('خدمة واحدة بسعر يحدده المالك');
    expect(html).toContain('NOV 2026');
    expect(html).toContain('<svg'); // the claim stub's QR
  });

  it('escapes what was typed', () => {
    const html = repairTicketHtml(ticket);
    expect(html).toContain('منى &lt;b&gt;');
    expect(html).not.toContain('منى <b>');
  });
});
