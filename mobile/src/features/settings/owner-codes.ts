/**
 * The owner sets or changes the 4-digit codes given to employees when needed (Settings): the
 * credit code (rule B) and the invoice code. Typed twice; kept hashed in the Keychain; the old
 * code stops working at once. Logged, never the code itself.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert } from 'react-native';

import type { SystemId } from '@/theme';
import type { Ctx } from '@/domain/context';
import { recordCodeChange } from '@/domain/settings';
import { haptic } from '@/lib/haptics';
import { latinDigits } from '@/lib/digits';
import { pinVault } from '@/security/device';
import { CODE_LENGTH, pinProblem, type OwnerCode } from '@/security/pin';

export const CODE_TITLES: Record<OwnerCode, string> = {
  credit: 'رمز الآجل',
  invoice: 'رمز الفواتير',
};

const ask = (title: string, message: string) =>
  new Promise<string | null>((resolve) =>
    Alert.prompt(
      title,
      message,
      [
        { text: 'إلغاء', style: 'cancel', onPress: () => resolve(null) },
        { text: 'التالي', onPress: (v?: string) => resolve(latinDigits(v ?? '').trim()) },
      ],
      'secure-text',
      '',
      'number-pad',
    ),
  );

/** Whether a code has been set (for the Settings row). */
export const hasCode = (code: OwnerCode) => pinVault.hasPin(`code.${code}`);

export async function setCodeFlow(ctx: Ctx, code: OwnerCode, onDone: () => void) {
  const title = CODE_TITLES[code];
  const first = !(await hasCode(code));
  const typed = await ask(
    first ? title : `${title} جديد`,
    `${CODE_LENGTH} أرقام تعطيها للموظف عند الحاجة، وتغيّرها متى شئت. ${first ? '' : 'الرمز القديم يتوقف فوراً.'}`,
  );
  if (typed === null) return;
  const problem = pinProblem(typed, CODE_LENGTH);
  if (problem) return Alert.alert('لم يتم الحفظ', problem);
  const again = await ask(title, 'اكتب الرمز مرة أخرى للتأكيد.');
  if (again === null) return;
  if (again !== typed) return Alert.alert('لم يتم الحفظ', 'الرمزان غير متطابقين.');
  try {
    recordCodeChange(ctx, code, first);
    await pinVault.setPin(`code.${code}`, typed);
  } catch (error) {
    return Alert.alert('لم يتم الحفظ', error instanceof Error ? error.message : 'تعذّر الحفظ');
  }
  haptic.success();
  onDone();
}

/** The codes this system uses: credit in both, the invoice code in jewelry only. */
export const codesOf = (system: SystemId): OwnerCode[] =>
  system === 'jewelry' ? ['credit', 'invoice'] : ['credit'];

/** The Settings rows for the owner's codes: whether each is set, and setting or changing it. */
export function useOwnerCodes(ctx: Ctx) {
  const [set, setSet] = useState<Partial<Record<OwnerCode, boolean>>>({});
  const read = useCallback(() => {
    let cancelled = false;
    Promise.all(codesOf(ctx.system).map(async (c) => [c, await hasCode(c)] as const)).then(
      (pairs) => !cancelled && setSet(Object.fromEntries(pairs)),
    );
    return () => {
      cancelled = true;
    };
  }, [ctx.system]);
  useEffect(read, [read]);
  return codesOf(ctx.system).map((code) => ({
    code,
    title: CODE_TITLES[code],
    set: !!set[code],
    onPress: () => void setCodeFlow(ctx, code, read),
  }));
}
