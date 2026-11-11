import { checkReturn, monthsOf, returnable, saleReturned, saleSummary, salePieces } from './model';

const line = (over = {}) => ({
  id: 1,
  name: 'Ring',
  quantity: 2,
  returned: 0,
  lineTotal: 700_000,
  ...over,
});

describe('sales model', () => {
  it('summarises a sale and counts pieces and returns', () => {
    const s = { lines: [line(), line({ name: 'Chain', quantity: 1, returned: 1 })] };
    expect(saleSummary(s)).toBe('Ring × 2، Chain');
    expect(salePieces(s)).toBe(3);
    expect(saleReturned(s)).toBe(1);
    expect(returnable(line({ returned: 1 }))).toBe(1);
    expect(returnable(line({ returned: 2 }))).toBe(0);
  });

  it('lists the months that have sales, newest first', () => {
    expect(monthsOf([{ month: '2026-10' }, { month: '2026-11' }, { month: '2026-10' }])).toEqual([
      '2026-11',
      '2026-10',
    ]);
  });

  it('refunds what the customer paid by default, never more', () => {
    expect(checkReturn(line(), 1, '')).toEqual({ ok: true, refund: undefined });
    expect(checkReturn(line(), 1, '٣٠٠')).toEqual({ ok: true, refund: 300_000 });
    expect(checkReturn(line(), 1, '351')).toEqual({
      ok: false,
      message: 'لا يمكن أن يتجاوز الاسترداد ما دفعه الزبون',
    });
    expect(checkReturn(line(), 2, '700')).toEqual({ ok: true, refund: 700_000 });
  });

  it('needs the amount for a return without a sale', () => {
    expect(checkReturn(null, 1, '')).toEqual({
      ok: false,
      message: 'اكتب المبلغ الذي أُعيد للزبون',
    });
    expect(checkReturn(null, 1, '120')).toEqual({ ok: true, refund: 120_000 });
  });
});
