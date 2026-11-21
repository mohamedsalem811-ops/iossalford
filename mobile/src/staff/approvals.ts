/**
 * The owner's approval on the spot (phase S4): on the employee's screen, the owner uses Face ID
 * (the jewelry device, where it is set up) or types the owner PIN. That gives a one-time token
 * for one sale or one return; the business rule uses it up (Ctx.approvals). Tokens live only in
 * memory and expire after two minutes.
 */
import * as Crypto from 'expo-crypto';
import { ActionSheetIOS, Alert } from 'react-native';

import { recordCodeUse } from '@/domain/activity';
import type { ApprovalPurpose, Ctx } from '@/domain/context';
import { latinDigits } from '@/lib/digits';
import { askFaceId, faceIdStatus, pinVault } from '@/security/device';
import type { OwnerCode } from '@/security/pin';
import { CODE_TITLES } from '@/features/settings/owner-codes';
import type { SystemId } from '@/theme';

const LIFETIME_MS = 2 * 60_000;
const tokens = new Map<string, { purpose: ApprovalPurpose; at: number }>();

function grant(purpose: ApprovalPurpose): string {
  const token = Crypto.randomUUID();
  tokens.set(token, { purpose, at: Date.now() });
  return token;
}

/** Uses up a token: true once, for its purpose, within its lifetime. */
export function takeApproval(token: string, purpose: ApprovalPurpose): boolean {
  const t = tokens.get(token);
  tokens.delete(token);
  return !!t && t.purpose === purpose && Date.now() - t.at <= LIFETIME_MS;
}

const prompt = (title: string, message: string) =>
  new Promise<string | null>((resolve) =>
    Alert.prompt(
      title,
      message,
      [
        { text: 'إلغاء', style: 'cancel', onPress: () => resolve(null) },
        { text: 'موافقة', onPress: (v?: string) => resolve(v ?? '') },
      ],
      'secure-text',
      '',
      'number-pad',
    ),
  );

/**
 * Asks the owner, on this screen, to approve `what` ("خصم 20 د.ل على البيعة"). Returns the
 * one-time token, or null when the owner said no, cancelled or the PIN was wrong (a wrong PIN
 * counts toward the owner's lockout, like at sign-in).
 */
export async function askOwner(
  system: SystemId,
  purpose: ApprovalPurpose,
  what: string,
): Promise<string | null> {
  // Face ID only when the owner switched it on, and never during the owner's PIN lockout.
  if ((await faceIdStatus(system)) === 'ready' && !(await pinVault.lockedUntil(system))) {
    const r = await askFaceId();
    if (r.ok) return grant(purpose);
  }
  const pin = await prompt('موافقة المالك', `${what}\nيكتب المالك رمزه للموافقة.`);
  if (pin === null) return null;
  const r = await pinVault.verify(system, pin);
  if (r.ok) return grant(purpose);
  Alert.alert(
    'لم تتم الموافقة',
    'lockedUntil' in r && r.lockedUntil ? 'محاولات خاطئة كثيرة، جرّب لاحقاً.' : 'رمز المالك خاطئ.',
  );
  return null;
}

/**
 * The reason, from the owner's list or typed ("سبب آخر"). Null when cancelled.
 */
export function chooseReason(title: string, reasons: string[]): Promise<string | null> {
  return new Promise((resolve) => {
    const options = [...reasons, 'سبب آخر…', 'إلغاء'];
    ActionSheetIOS.showActionSheetWithOptions(
      { title, options, cancelButtonIndex: options.length - 1 },
      (i) => {
        if (i < reasons.length) return resolve(reasons[i]);
        if (i === reasons.length)
          return Alert.prompt(
            title,
            undefined,
            [
              { text: 'إلغاء', style: 'cancel', onPress: () => resolve(null) },
              { text: 'تم', onPress: (v?: string) => resolve(v?.trim() ? v.trim() : null) },
            ],
            'plain-text',
          );
        resolve(null);
      },
    );
  });
}

/**
 * Asks the employee for one of the owner's 4-digit codes (rule B, the original invoices): the
 * owner gives it when needed. Returns a one-time token for that purpose, or null. Every try is
 * logged; wrong codes count toward the code's lockout, like a PIN.
 */
export async function askCode(ctx: Ctx, code: OwnerCode, what: string): Promise<string | null> {
  const account = `code.${code}` as const;
  if (!(await pinVault.hasPin(account))) {
    Alert.alert(CODE_TITLES[code], 'لم يضبط المالك هذا الرمز بعد. يضبطه من الإعدادات.');
    return null;
  }
  const typed = await prompt(CODE_TITLES[code], `${what}\nاكتب الرمز الذي أعطاك إياه المالك.`);
  if (typed === null) return null;
  const r = await pinVault.verify(account, latinDigits(typed).trim());
  const who = ctx.actor;
  if (who && !('locked' in r))
    try {
      recordCodeUse(ctx, who, code, r.ok, what);
    } catch {
      // The log line must never stop the counter.
    }
  if (r.ok) return grant(code);
  Alert.alert(
    'لم يُقبل الرمز',
    'lockedUntil' in r && r.lockedUntil ? 'محاولات خاطئة كثيرة، جرّب لاحقاً.' : 'الرمز خاطئ.',
  );
  return null;
}
