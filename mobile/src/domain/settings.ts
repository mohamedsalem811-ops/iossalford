import { allow, RuleError, type Ctx } from './context';

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
  setSetting(ctx, 'exchange_rate', rate);
}
