import { useState } from 'react';
import { View } from 'react-native';

import { Page, Text } from '@/components';
import { PinPad } from '@/components/pin-pad';
import { pinLengthOf, pinProblem, type PinAccount, type VerifyResult } from '@/security/pin';
import { spacing } from '@/theme';

import { attemptsLeftText, countdown } from './login';
import { haptic } from '@/lib/haptics';

export type ChangePinDeps = {
  verify: (account: PinAccount, pin: string) => Promise<VerifyResult>;
  setPin: (account: PinAccount, pin: string) => Promise<void>;
  now?: () => number;
};

type Step = 'current' | 'new' | 'confirm';

const prompts = (length: number): Record<Step, string> => ({
  current: 'أدخل الرمز الحالي',
  new: `أدخل الرمز الجديد (${length} أرقام)`,
  confirm: 'أعد إدخال الرمز الجديد',
});

/**
 * Changes a PIN: the current PIN first (wrong attempts count towards the lockout, as on the login
 * screen), then the new PIN twice. Easy PINs are refused, and so is the same PIN. With
 * `skipCurrent` (an employee's first sign-in, or after the owner's emergency code) it starts at
 * the new PIN.
 */
export function ChangePinScreen({
  account,
  deps,
  onDone,
  skipCurrent = false,
  note = 'الرمز يحمي هذا النظام فقط، ويُحفظ على هذا الجهاز وحده.',
}: {
  account: PinAccount;
  deps: ChangePinDeps;
  onDone: () => void;
  skipCurrent?: boolean;
  /** The line under the keypad. */
  note?: string;
}) {
  const length = pinLengthOf(account);
  const PROMPTS = prompts(length);
  const now = deps.now ?? Date.now;
  const [step, setStep] = useState<Step>(skipCurrent ? 'new' : 'current');
  const [current, setCurrent] = useState('');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (text: string) => {
    haptic.error();
    setMessage(text);
    setValue('');
  };
  const next = (s: Step) => {
    setStep(s);
    setMessage(null);
    setValue('');
  };

  const complete = async (pin: string) => {
    if (step === 'current') {
      setBusy(true);
      try {
        const r = await deps.verify(account, pin);
        if (r.ok) {
          setCurrent(pin);
          return next('new');
        }
        if ('locked' in r || r.lockedUntil) {
          return fail(`محاولات خاطئة كثيرة — حاول بعد ${countdown(r.lockedUntil - now())}`);
        }
        return fail(`رمز خاطئ، بقيت ${attemptsLeftText(r.attemptsLeft)} قبل القفل المؤقت`);
      } finally {
        setBusy(false);
      }
    }
    if (step === 'new') {
      const problem = pinProblem(pin, length);
      if (problem) return fail(problem);
      if (pin === current) return fail('الرمز الجديد يجب أن يختلف عن الحالي');
      setFirst(pin);
      return next('confirm');
    }
    if (pin !== first) {
      setFirst('');
      setStep('new');
      return fail('الرمزان غير متطابقين، أدخل الرمز الجديد من جديد');
    }
    setBusy(true);
    try {
      await deps.setPin(account, pin);
      haptic.success();
      onDone();
    } catch {
      fail('تعذّر حفظ الرمز، لم يتغير شيء');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page contentStyle={{ alignItems: 'center', gap: spacing.lg }}>
      <View style={{ gap: spacing.xs, alignItems: 'center', paddingTop: spacing.md }}>
        <Text
          variant="subhead"
          tone={message ? 'warning' : 'secondary'}
          center
          testID="change-pin-message">
          {message ?? PROMPTS[step]}
        </Text>
      </View>
      <PinPad
        value={value}
        onChange={setValue}
        onComplete={complete}
        length={length}
        disabled={busy}
        error={!!message}
      />
      <Text variant="caption" tone="secondary" center>
        {note}
      </Text>
    </Page>
  );
}
