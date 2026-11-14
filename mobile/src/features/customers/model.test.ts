import {
  balanceText,
  checkPayment,
  customerFormFrom,
  detailsFromForm,
  detailsTouched,
  emptyDetailsForm,
  monthHint,
  paymentWayLabel,
} from './model';

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
        gender: 'female',
        imageFile: null,
        createdAt: '',
        vip: null,
        birthdaySetAt: null,
        birthMonth: null,
        birthDay: null,
        heard: null,
        ringSize: null,
        metal: null,
        colours: null,
        offers: false,
      }),
    ).toEqual({
      name: 'سارة',
      phone: '',
      area: 'حي الأندلس',
      notes: '',
      gender: 'female',
      imageFile: null,
      details: emptyDetailsForm(),
    });
  });

  it('checks the details typed: a whole real birthday or none', () => {
    const f = { ...emptyDetailsForm(), birthDay: '29', birthMonth: '2', heard: 'tiktok' as const };
    expect(detailsFromForm(f)).toEqual({
      ok: true,
      details: {
        birthDay: 29,
        birthMonth: 2,
        heard: 'tiktok',
        ringSize: null,
        metal: null,
        colours: null,
        offers: false,
      },
    });
    expect(detailsFromForm({ ...f, birthMonth: '' }).ok).toBe(false);
    expect(detailsFromForm({ ...f, birthDay: '31', birthMonth: '4' }).ok).toBe(false);
    expect(monthHint('3')).toBe('مارس');
    expect(monthHint('13')).toBeUndefined();
    expect(detailsTouched(emptyDetailsForm())).toBe(false);
    expect(detailsTouched({ ...emptyDetailsForm(), offers: true })).toBe(true);
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
