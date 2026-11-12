/**
 * @jest-environment node
 */
import { debtors } from './debts';
import { listProducts } from './products';
import { groupDesigns } from './scarves';
import { listReceipts } from './receipts';
import { summary } from './reports';
import { seedDemo } from './seed';
import { listSets } from './sets';
import { makeCtx } from './testing/ctx';

describe('seedDemo', () => {
  it('fills a jewelry database with consistent sample data', () => {
    const ctx = makeCtx('jewelry');
    seedDemo(ctx);
    expect(listProducts(ctx)).toHaveLength(4);
    expect(listSets(ctx)).toHaveLength(1);
    expect(listReceipts(ctx).map((r) => r.receiptNo)).toEqual(['GR-2026-0002', 'GR-2026-0001']);
    expect(debtors(ctx)[0]).toMatchObject({ balance: 920_000 });
    expect(summary(ctx, ['2026-11']).transactions).toBe(2);
    expect(() => seedDemo(ctx)).toThrow('قاعدة فارغة فقط');
    ctx.close();
  });

  it('fills a scarves database with designs and sizes', () => {
    const ctx = makeCtx('scarves');
    seedDemo(ctx);
    const designs = groupDesigns(listProducts(ctx));
    expect(designs.map((d) => d.sizes.length)).toEqual([1, 3]);
    expect(listReceipts(ctx)[0].receiptNo).toBe('SC-2026-0002');
    expect(listReceipts(ctx)[1].items[0].name).toBe('وشاح حرير زهري — 90×90');
    ctx.close();
  });
});
