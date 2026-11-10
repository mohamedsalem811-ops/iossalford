import { checkAdjustment, moveLabel, signed, stockDelta } from './model';

describe('stock adjustment', () => {
  it('turns direction and quantity into a signed change, Arabic digits included', () => {
    expect(stockDelta('add', '3')).toBe(3);
    expect(stockDelta('remove', '٢')).toBe(-2);
    expect(stockDelta('add', '0')).toBeNull();
    expect(stockDelta('add', '')).toBeNull();
  });

  it('asks for a quantity, refuses going below zero, and needs a reason', () => {
    expect(checkAdjustment(5, 'add', '', 'توريد')).toEqual({
      ok: false,
      message: 'أدخل الكمية (رقم أكبر من 0)',
    });
    expect(checkAdjustment(1, 'remove', '2', 'كسر')).toEqual({
      ok: false,
      message: 'المتوفر 1 فقط، لا يمكن إنقاص 2',
    });
    expect(checkAdjustment(1, 'remove', '1', '  ')).toEqual({
      ok: false,
      message: 'اختر أو اكتب سبب تعديل المخزون',
    });
    expect(checkAdjustment(1, 'remove', '1', 'كسر')).toEqual({ ok: true, delta: -1, after: 0 });
    expect(checkAdjustment(4, 'add', '3', 'توريد جديد')).toEqual({ ok: true, delta: 3, after: 7 });
  });

  it('labels history entries and signs changes', () => {
    expect(moveLabel('sale')).toBe('بيع');
    expect(moveLabel('unknown')).toBe('unknown');
    expect(signed(3)).toBe('+3');
    expect(signed(-2)).toBe('−2');
  });
});
