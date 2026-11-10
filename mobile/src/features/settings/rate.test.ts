import { checkRate } from './rate';

describe('checkRate', () => {
  it('reads the rate in thousandths, Arabic digits and the Arabic decimal mark too', () => {
    expect(checkRate('7.125')).toEqual({ rate: 7125 });
    expect(checkRate('٧٫٥')).toEqual({ rate: 7500 });
    expect(checkRate(' 8 ')).toEqual({ rate: 8000 });
  });

  it('refuses an empty or zero rate', () => {
    expect(checkRate('')).toHaveProperty('error');
    expect(checkRate('0')).toHaveProperty('error');
    expect(checkRate('0.000')).toHaveProperty('error');
  });
});
