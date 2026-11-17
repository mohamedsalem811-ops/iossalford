import type { ProfitRow } from '@/domain/profits';

import { levelTitle, profitLine, profitsHtml, rowLine } from './report';

const row: ProfitRow = {
  key: 'لازوردي',
  label: 'لازوردي',
  sales: 300_000,
  refunds: 50_000,
  netSales: 250_000,
  pieces: 3,
  cost: 110_000,
  profit: 140_000,
  margin: 56,
};

it('writes each row’s line and profit', () => {
  expect(rowLine(row)).toBe('مبيعات 250 د.ل • بعد مرتجعات 50 د.ل • 3 قطعة • التكلفة 110 د.ل');
  expect(profitLine(row)).toBe('140 د.ل • 56٪');
});

it('names the level opened', () => {
  expect(levelTitle({}, {})).toBe('حسب الماركة');
  expect(levelTitle({ brand: 'x' }, { brand: 'لازوردي' })).toBe('«لازوردي» حسب الفئة');
  expect(levelTitle({ brand: 'x', category: 'y' }, { brand: 'لازوردي', category: 'خواتم' })).toBe(
    '«لازوردي» ← «خواتم» حسب القطعة',
  );
});

it('prints the period, the rows and the total, escaped', () => {
  const html = profitsHtml({
    shop: 'SALFORD',
    period: 'نوفمبر 2026',
    level: 'حسب الماركة',
    rows: [{ ...row, label: 'A<b>' }],
    totals: { ...row, margin: 56 },
  });
  expect(html).toContain('نوفمبر 2026');
  expect(html).toContain('A&lt;b&gt;');
  expect(html).toContain('المجموع');
  expect(html).toContain('56٪');
});
