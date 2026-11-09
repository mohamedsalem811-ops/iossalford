import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, Logo, Screen, Text } from '@/components';
import { PinPad } from '@/components/pin-pad';
import type { VerifyResult } from '@/security/pin';
import { spacing, type SystemId } from '@/theme';

const NAMES: Record<SystemId, string> = { jewelry: 'نظام المجوهرات', scarves: 'نظام الأوشحة' };

/** "0:30", "2:00": minutes and seconds left, digits 0-9. */
export function countdown(ms: number): string {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "محاولة واحدة", "محاولتان", "3 محاولات". */
export function attemptsLeftText(n: number): string {
  if (n === 1) return 'محاولة واحدة';
  if (n === 2) return 'محاولتان';
  return `${n} محاولات`;
}

export type LoginDeps = {
  verify: (system: SystemId, pin: string) => Promise<VerifyResult>;
  lockedUntil: (system: SystemId) => Promise<number>;
  faceIdAvailable: (system: SystemId) => Promise<boolean>;
  askFaceId: () => Promise<boolean>;
  clearFailures: (system: SystemId) => Promise<void>;
  now?: () => number;
};

/**
 * Opens a system. Jewelry asks for Face ID first when it is set up on the device; the PIN always
 * works. Wrong PINs show how many attempts are left; a lockout disables the keypad and counts down.
 */
export function LoginScreen({
  system,
  deps,
  onUnlock,
  onBack,
  active = true,
}: {
  system: SystemId;
  deps: LoginDeps;
  onUnlock: () => void;
  onBack: () => void;
  /** False while the app is hidden (background, app switcher). */
  active?: boolean;
}) {
  const now = deps.now ?? Date.now;
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [until, setUntil] = useState(0);
  const [left, setLeft] = useState(0);
  const [faceId, setFaceId] = useState(false);
  const [busy, setBusy] = useState(false);

  const tryFaceId = useCallback(async () => {
    if (await deps.askFaceId()) {
      await deps.clearFailures(system);
      onUnlock();
    }
  }, [deps, onUnlock, system]);

  // Read the lockout and whether Face ID is set up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lockedUntil = await deps.lockedUntil(system);
      if (cancelled) return;
      setUntil(lockedUntil);
      const available = await deps.faceIdAvailable(system);
      if (!cancelled) setFaceId(available);
    })();
    return () => {
      cancelled = true;
    };
  }, [deps, system]);

  // Offer Face ID once, as soon as the app is on screen (the login appears while the app is in
  // the background after an auto-lock; asking then would fail). Never again on a re-render.
  const asked = useRef(false);
  useEffect(() => {
    if (!faceId || !active || asked.current) return;
    asked.current = true;
    tryFaceId();
  }, [faceId, active, tryFaceId]);

  // Count the lockout down every second; the keypad comes back when it reaches zero.
  useEffect(() => {
    if (!until) return;
    const tick = () => {
      const remaining = until - now();
      if (remaining <= 0) {
        setUntil(0);
        setLeft(0);
        setMessage(null);
      } else setLeft(remaining);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [until, now]);

  const complete = async (pin: string) => {
    setBusy(true);
    try {
      const r = await deps.verify(system, pin);
      setValue('');
      if (r.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        onUnlock();
        return;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      if (r.lockedUntil) {
        setUntil(r.lockedUntil);
        setMessage('محاولات خاطئة كثيرة');
      } else {
        const left = 'attemptsLeft' in r ? r.attemptsLeft : 0;
        setMessage(`رمز خاطئ، بقيت ${attemptsLeftText(left)} قبل القفل المؤقت`);
      }
    } finally {
      setBusy(false);
    }
  };

  const locked = until > 0;
  return (
    <Screen contentStyle={{ alignItems: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'stretch' }}>
        <Button
          title="تغيير النظام"
          icon="chevron.backward"
          variant="ghost"
          size="sm"
          onPress={onBack}
        />
      </View>
      <Logo system={system} width={150} />
      <View style={{ gap: spacing.xs, alignItems: 'center' }}>
        <Text variant="title" center>
          {NAMES[system]}
        </Text>
        <Text
          variant="subhead"
          tone={message || locked ? 'warning' : 'secondary'}
          center
          testID="login-message">
          {locked
            ? `${message ?? 'النظام مقفل مؤقتاً'} — حاول بعد ${countdown(left)}`
            : (message ?? 'أدخل رمز الدخول')}
        </Text>
      </View>
      <PinPad
        value={value}
        onChange={setValue}
        onComplete={complete}
        disabled={locked || busy}
        error={!!message && !locked}
      />
      {faceId && !locked ? (
        <Button title="الدخول بـ Face ID" icon="faceid" variant="secondary" onPress={tryFaceId} />
      ) : null}
    </Screen>
  );
}
