/**
 * The customer rewards (G1, G2): the visit reward, VIP and the spending ranges an employee sees.
 * Kept as one JSON setting, set by the owner in Settings → الولاء والمكافآت. The visit reward is
 * off until the owner turns it on; VIP and the ranges always apply.
 */
import { formatLyd } from '@/lib/money';

import { getSetting } from './settings';
import type { Ctx } from './context';

export type RewardRules = {
  /** The visit reward is on. */
  enabled: boolean;
  /** When it was last turned on: purchases before this don't count. */
  startedAt: string | null;
  /** A day's purchases count from this much, in dirhams (500 دينار). */
  minPurchase: number;
  /** After this many counted purchases, the next one gets the reward. */
  every: number;
  /** The reward, in percent of the sale. */
  percent: number;
  /** The most the reward takes off, in dirhams (250 دينار). */
  maxOff: number;
  /** The reward is used only on a sale of at least this much, in dirhams (250 دينار). */
  minRewardSale: number;
  /** VIP: spent more than this in the last `vipMonths` months, in dirhams (5,000 دينار). */
  vipSpend: number;
  vipMonths: number;
  /** A VIP earns this many times the points. */
  vipPointsTimes: number;
  /** The spending ranges an employee sees, in dirhams, smallest first. */
  ranges: number[];
};

export const DEFAULT_REWARDS: RewardRules = {
  enabled: false,
  startedAt: null,
  minPurchase: 500_000,
  every: 3,
  percent: 10,
  maxOff: 250_000,
  minRewardSale: 250_000,
  vipSpend: 5_000_000,
  vipMonths: 12,
  vipPointsTimes: 2,
  ranges: [500_000, 1_000_000, 2_000_000, 5_000_000, 10_000_000],
};

export const REWARDS_KEY = 'rewards';

export function getRewards(ctx: Ctx): RewardRules {
  try {
    const saved = JSON.parse(getSetting(ctx, REWARDS_KEY) ?? '{}') as Partial<RewardRules>;
    return { ...DEFAULT_REWARDS, ...saved };
  } catch {
    return DEFAULT_REWARDS;
  }
}

/**
 * What an employee sees instead of the exact total: "أكثر من 2000 د.ل" (the highest range
 * reached), "أقل من 500 د.ل" below the first, or "لا مشتريات".
 */
export function spendRange(amount: number, ranges: readonly number[]): string {
  if (amount <= 0) return 'لا مشتريات';
  const sorted = [...ranges].filter((r) => r > 0).sort((a, b) => a - b);
  const reached = sorted.filter((r) => amount >= r).pop();
  if (reached) return `أكثر من ${formatLyd(reached)}`;
  return sorted.length ? `أقل من ${formatLyd(sorted[0])}` : 'مشتريات سابقة';
}
