/** The stock adjustment sheet: direction, quantity, reason, and the history's labels. */
import { parseInteger } from '@/lib/digits';

export type Direction = 'add' | 'remove';

/** Quick reasons, one tap each; anything else can be typed. */
export const REASONS: Record<Direction, string[]> = {
  add: ['توريد جديد', 'جرد: وُجدت قطع زائدة', 'مرتجع من المعرض'],
  remove: ['كسر أو تلف', 'جرد: قطع ناقصة', 'إرجاع للمورد', 'هدية أو عينة'],
};

/** The signed change, or null while the quantity is not a positive whole number. */
export function stockDelta(direction: Direction, quantity: string): number | null {
  const n = parseInteger(quantity);
  if (n === null || n <= 0) return null;
  return direction === 'add' ? n : -n;
}

export type StockCheck =
  { ok: true; delta: number; after: number } | { ok: false; message: string };

/** Checks the sheet before saving; the message says what is missing. */
export function checkAdjustment(
  current: number,
  direction: Direction,
  quantity: string,
  reason: string,
): StockCheck {
  const delta = stockDelta(direction, quantity);
  if (delta === null) return { ok: false, message: 'أدخل الكمية (رقم أكبر من 0)' };
  if (current + delta < 0)
    return { ok: false, message: `المتوفر ${current} فقط، لا يمكن إنقاص ${-delta}` };
  if (!reason.trim()) return { ok: false, message: 'اختر أو اكتب سبب تعديل المخزون' };
  return { ok: true, delta, after: current + delta };
}

/** What each kind of stock movement is called in the history. */
export const MOVE_LABELS: Record<string, string> = {
  initial: 'المخزون الأول',
  adjust: 'تعديل يدوي',
  sale: 'بيع',
  return: 'مرتجع',
  sale_deleted: 'حذف عملية بيع',
  return_deleted: 'حذف مرتجع',
};

export const moveLabel = (kind: string) => MOVE_LABELS[kind] ?? kind;

/** "+3" / "−1", with a real minus sign. */
export const signed = (delta: number) => (delta > 0 ? `+${delta}` : `−${-delta}`);
