/**
 * The owner's repair services and prices (rule D): e.g. «تلميع» 20 د.ل. Staff tick the services
 * a customer asks for and the price is the owner's, never typed. A service with no price
 * («السعر يحدده المالك») is priced by the owner on each repair. Taking a service off the list
 * keeps it on the repairs that used it, with the name and price they had.
 */
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { allow, clean, nowStamp, RuleError, type Ctx } from './context';

export type RepairService = {
  id: number;
  name: string;
  /** Dirhams; null: «السعر يحدده المالك». */
  price: number | null;
  active: boolean;
};

type Row = { id: number; name: string; price: number | null; active: number };
const toService = (r: Row): RepairService => ({
  id: r.id,
  name: r.name,
  price: r.price,
  active: r.active === 1,
});

/** The services on the list, in the owner's order. */
export function listRepairServices(ctx: Ctx): RepairService[] {
  return ctx.db
    .all<Row>('SELECT * FROM repair_services WHERE active = 1 ORDER BY position, id')
    .map(toService);
}

export function getRepairService(ctx: Ctx, id: number): RepairService | undefined {
  const r = ctx.db.get<Row>('SELECT * FROM repair_services WHERE id = ?', [id]);
  return r ? toService(r) : undefined;
}

export const servicePriceText = (price: number | null) =>
  price === null ? 'السعر يحدده المالك' : price === 0 ? 'مجاناً' : formatLyd(price);

/** Adds a service, or changes its name or price (the repairs already taken keep theirs). */
export function saveRepairService(
  ctx: Ctx,
  input: { id?: number; name: string; price: number | null },
): number {
  allow(ctx, 'settings.edit');
  const name = clean(input.name) ?? '';
  if (!name) throw new RuleError('اكتب اسم الخدمة');
  if (name.length > 60) throw new RuleError('اسم الخدمة طويل (60 حرفاً على الأكثر)');
  if (input.price !== null && (!Number.isInteger(input.price) || input.price < 0))
    throw new RuleError('اكتب سعر الخدمة، أو اختر «السعر يحدده المالك»');
  const same = ctx.db.get<{ id: number }>(
    'SELECT id FROM repair_services WHERE active = 1 AND lower(trim(name)) = lower(?) AND id <> ?',
    [name, input.id ?? 0],
  );
  if (same) throw new RuleError(`الخدمة «${name}» موجودة بالفعل`);
  return ctx.db.transaction(() => {
    const stamp = nowStamp(ctx);
    const old = input.id ? getRepairService(ctx, input.id) : undefined;
    if (input.id && (!old || !old.active)) throw new RuleError('الخدمة غير موجودة');
    let id: number;
    if (old) {
      ctx.db.run('UPDATE repair_services SET name = ?, price = ?, updated_at = ? WHERE id = ?', [
        name,
        input.price,
        stamp,
        old.id,
      ]);
      id = old.id;
    } else {
      const next =
        ctx.db.get<{ p: number | null }>('SELECT max(position) p FROM repair_services')?.p ?? 0;
      id = ctx.db.run(
        'INSERT INTO repair_services (name, price, position, created_at) VALUES (?, ?, ?, ?)',
        [name, input.price, next + 1, stamp],
      ).lastInsertRowId;
    }
    logAction(
      ctx,
      'repair.service',
      old
        ? `تعديل خدمة الصيانة «${old.name}»: «${name}» ${servicePriceText(input.price)}${old.price !== input.price ? ` (كانت ${servicePriceText(old.price)})` : ''}`
        : `خدمة صيانة جديدة «${name}»: ${servicePriceText(input.price)}`,
      { serviceId: id, price: input.price, ...(old ? { was: old.price } : {}) },
    );
    return id;
  });
}

/** Takes a service off the list; the repairs that used it keep it. */
export function removeRepairService(ctx: Ctx, id: number) {
  allow(ctx, 'settings.edit');
  const old = getRepairService(ctx, id);
  if (!old || !old.active) throw new RuleError('الخدمة غير موجودة');
  ctx.db.transaction(() => {
    ctx.db.run('UPDATE repair_services SET active = 0, updated_at = ? WHERE id = ?', [
      nowStamp(ctx),
      id,
    ]);
    logAction(ctx, 'repair.service.remove', `حذف خدمة الصيانة «${old.name}» من القائمة`, {
      serviceId: id,
    });
  });
}
