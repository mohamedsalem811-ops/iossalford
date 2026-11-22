/**
 * @jest-environment node
 *
 * Fixed repair prices (rule D): the owner's services and prices; staff tick them and never type
 * a price; a service «السعر يحدده المالك» is priced by the owner, and the repair is delivered only
 * after that. Old repairs keep the name and price they had.
 */
import { OWNER } from '@/staff/model';

import { listActivity } from './activity';
import {
  listRepairServices,
  removeRepairService,
  saveRepairService,
  servicePriceText,
} from './repair-services';
import {
  deliverRepair,
  getRepair,
  moveRepair,
  repairLines,
  repairReminders,
  setRepairLinePrice,
  takeRepair,
  workText,
  type TakeRepairInput,
} from './repairs';
import { EMPLOYEE, makeCtx, type TestCtx } from './testing/ctx';

let ctx: TestCtx;
let polish: number;
let solder: number;
let design: number;
const piece = (o: Partial<TakeRepairInput> = {}): TakeRepairInput => ({
  customer: { name: 'منى', phone: '0912345678' },
  description: 'خاتم ذهب',
  readyBy: '2026-11-30',
  ...o,
});

beforeEach(() => {
  ctx = makeCtx();
  ctx.setActor(OWNER);
  polish = saveRepairService(ctx, { name: 'تلميع', price: 20_000 });
  solder = saveRepairService(ctx, { name: 'لحام', price: 35_000 });
  design = saveRepairService(ctx, { name: 'تصميم خاص', price: null });
});
afterEach(() => ctx.close());

describe("the owner's list", () => {
  it('keeps the services in order, refuses a twin, and logs each change', () => {
    expect(listRepairServices(ctx).map((s) => [s.name, servicePriceText(s.price)])).toEqual([
      ['تلميع', '20 د.ل'],
      ['لحام', '35 د.ل'],
      ['تصميم خاص', 'السعر يحدده المالك'],
    ]);
    expect(() => saveRepairService(ctx, { name: ' تلميع ', price: 5_000 })).toThrow('موجودة');
    expect(() => saveRepairService(ctx, { name: 'نقش', price: -1 })).toThrow('سعر');
    saveRepairService(ctx, { id: polish, name: 'تلميع', price: 25_000 });
    expect(listActivity(ctx, {})[0].summary).toContain('كانت 20 د.ل');
  });

  it('is the owner’s alone', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => saveRepairService(ctx, { name: 'نقش', price: 5_000 })).toThrow();
    expect(() => removeRepairService(ctx, polish)).toThrow();
  });
});

describe('taking a repair', () => {
  it('prices it from the services ticked, never from what staff type', () => {
    ctx.setActor(EMPLOYEE);
    const { repairId } = takeRepair(
      ctx,
      piece({ services: [{ serviceId: polish }, { serviceId: solder }], price: 1 }),
    );
    const r = getRepair(ctx, repairId)!;
    expect(r.price).toBe(55_000);
    expect(workText(r)).toBe('تلميع، لحام');
    expect(r.unpriced).toBe(0);
  });

  it('needs the services from an employee once the owner has a list', () => {
    ctx.setActor(EMPLOYEE);
    expect(() => takeRepair(ctx, piece({ work: 'polish', price: 1_000 }))).toThrow('قائمة المالك');
    expect(() =>
      takeRepair(ctx, piece({ services: [{ serviceId: polish }, { serviceId: polish }] })),
    ).toThrow('مرتين');
    removeRepairService({ ...ctx, actor: OWNER }, polish);
    expect(() => takeRepair(ctx, piece({ services: [{ serviceId: polish }] }))).toThrow(
      'غير موجودة',
    );
  });

  it('keeps the way before the list: with no services set, a typed price', () => {
    for (const id of [polish, solder, design]) removeRepairService(ctx, id);
    ctx.setActor(EMPLOYEE);
    const { repairId } = takeRepair(ctx, piece({ work: 'resize', price: 30_000 }));
    expect(getRepair(ctx, repairId)).toMatchObject({ price: 30_000, services: null });
    expect(workText(getRepair(ctx, repairId)!)).toBe('تصغير أو تكبير المقاس');
  });

  it('lets the owner price «السعر يحدده المالك» at once; from an employee it waits', () => {
    const now = takeRepair(ctx, piece({ services: [{ serviceId: design, price: 90_000 }] }));
    expect(getRepair(ctx, now.repairId)).toMatchObject({ price: 90_000, unpriced: 0 });
    ctx.setActor(EMPLOYEE);
    const later = takeRepair(
      ctx,
      piece({ services: [{ serviceId: polish }, { serviceId: design, price: 1_000 }] }),
    );
    expect(getRepair(ctx, later.repairId)).toMatchObject({ price: 20_000, unpriced: 1 });
    expect(repairReminders(ctx).needPrice.map((r) => r.id)).toEqual([later.repairId]);
  });

  it('takes a deposit while a service waits for the owner’s price (K review)', () => {
    ctx.setActor(EMPLOYEE);
    // Every price known: the deposit stays within it.
    expect(() =>
      takeRepair(
        ctx,
        piece({ services: [{ serviceId: polish }], deposit: { amount: 30_000, method: 'cash' } }),
      ),
    ).toThrow('العربون أكبر');
    // Only «السعر يحدده المالك»: the price is 0 until the owner sets it, and a deposit is taken.
    const { repairId } = takeRepair(
      ctx,
      piece({ services: [{ serviceId: design }], deposit: { amount: 30_000, method: 'cash' } }),
    );
    expect(getRepair(ctx, repairId)).toMatchObject({ price: 0, paid: 30_000, unpriced: 1 });
    // The owner's price can't be under what she paid.
    ctx.setActor(OWNER);
    const line = repairLines(ctx, repairId)[0];
    expect(() => setRepairLinePrice(ctx, line.id, 20_000)).toThrow('المدفوع');
    expect(setRepairLinePrice(ctx, line.id, 90_000)).toBe(90_000);
    expect(getRepair(ctx, repairId)!.remaining).toBe(60_000);
  });
});

describe('the owner’s price on the repair', () => {
  it('is set by the owner, and only then is it delivered', () => {
    ctx.setActor(EMPLOYEE);
    const { repairId } = takeRepair(
      ctx,
      piece({
        services: [{ serviceId: polish }, { serviceId: design }],
        deposit: { amount: 20_000, method: 'cash' },
      }),
    );
    moveRepair(ctx, repairId, 'ready');
    expect(() => deliverRepair(ctx, repairId, { method: 'cash' })).toThrow('لم يحدد المالك');
    const line = repairLines(ctx, repairId).find((l) => l.price === null)!;
    expect(() => setRepairLinePrice(ctx, line.id, 50_000)).toThrow();
    ctx.setActor(OWNER);
    expect(setRepairLinePrice(ctx, line.id, 50_000)).toBe(70_000);
    expect(getRepair(ctx, repairId)).toMatchObject({ price: 70_000, remaining: 50_000 });
    expect(listActivity(ctx, {})[0].summary).toContain('«تصميم خاص»');
    ctx.setActor(EMPLOYEE);
    expect(deliverRepair(ctx, repairId, { method: 'cash' })).toEqual({ paidNow: 50_000 });
  });

  it('never goes under what she already paid', () => {
    const { repairId } = takeRepair(
      ctx,
      piece({
        services: [{ serviceId: design, price: 60_000 }],
        deposit: { amount: 40_000, method: 'card' },
      }),
    );
    const line = repairLines(ctx, repairId)[0];
    expect(() => setRepairLinePrice(ctx, line.id, 30_000)).toThrow('المدفوع');
  });

  it('keeps the name and price a repair had when the list changes', () => {
    const { repairId } = takeRepair(ctx, piece({ services: [{ serviceId: polish }] }));
    saveRepairService(ctx, { id: polish, name: 'تلميع وتنظيف', price: 30_000 });
    removeRepairService(ctx, polish);
    expect(repairLines(ctx, repairId)).toEqual([
      expect.objectContaining({ name: 'تلميع', price: 20_000 }),
    ]);
    expect(getRepair(ctx, repairId)!.price).toBe(20_000);
  });
});
