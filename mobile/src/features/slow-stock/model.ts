/**
 * What the slow-stock screen shows (J5), apart from the screen so it can be tested.
 */
import type { SlowRow } from '@/domain/slow-stock';
import { formatLyd } from '@/lib/money';

/** "لم تُبع منذ 95 يوماً" or "لم تُبع قط منذ وصولها قبل 120 يوماً". */
export const idleText = (r: Pick<SlowRow, 'days' | 'lastSold'>) =>
  r.lastSold ? `آخر بيع قبل ${r.days} يوماً` : `لم تُبع منذ وصولها قبل ${r.days} يوماً`;

/** "3 قطع × 40 د.ل • السعر 100 د.ل" */
export const slowRowLine = (r: Pick<SlowRow, 'stock' | 'cost' | 'price'>) =>
  `${r.stock} × ${formatLyd(r.cost)} • السعر ${formatLyd(r.price)}`;
