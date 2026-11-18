/**
 * An exchange (phase S4): a returned piece and a new one in one step, under the same return
 * rules. Both are saved or neither; the customer pays the difference, or gets it back.
 *
 * Only the difference moves, the one way chosen for the new piece (J2, fixed in the phase J
 * check): the returned piece's money goes back that same way, so a card sale exchanged with the
 * difference paid in cash puts only the difference in the drawer. A sale on credit stays on her
 * account: the return comes off her debt and the new piece goes on it.
 */
import { formatLyd } from '@/lib/money';

import { logAction } from './activity';
import { checkout, type CheckoutInput } from './checkout';
import { allow, clean, RuleError, type Ctx } from './context';
import { getCustomer } from './customers';
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
    const was = ctx.db.get<{
      payment_method: CheckoutInput['paymentMethod'];
      customer_id: number | null;
    }>(
      'SELECT s.payment_method, s.customer_id FROM sales s JOIN sale_lines l ON l.sale_id = s.id WHERE l.id = ?',
      [input.ret.saleLineId],
    );
    if (!was) throw new RuleError('البيعة غير موجودة');
    const onCredit = was.payment_method === 'credit';
    const herself = onCredit && was.customer_id ? getCustomer(ctx, was.customer_id) : undefined;
    if (!onCredit && input.sale.paymentMethod === 'credit')
      throw new RuleError('الاستبدال بالآجل لبيعة آجل فقط');
    const paidBy = onCredit ? 'credit' : input.sale.paymentMethod;
    const returnId = addReturn(
      ctx,
      { ...input.ret, refundMethod: onCredit ? 'debt' : (paidBy as 'cash' | 'card' | 'transfer') },
      { exchange: true },
    );
    const refund = getReturn(ctx, returnId)!.refund;
    const { saleId, total } = checkout(ctx, {
      ...input.sale,
      paymentMethod: paidBy,
      ...(herself ? { customer: { name: herself.name, phone: herself.phone ?? undefined } } : {}),
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
