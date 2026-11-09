import {
  addMonths,
  dayKey,
  daysInMonth,
  formatDate,
  formatDay,
  formatTime,
  monthKey,
  monthRange,
  monthTitle,
  parseMonthKey,
  quarterKey,
  quarterMonths,
  quarterOf,
  quarterTitle,
  recentMonths,
} from './dates';

// Local-time dates (month is 0-based in the Date constructor).
const nov9 = new Date(2026, 10, 9, 14, 5);

describe('month keys', () => {
  it('builds and reads keys', () => {
    expect(monthKey(nov9)).toBe('2026-11');
    expect(dayKey(nov9)).toBe('2026-11-09');
    expect(parseMonthKey('2026-11')).toEqual({ year: 2026, month: 11 });
    expect(parseMonthKey('2026-13')).toBeNull();
    expect(parseMonthKey('nov')).toBeNull();
  });

  it('titles months in Arabic with digits 0-9', () => {
    expect(monthTitle('2026-11')).toBe('نوفمبر 2026');
    expect(monthTitle('2027-01')).toBe('يناير 2027');
    expect(monthTitle('bad')).toBe('bad');
  });

  it('moves across years', () => {
    expect(addMonths('2026-01', -1)).toBe('2025-12');
    expect(addMonths('2026-11', 3)).toBe('2027-02');
    expect(addMonths('2026-05', -17)).toBe('2024-12');
  });

  it('lists this month and the 11 before it', () => {
    const months = recentMonths(12, new Date(2026, 1, 15));
    expect(months).toHaveLength(12);
    expect(months[0]).toBe('2026-02');
    expect(months[1]).toBe('2026-01');
    expect(months[2]).toBe('2025-12');
    expect(months[11]).toBe('2025-03');
  });

  it('builds a month range for charts', () => {
    expect(monthRange('2025-11', '2026-02')).toEqual(['2025-11', '2025-12', '2026-01', '2026-02']);
    expect(monthRange('2026-03', '2026-01')).toEqual([]);
  });

  it('knows month lengths, including leap years', () => {
    expect(daysInMonth('2026-02')).toBe(28);
    expect(daysInMonth('2028-02')).toBe(29);
    expect(daysInMonth('2026-11')).toBe(30);
    expect(daysInMonth('2026-12')).toBe(31);
  });
});

describe('quarters', () => {
  it('finds the quarter of a date or month', () => {
    expect(quarterOf(nov9)).toEqual({ year: 2026, quarter: 4 });
    expect(quarterOf('2026-03')).toEqual({ year: 2026, quarter: 1 });
    expect(quarterOf('2026-04')).toEqual({ year: 2026, quarter: 2 });
    expect(quarterOf('x')).toBeNull();
  });

  it('matches the current app keys and titles', () => {
    const q = { year: 2026, quarter: 4 } as const;
    expect(quarterKey(q)).toBe('2026-Q4');
    expect(quarterMonths(q)).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(quarterTitle(q)).toBe('الربع الرابع 2026');
  });
});

describe('formatting', () => {
  it('formats days, dates and times', () => {
    expect(formatDay(nov9)).toBe('الإثنين 9 نوفمبر');
    expect(formatDay(nov9, true)).toBe('الإثنين 9 نوفمبر 2026');
    expect(formatDate(nov9)).toBe('9 نوفمبر 2026');
    expect(formatTime(nov9)).toBe('14:05');
    expect(formatTime(new Date(2026, 0, 1, 9, 7))).toBe('09:07');
  });

  it('never uses Arabic digits', () => {
    expect(formatDay(nov9, true)).not.toMatch(/[٠-٩۰-۹]/);
  });
});
