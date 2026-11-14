import { countText, DAYS, MONTHS, PURCHASES, PURCHASES_LEFT } from './arabic-count';

it('writes the counted word the Arabic way', () => {
  expect([1, 2, 3, 6, 10, 11, 12, 24, 60].map((n) => countText(n, MONTHS))).toEqual([
    'شهر',
    'شهرين',
    '3 أشهر',
    '6 أشهر',
    '10 أشهر',
    '11 شهراً',
    '12 شهراً',
    '24 شهراً',
    '60 شهراً',
  ]);
  expect(countText(1, PURCHASES)).toBe('شراء واحد');
  expect(countText(2, PURCHASES)).toBe('شراءين');
  expect(countText(2, PURCHASES_LEFT)).toBe('شراءان');
  expect(countText(5, PURCHASES)).toBe('5 مشتريات');
  expect(countText(15, PURCHASES)).toBe('15 شراءً');
  expect(countText(7, DAYS)).toBe('7 أيام');
});
