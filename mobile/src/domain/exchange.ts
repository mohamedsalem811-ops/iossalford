/**
 * An exchange (phase S4): a returned piece and a new one in one step, under the same return
 * rules. Both are saved or neither; the customer pays the difference, or gets it back.
 */
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { checkout, type CheckoutInput } from './checkout';
import { allow, clean, type Ctx } from './context';
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
    const returnId = addReturn(ctx, input.ret);
    const refund = getReturn(ctx, returnId)!.refund;
    const { saleId, total } = checkout(ctx, {
      ...input.sale,
      // An exchange is not a new purchase: it never uses the visit reward (G2).
      reward: false,
      birthday: false,
      note: clean(input.sale.note) ?? `استبدال (مرتجع رقم ${returnId})`,
    });
    ctx.db.run('UPDATE returns SET exchange_sale_id = ? WHERE id = ?', [saleId, returnId]);
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
