import { parseHundredths, parseThousandths } from './digits';
import {
  divRound,
  editableDinars,
  editableUsd,
  formatDinars,
  formatLyd,
  formatRate,
  formatUsd,
  lydToUsd,
  percentOf,
  split,
  usdToLyd,
} from './money';

describe('divRound', () => {
  it('rounds half away from zero', () => {
    expect(divRound(5, 2)).toBe(3);
    expect(divRound(-5, 2)).toBe(-3);
    expect(divRound(4, 3)).toBe(1);
    expect(divRound(-4, 3)).toBe(-1);
  });

  it('refuses division by zero', () => {
    expect(() => divRound(1, 0)).toThrow(RangeError);
  });
});

describe('conversion', () => {
  it('converts USD cost to LYD at the rate', () => {
    expect(usdToLyd(1000, 7125)).toBe(71_250); // $10.00 × 7.125 = 71.250
    expect(usdToLyd(1, 7125)).toBe(71); // $0.01 × 7.125 = 0.07125 → 0.071
  });

  it('converts LYD back to USD', () => {
    expect(lydToUsd(71_250, 7125)).toBe(1000);
    expect(lydToUsd(1_000_000, 7125)).toBe(14_035); // 1000 LYD → $140.35
    expect(lydToUsd(500, 0)).toBe(0);
  });
});

describe('percentOf', () => {
  it('takes a percentage to the dirham', () => {
    expect(percentOf(100_000, 10)).toBe(10_000);
    expect(percentOf(33_333, 12.5)).toBe(4_167);
  });
});

describe('split', () => {
  it('always adds up to the total', () => {
    const parts = split(100_000, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100_000);
    expect(parts).toEqual([33_334, 33_333, 33_333]);
  });

  it('spreads a set discount by price', () => {
    expect(split(-30_000, [100_000, 50_000])).toEqual([-20_000, -10_000]);
  });

  it('gives leftover dirhams to the largest remainders', () => {
    expect(split(10, [1, 2])).toEqual([3, 7]);
  });

  it('handles empty and zero weights', () => {
    expect(split(500, [])).toEqual([]);
    expect(split(500, [0, 0])).toEqual([0, 500]);
  });

  it('never loses a dirham on many random cases', () => {
    for (let n = 0; n < 200; n++) {
      const total = Math.floor(Math.random() * 2_000_000) - 1_000_000;
      const weights = Array.from({ length: 1 + (n % 7) }, () => Math.floor(Math.random() * 90_000));
      const parts = split(total, weights);
      expect(parts.reduce((a, b) => a + b, 0)).toBe(total);
    }
  });
});

describe('formatting', () => {
  it('shows dinars with dirhams only when present', () => {
    expect(formatDinars(1_250_000)).toBe('1,250');
    expect(formatDinars(12_500)).toBe('12.5');
    expect(formatDinars(1_083_333)).toBe('1,083.333');
    expect(formatDinars(50)).toBe('0.05');
    expect(formatDinars(-2_000)).toBe('-2');
    expect(formatDinars(0)).toBe('0');
  });

  it('adds the dinar sign', () => {
    expect(formatLyd(1_250_000)).toBe('1,250 د.ل');
  });

  it('formats dollars with cents', () => {
    expect(formatUsd(1_250)).toBe('$12.50');
    expect(formatUsd(123_456_700)).toBe('$1,234,567.00');
    expect(formatUsd(-300)).toBe('-$3.00');
  });

  it('formats rates and edit-field text without separators', () => {
    expect(formatRate(7_125)).toBe('7.125');
    expect(editableDinars(1_250_500)).toBe('1250.5');
    expect(editableUsd(1_250)).toBe('12.5');
    expect(editableUsd(1_200)).toBe('12');
    expect(editableUsd(1_205)).toBe('12.05');
  });

  it('round-trips through the edit field', () => {
    for (const v of [0, 1, 50, 12_500, 1_083_333, 99_999_999]) {
      expect(parseThousandths(editableDinars(v))).toBe(v === 0 ? 0 : v);
    }
    for (const c of [1, 50, 1_205, 99_999]) {
      expect(parseHundredths(editableUsd(c))).toBe(c);
    }
  });

  it('never shows Arabic digits', () => {
    expect(formatLyd(9_876_543)).toMatch(/^[0-9,.]+ د\.ل$/);
  });
});
