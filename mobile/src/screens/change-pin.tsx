import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';

import { Page, Text } from '@/components';
import { PinPad } from '@/components/pin-pad';
import { pinProblem, type VerifyResult } from '@/security/pin';
import { spacing, type SystemId } from '@/theme';

import { attemptsLeftText, countdown } from './login';

export type ChangePinDeps = {
  verify: (system: SystemId, pin: string) => Promise<VerifyResult>;
  setPin: (system: SystemId, pin: string) => Promise<void>;
  now?: () => number;
};

type Step = 'current' | 'new' | 'confirm';

const PROMPTS: Record<Step, string> = {
  current: 'أدخل الرمز الحالي',
  new: 'أدخل الرمز الجديد (8 أرقام)',
  confirm: 'أعد إدخال الرمز الجديد',
};

/**
 * Changes the system's PIN: the current PIN first (wrong attempts count towards the lockout, as on
 * the login screen), then the new PIN twice. Easy PINs are refused, and so is the same PIN.
 */
export function ChangePinScreen({
  system,
  deps,
  onDone,
}: {
  system: SystemId;
  deps: ChangePinDeps;
  onDone: () => void;
}) {
  const now = deps.now ?? Date.now;
  const [step, setStep] = useState<Step>('current');
  const [current, setCurrent] = useState('');
  const [first, setFirst] = useState('');
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const fail = (text: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
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
        const r = await deps.verify(system, pin);
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
      const problem = pinProblem(pin);
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
      await deps.setPin(system, pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
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
        disabled={busy}
        error={!!message}
      />
      <Text variant="caption" tone="secondary" center>
        الرمز يحمي هذا النظام فقط، ويُحفظ على هذا الجهاز وحده.
      </Text>
    </Page>
  );
}
