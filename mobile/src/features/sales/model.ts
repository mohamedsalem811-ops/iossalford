/** Pure rules of the sales history, the sale details and the return form. */
import type { SaleLine } from '@/domain/sales';
import { maxRefund } from '@/domain/sales';
import { parseThousandths } from '@/lib/digits';

/** Months that have sales, newest first. */
export const monthsOf = (items: { month: string }[]) =>
  [...new Set(items.map((i) => i.month))].sort().reverse();

type Lines = { lines: Pick<SaleLine, 'name' | 'quantity' | 'returned'>[] };

export const salePieces = (s: Lines) => s.lines.reduce((t, l) => t + l.quantity, 0);
export const saleReturned = (s: Lines) => s.lines.reduce((t, l) => t + l.returned, 0);

/** The lines in one row of the history: "Ring × 2، Chain". */
export function saleSummary(s: Lines): string {
  return s.lines.map((l) => (l.quantity > 1 ? `${l.name} × ${l.quantity}` : l.name)).join('، ');
}

/** Pieces of a line that can still come back. */
export const returnable = (l: Pick<SaleLine, 'quantity' | 'returned'>) =>
  Math.max(0, l.quantity - l.returned);

/** Ready-made reasons for a return; any reason can be typed. */
export const RETURN_REASONS = ['عيب في القطعة', 'تغيير رأي', 'المقاس', 'استبدال'];

/**
 * The return form: the refund as typed (empty means what the customer paid), never more than
 * that.
 */
export function checkReturn(
  line: Pick<SaleLine, 'lineTotal' | 'quantity'> | null,
  quantity: number,
  refundText: string,
): { ok: true; refund: number | undefined } | { ok: false; message: string } {
  const typed = refundText.trim() ? parseThousandths(refundText) : null;
  if (refundText.trim() && typed === null) return { ok: false, message: 'مبلغ الاسترداد غير صحيح' };
  if (!line) {
    if (typed === null) return { ok: false, message: 'اكتب المبلغ الذي أُعيد للزبون' };
    return { ok: true, refund: typed };
  }
  const max = maxRefund(line, quantity);
  if (typed !== null && typed > max)
    return { ok: false, message: 'لا يمكن أن يتجاوز الاسترداد ما دفعه الزبون' };
  return { ok: true, refund: typed ?? undefined };
}
