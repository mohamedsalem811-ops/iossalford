/**
 * Pieces held for a customer by a deposit order (I1): a piece in stock held for her (حجز), or an
 * ordered piece that arrived and waits for her. Available to sell = stock − reserved; the piece
 * itself can't be sold to anyone else, and an ordered piece can't be edited, archived or deleted
 * until it is delivered or the order is cancelled. Kept apart from orders.ts so products.ts and
 * cart checks can read it without a loop between the files.
 */
import { RuleError, type Ctx } from './context';

/** Order statuses that hold a product for the customer. */
export const HOLDING = "('held', 'arrived')";

/** How many pieces of each product are held, for the products given (all when left out). */
export function reservedCounts(ctx: Ctx, productIds?: number[]): Map<number, number> {
  const out = new Map<number, number>();
  if (productIds && productIds.length === 0) return out;
  const ids = productIds ? [...new Set(productIds)] : [];
  for (let i = 0; i < Math.max(1, ids.length); i += 500) {
    const chunk = ids.slice(i, i + 500);
    const rows = ctx.db.all<{ id: number; n: number }>(
      `SELECT product_id id, sum(quantity) n FROM orders
        WHERE status IN ${HOLDING} AND product_id IS NOT NULL
        ${productIds ? `AND product_id IN (${chunk.map(() => '?').join(', ')})` : ''}
        GROUP BY product_id`,
      chunk,
    );
    for (const r of rows) out.set(r.id, r.n);
  }
  return out;
}

export const reservedOf = (ctx: Ctx, productId: number, exceptOrder?: number): number =>
  ctx.db.get<{ n: number }>(
    `SELECT coalesce(sum(quantity), 0) n FROM orders
      WHERE status IN ${HOLDING} AND product_id = ? AND id <> ?`,
    [productId, exceptOrder ?? 0],
  )?.n ?? 0;

/** The open order a product was made for (an ordered piece that arrived), if any. */
export function madeForOrder(
  ctx: Ctx,
  productId: number,
): { id: number; customer: string } | undefined {
  return ctx.db.get<{ id: number; customer: string }>(
    `SELECT o.id, c.name customer FROM orders o JOIN customers c ON c.id = o.customer_id
      WHERE o.product_id = ? AND o.kind = 'order' AND o.status = 'arrived' LIMIT 1`,
    [productId],
  );
}

/** Refuses changing a piece that waits for its customer (an ordered piece that arrived). */
export function refuseIfOrdered(ctx: Ctx, productId: number) {
  const o = madeForOrder(ctx, productId);
  if (o)
    throw new RuleError(
      `القطعة محجوزة لـ «${o.customer}» (طلب رقم ${o.id}): لا تُعدّل ولا تُحذف حتى تُسلّم أو يُلغى الطلب.`,
    );
}

/** Refuses taking stock under what is held for customers. */
export function refuseUnderReserved(ctx: Ctx, productId: number, newStock: number) {
  const held = reservedOf(ctx, productId);
  if (newStock < held)
    throw new RuleError(
      `${held === 1 ? 'قطعة محجوزة' : `${held} قطع محجوزة`} لزبائن بعربون: لا يقل المخزون عن ${held}.`,
    );
}
