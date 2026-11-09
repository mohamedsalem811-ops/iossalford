import { latinDigits, parseHundredths, parseInteger, parseThousandths, sanitize } from './digits';

describe('latinDigits', () => {
  it('turns Arabic-Indic and Persian digits into 0-9', () => {
    expect(latinDigits('٠١٢٣٤٥٦٧٨٩')).toBe('0123456789');
    expect(latinDigits('۰۱۲۳۴۵۶۷۸۹')).toBe('0123456789');
  });

  it('leaves other characters alone', () => {
    expect(latinDigits('طقم ٣ قطع')).toBe('طقم 3 قطع');
    expect(latinDigits('abc 12')).toBe('abc 12');
  });
});

describe('sanitize', () => {
  it('integer keeps digits only', () => {
    expect(sanitize('١٢ قطعة', 'integer')).toBe('12');
    expect(sanitize('1.5', 'integer')).toBe('15');
  });

  it('decimal keeps one point and accepts Arabic and comma separators', () => {
    expect(sanitize('١٢٫٥', 'decimal')).toBe('12.5');
    expect(sanitize('12,5', 'decimal')).toBe('12.5');
    expect(sanitize('1.2.3', 'decimal')).toBe('1.23');
    expect(sanitize('.5', 'decimal')).toBe('0.5');
    expect(sanitize('١٬٢٥٠', 'decimal')).toBe('1250');
  });

  it('phone keeps a leading plus', () => {
    expect(sanitize(' +٢١٨ ٩١ ١٢٣', 'phone')).toBe('+21891123');
    expect(sanitize('091-123', 'phone')).toBe('091123');
  });
});

describe('parseThousandths', () => {
  it('parses dinars into dirhams without float error', () => {
    expect(parseThousandths('1250')).toBe(1_250_000);
    expect(parseThousandths('12.5')).toBe(12_500);
    expect(parseThousandths('0.1')).toBe(100);
    expect(parseThousandths('٣٫٥')).toBe(3_500);
  });

  it('rounds extra decimals half up', () => {
    expect(parseThousandths('7.1255')).toBe(7_126);
    expect(parseThousandths('7.1254')).toBe(7_125);
  });

  it('returns null for empty input', () => {
    expect(parseThousandths('')).toBeNull();
    expect(parseThousandths('.')).toBeNull();
    expect(parseThousandths('abc')).toBeNull();
  });
});

describe('parseHundredths', () => {
  it('parses dollars into cents', () => {
    expect(parseHundredths('12.5')).toBe(1_250);
    expect(parseHundredths('0.005')).toBe(1);
    expect(parseHundredths('99')).toBe(9_900);
  });
});

describe('parseInteger', () => {
  it('parses quantities', () => {
    expect(parseInteger('٧')).toBe(7);
    expect(parseInteger('')).toBeNull();
  });
});
