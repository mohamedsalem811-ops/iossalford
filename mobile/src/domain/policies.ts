/**
 * The owner's rules for employees (phase S4), kept per system in its settings, never constants:
 * discount limits in dinars (per piece and per sale), the return window, the return conditions
 * and the ready-made discount reasons. The owner changes them in Settings; every change is logged.
 */
import { formatLyd } from '@/lib/money';
import type { SystemId } from '@/theme';

import { logAction } from './activity';
import { allow, RuleError, type Ctx } from './context';
import { getSetting, setSetting } from './settings';

export type Policies = {
  /** The most an employee may take off one piece's price, in dirhams. */
  discountPerPiece: number;
  /** The most an employee may take off a whole sale, in dirhams. */
  discountPerSale: number;
  /** Hours after the sale in which an employee may take a return. */
  returnHours: number;
  /** Questions answered "yes" for every return ("الملصق سليم"). */
  returnConditions: string[];
  /** Ready-made reasons for a discount the owner approves. */
  discountReasons: string[];
  /** The quick discount buttons at checkout, in percent of the sale (feature 10). */
  quickDiscounts: number[];
  /** Alerts (phase S6). An alert when one person gives this many discounted sales in a day (0: off). */
  alertDiscounts: number;
  /** …asks for this many owner approvals in a day (0: off). */
  alertApprovals: number;
  /** A return taken within this many minutes of its sale (0: off). */
  alertReturnMinutes: number;
  /** This many wrong PINs by one person in a day (0: off). */
  alertWrongPins: number;
  /** A shift short by at least this much, in dirhams (0: any shortage). */
  alertShortage: number;
  /** How many days back the alerts look. */
  alertDays: number;
};

export const DEFAULT_CONDITIONS: Record<SystemId, string[]> = {
  jewelry: ['ملصق الضمان سليم', 'القطعة لم تُلبس'],
  scarves: ['لم يُلبس', 'لم يُغسل', 'بدون رائحة عطر', 'في تغليفه الأصلي'],
};

export const DEFAULT_REASONS = ['زبون دائم', 'عرض', 'عيب بسيط', 'كمية كبيرة'];

/** Until the owner sets them: no discount without approval, returns within 24 hours. */
export function defaultPolicies(system: SystemId): Policies {
  return {
    discountPerPiece: 0,
    discountPerSale: 0,
    returnHours: 24,
    returnConditions: DEFAULT_CONDITIONS[system],
    discountReasons: DEFAULT_REASONS,
    quickDiscounts: [3],
    alertDiscounts: 3,
    alertApprovals: 3,
    alertReturnMinutes: 30,
    alertWrongPins: 3,
    alertShortage: 0,
    alertDays: 7,
  };
}

/** The alert limits, for the rules screen. */
export const ALERT_LIMITS = [
  'alertDiscounts',
  'alertApprovals',
  'alertReturnMinutes',
  'alertWrongPins',
  'alertShortage',
  'alertDays',
] as const;

const KEY = 'policies';

export function getPolicies(ctx: Ctx): Policies {
  const base = defaultPolicies(ctx.system);
  try {
    const saved = JSON.parse(getSetting(ctx, KEY) ?? '{}') as Partial<Policies>;
    return { ...base, ...saved };
  } catch {
    return base;
  }
}

const cleanList = (items: string[]) => [
  ...new Set(items.map((s) => s.trim().replace(/\s+/g, ' ')).filter(Boolean)),
];

/** The owner changes the rules; each change is one log line saying what changed. */
export function setPolicies(ctx: Ctx, changes: Partial<Policies>): Policies {
  allow(ctx, 'settings.edit');
  const old = getPolicies(ctx);
  const next: Policies = { ...old, ...changes };
  for (const k of ['discountPerPiece', 'discountPerSale'] as const) {
    if (!Number.isInteger(next[k]) || next[k] < 0)
      throw new RuleError('حد الخصم يجب أن يكون صفراً أو أكثر');
  }
  if (!Number.isInteger(next.returnHours) || next.returnHours < 1 || next.returnHours > 24 * 30)
    throw new RuleError('مدة الإرجاع بين ساعة و30 يوماً');
  for (const k of ALERT_LIMITS) {
    if (!Number.isInteger(next[k]) || next[k] < 0)
      throw new RuleError('حدود التنبيهات أرقام صحيحة، صفر أو أكثر');
  }
  if (next.alertDays < 1 || next.alertDays > 60)
    throw new RuleError('مدة التنبيهات بين يوم و60 يوماً');
  next.quickDiscounts = [...new Set(next.quickDiscounts)].sort((a, b) => a - b);
  if (next.quickDiscounts.some((p) => !Number.isInteger(p) || p < 1 || p > 50))
    throw new RuleError('نسبة الخصم السريع رقم صحيح من 1 إلى 50');
  if (next.quickDiscounts.length > 4) throw new RuleError('أربع نسب للخصم السريع على الأكثر');
  next.returnConditions = cleanList(next.returnConditions);
  next.discountReasons = cleanList(next.discountReasons);
  if (next.returnConditions.length === 0)
    throw new RuleError('أبقِ شرطاً واحداً على الأقل للإرجاع');
  const said: string[] = [];
  if (next.discountPerPiece !== old.discountPerPiece)
    said.push(`حد خصم القطعة ${formatLyd(next.discountPerPiece)}`);
  if (next.discountPerSale !== old.discountPerSale)
    said.push(`حد خصم البيعة ${formatLyd(next.discountPerSale)}`);
  if (next.quickDiscounts.join('|') !== old.quickDiscounts.join('|'))
    said.push(
      next.quickDiscounts.length
        ? `الخصم السريع: ${next.quickDiscounts.map((p) => `${p}%`).join('، ')}`
        : 'الخصم السريع متوقف',
    );
  if (next.returnHours !== old.returnHours) said.push(`مدة الإرجاع ${next.returnHours} ساعة`);
  if (next.returnConditions.join('|') !== old.returnConditions.join('|'))
    said.push(`شروط الإرجاع: ${next.returnConditions.join('، ')}`);
  if (next.discountReasons.join('|') !== old.discountReasons.join('|'))
    said.push(`أسباب الخصم: ${next.discountReasons.join('، ')}`);
  const alertText: Record<(typeof ALERT_LIMITS)[number], (v: number) => string> = {
    alertDiscounts: (v) => `تنبيه الخصومات ${v || 'متوقف'}`,
    alertApprovals: (v) => `تنبيه الموافقات ${v || 'متوقف'}`,
    alertReturnMinutes: (v) => `تنبيه المرتجع السريع ${v ? `${v} دقيقة` : 'متوقف'}`,
    alertWrongPins: (v) => `تنبيه الرمز الخطأ ${v || 'متوقف'}`,
    alertShortage: (v) => `تنبيه العجز من ${formatLyd(v)}`,
    alertDays: (v) => `مدة التنبيهات ${v} يوم`,
  };
  for (const k of ALERT_LIMITS) if (next[k] !== old[k]) said.push(alertText[k](next[k]));
  if (said.length === 0) return old;
  ctx.db.transaction(() => {
    setSetting(ctx, KEY, JSON.stringify(next));
    logAction(ctx, 'policies.set', said.join('؛ '), { from: old, to: next });
  });
  return next;
}
