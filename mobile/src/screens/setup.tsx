import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { View } from 'react-native';

import { Logo, Screen, Text } from '@/components';
import { PinPad } from '@/components/pin-pad';
import { pinProblem } from '@/security/pin';
import { spacing, ThemeProvider, type SystemId } from '@/theme';

const ORDER: SystemId[] = ['jewelry', 'scarves'];
const NAMES: Record<SystemId, string> = { jewelry: 'نظام المجوهرات', scarves: 'نظام الأوشحة' };

/**
 * First launch: the owner creates the PIN of each system (entered twice). There is no default PIN.
 * Only `systems` that have no PIN yet are asked for, so a PIN already saved can't be replaced here
 * if setup was interrupted. `savePin` stores it; `onDone` runs once all are saved.
 */
export function SetupScreen({
  systems = ORDER,
  savePin,
  onDone,
}: {
  systems?: SystemId[];
  savePin: (system: SystemId, pin: string) => Promise<void>;
  onDone: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [first, setFirst] = useState<string | null>(null);
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const system = systems[index];
  const confirming = first !== null;

  const fail = (text: string) => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    setMessage(text);
    setValue('');
  };

  const complete = async (pin: string) => {
    if (!confirming) {
      const problem = pinProblem(pin);
      if (problem) return fail(problem);
      setFirst(pin);
      setMessage(null);
      setValue('');
      return;
    }
    if (pin !== first) {
      setFirst(null);
      return fail('الرمزان غير متطابقين، أدخل الرمز من جديد');
    }
    setBusy(true);
    try {
      await savePin(system, pin);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      setFirst(null);
      setValue('');
      setMessage(null);
      if (index + 1 < systems.length) setIndex(index + 1);
      else onDone();
    } catch (e) {
      setFirst(null);
      fail(e instanceof Error ? e.message : 'تعذر حفظ الرمز');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ThemeProvider system={system}>
      <Screen contentStyle={{ alignItems: 'center', gap: spacing.lg }}>
        <Text variant="caption" tone="secondary" center>
          {`الخطوة ${index + 1} من ${systems.length}`}
        </Text>
        <Logo system={system} width={150} />
        <View style={{ gap: spacing.xs, alignItems: 'center' }}>
          <Text variant="title" center>
            {confirming ? 'أكّد الرمز' : `أنشئ رمز ${NAMES[system]}`}
          </Text>
          <Text variant="subhead" tone={message ? 'warning' : 'secondary'} center>
            {message ??
              (confirming ? 'أدخل الرمز نفسه مرة أخرى' : '8 أرقام تختارها أنت، لا تشاركها مع أحد')}
          </Text>
        </View>
        <PinPad
          value={value}
          onChange={setValue}
          onComplete={complete}
          disabled={busy}
          error={!!message}
        />
      </Screen>
    </ThemeProvider>
  );
}
