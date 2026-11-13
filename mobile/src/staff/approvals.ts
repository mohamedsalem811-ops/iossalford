/**
 * The owner's approval on the spot (phase S4): on the employee's screen, the owner uses Face ID
 * (the jewelry device, where it is set up) or types the owner PIN. That gives a one-time token
 * for one sale or one return; the business rule uses it up (Ctx.approvals). Tokens live only in
 * memory and expire after two minutes.
 */
import * as Crypto from 'expo-crypto';
import { ActionSheetIOS, Alert } from 'react-native';

import type { ApprovalPurpose } from '@/domain/context';
import { askFaceId, faceIdStatus, pinVault } from '@/security/device';
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
  if ((await faceIdStatus(system)) === 'ready') {
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
