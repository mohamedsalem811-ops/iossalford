import { balanceText, checkPayment, customerFormFrom, paymentWayLabel } from './model';

describe('customers model', () => {
  it('says who owes whom', () => {
    expect(balanceText(250_000)).toBe('عليه 250 د.ل');
    expect(balanceText(-50_500)).toBe('له رصيد 50.5 د.ل');
    expect(balanceText(0)).toBeNull();
  });

  it('fills the form from a customer, empty fields as empty text', () => {
    expect(
      customerFormFrom({
        id: 1,
        name: 'سارة',
        phone: null,
        area: 'حي الأندلس',
        notes: null,
        createdAt: '',
      }),
    ).toEqual({ name: 'سارة', phone: '', area: 'حي الأندلس', notes: '' });
  });

  it('takes a payment up to what is owed, Arabic digits too', () => {
    expect(checkPayment('١٠٠', 250_000)).toEqual({ ok: true, amount: 100_000 });
    expect(checkPayment('250', 250_000)).toEqual({ ok: true, amount: 250_000 });
    expect(checkPayment('251', 250_000)).toEqual({
      ok: false,
      message: 'المبلغ أكبر من المستحق على الزبون (250 د.ل)',
    });
    expect(checkPayment('', 250_000)).toEqual({ ok: false, message: 'يرجى إدخال مبلغ الدفعة' });
    expect(paymentWayLabel('transfer')).toBe('تحويل');
  });
});
