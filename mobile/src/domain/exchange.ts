/**
 * An exchange (phase S4): a returned piece and a new one in one step, under the same return
 * rules. Both are saved or neither; the customer pays the difference, or gets it back.
 */
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { checkout, type CheckoutInput } from './checkout';
import { allow, clean, type Ctx } from './context';
import { moveReferral } from './marketing';
import { addReturn, getReturn, type ReturnInput } from './sales';

export type ExchangeResult = {
  returnId: number;
  saleId: number;
  refund: number;
  total: number;
  /** What the customer pays (positive) or gets back (negative). */
  difference: number;
};

export const differenceText = (difference: number) =>
  difference > 0
    ? `يدفع الزبون الفرق ${formatLyd(difference)}`
    : difference < 0
      ? `يُعاد للزبون ${formatLyd(-difference)}`
      : 'بدون فرق';

export function exchange(
  ctx: Ctx,
  input: { ret: ReturnInput; sale: CheckoutInput },
): ExchangeResult {
  allow(ctx, 'sales.create');
  return ctx.db.transaction(() => {
    const returnId = addReturn(ctx, input.ret, { exchange: true });
    const refund = getReturn(ctx, returnId)!.refund;
    const { saleId, total } = checkout(ctx, {
      ...input.sale,
      // An exchange is not a new purchase: it never uses the visit reward (G2).
      reward: false,
      birthday: false,
      // Nor the I4 gifts: the friend's first-purchase gift or a "we miss you" offer.
      friend: false,
      offer: false,
      gift: undefined,
      // Nor the delivery of a deposit order (that is its own sale, I1).
      orderId: undefined,
      note: clean(input.sale.note) ?? `استبدال (مرتجع رقم ${returnId})`,
    });
    ctx.db.run('UPDATE returns SET exchange_sale_id = ? WHERE id = ?', [saleId, returnId]);
    // A friend's first purchase exchanged in full: her sender keeps the points, and they now
    // follow the new piece (returning that one takes them back).
    const from = ctx.db.get<{ id: number }>('SELECT sale_id id FROM sale_lines WHERE id = ?', [
      input.ret.saleLineId,
    ]);
    if (from) moveReferral(ctx, from.id, saleId);
    const difference = total - refund;
    logAction(
      ctx,
      'exchange.create',
      `استبدال: مرتجع ${formatLyd(refund)} مقابل البيعة رقم ${saleId} بـ ${formatLyd(total)}، ${differenceText(difference)}`,
      { returnId, saleId, refund, total, difference },
    );
    return { returnId, saleId, refund, total, difference };
  });
}
