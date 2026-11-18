import { idleText, slowRowLine } from './model';

it('says how long a piece has waited', () => {
  expect(idleText({ days: 95, lastSold: '2026-01-01T10:00:00.000Z' })).toBe('آخر بيع قبل 95 يوماً');
  expect(idleText({ days: 120, lastSold: null })).toBe('لم تُبع منذ وصولها قبل 120 يوماً');
});

it('shows the stock, the cost and the price', () => {
  expect(slowRowLine({ stock: 3, cost: 40_000, price: 100_000 })).toBe(
    '3 × 40 د.ل • السعر 100 د.ل',
  );
});
