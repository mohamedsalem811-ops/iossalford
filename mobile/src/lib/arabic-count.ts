/**
 * A number with its counted word in correct Arabic: "شهر"، "شهرين"، "6 أشهر"، "12 شهراً". Used on
 * the rewards card, the receipts and the settings, where the owner's numbers can be anything.
 */
export type CountWords = {
  /** For 1, without the number: "شهر". */
  one: string;
  /** For 2, without the number: "شهرين". */
  two: string;
  /** For 3 to 10 (plural): "أشهر". */
  few: string;
  /** For 11 and more (singular, accusative): "شهراً". */
  many: string;
};

export function countText(n: number, w: CountWords): string {
  if (n === 1) return w.one;
  if (n === 2) return w.two;
  const rest = n % 100;
  return `${n} ${rest >= 3 && rest <= 10 ? w.few : w.many}`;
}

/** "خلال 6 أشهر". */
export const MONTHS: CountWords = { one: 'شهر', two: 'شهرين', few: 'أشهر', many: 'شهراً' };
/** "بعد 3 مشتريات". */
export const PURCHASES: CountWords = {
  one: 'شراء واحد',
  two: 'شراءين',
  few: 'مشتريات',
  many: 'شراءً',
};
/** "بقي 3 مشتريات" (the subject of the sentence). */
export const PURCHASES_LEFT: CountWords = { ...PURCHASES, two: 'شراءان' };
/** "بعد 3 أيام". */
export const DAYS: CountWords = { one: 'يوم', two: 'يومين', few: 'أيام', many: 'يوماً' };
