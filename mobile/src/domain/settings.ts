import { allow, RuleError, type Ctx } from './context';
import { logAction } from './activity';
import { formatRate } from '@/lib/money';

/** 7.000 LYD per USD until the owner sets the real rate (same default as the current app). */
export const DEFAULT_RATE = 7_000;

export function getSetting(ctx: Ctx, key: string): string | undefined {
  return ctx.db.get<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key])?.value;
}

export function setSetting(ctx: Ctx, key: string, value: string | number) {
  ctx.db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)],
  );
}

/** Exchange rate in thousandths of a dinar per dollar (7.125 = 7125). */
export function getRate(ctx: Ctx): number {
  const v = Number(getSetting(ctx, 'exchange_rate'));
  return Number.isInteger(v) && v > 0 ? v : DEFAULT_RATE;
}

export function setRate(ctx: Ctx, rate: number) {
  allow(ctx, 'settings.edit');
  if (!Number.isInteger(rate) || rate <= 0)
    throw new RuleError('سعر الصرف يجب أن يكون أكبر من صفر');
  ctx.db.transaction(() => {
    const old = getRate(ctx);
    setSetting(ctx, 'exchange_rate', rate);
    logAction(ctx, 'rate.set', `سعر الصرف من ${formatRate(old)} إلى ${formatRate(rate)}`, {
      from: old,
      to: rate,
    });
  });
}

/**
 * The owner switched Face ID on or off for the jewelry system (audit 1). The choice itself is
 * kept in the Keychain (security/device.ts); this checks who and writes the log line.
 */
export function recordFaceIdChoice(ctx: Ctx, on: boolean) {
  allow(ctx, 'settings.edit');
  ctx.db.transaction(() =>
    logAction(ctx, 'settings.faceid', on ? 'تشغيل الدخول بـ Face ID' : 'إيقاف الدخول بـ Face ID', {
      on,
    }),
  );
}

/** The owner set or changed one of the codes given to employees (logged; never the code). */
export function recordCodeChange(ctx: Ctx, code: 'credit' | 'invoice', first: boolean) {
  allow(ctx, 'settings.edit');
  const name = code === 'credit' ? 'رمز الآجل' : 'رمز الفواتير';
  ctx.db.transaction(() =>
    logAction(ctx, 'settings.code', `${first ? 'ضبط' : 'تغيير'} ${name}`, { code }),
  );
}
