import { useCallback, useEffect, useRef, useState } from 'react';
import { View } from 'react-native';

import { Button, Logo, Screen, Text } from '@/components';
import { PinPad } from '@/components/pin-pad';
import {
  faceIdFailure,
  faceIdNote,
  type FaceIdResult,
  type FaceIdStatus,
} from '@/security/face-id';
import { pinLengthOf, type PinAccount, type VerifyResult } from '@/security/pin';
import { spacing, type SystemId } from '@/theme';
import { haptic } from '@/lib/haptics';

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
  verify: (account: PinAccount, pin: string) => Promise<VerifyResult>;
  lockedUntil: (account: PinAccount) => Promise<number>;
  faceIdStatus: (system: SystemId) => Promise<FaceIdStatus>;
  askFaceId: () => Promise<FaceIdResult>;
  clearFailures: (account: PinAccount) => Promise<void>;
  now?: () => number;
};

/**
 * Opens a system. Jewelry asks for Face ID first when it is set up on the device; the PIN always
 * works. When Face ID can't be used (Expo Go, not set up, locked by iOS) a line says why.
 * Wrong PINs show how many attempts are left; a lockout disables the keypad and counts down.
 */
export function LoginScreen({
  system,
  account = system,
  person,
  deps,
  onUnlock,
  onBack,
  backLabel = 'تغيير النظام',
  onForgot,
  active = true,
}: {
  system: SystemId;
  /** Whose PIN: the owner's of this system (the default) or an employee's. */
  account?: PinAccount;
  /** The name shown under the system's name ("المالك", an employee's name). */
  person?: string;
  deps: LoginDeps;
  onUnlock: () => void;
  onBack: () => void;
  backLabel?: string;
  /** The owner forgot the PIN: the emergency code. */
  onForgot?: () => void;
  /** False while the app is hidden (background, app switcher). */
  active?: boolean;
}) {
  // Face ID is the owner's only (it proves the device's owner, not which employee is there).
  const ownerAccount = account === system;
  const now = deps.now ?? Date.now;
  const [value, setValue] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [until, setUntil] = useState(0);
  const [left, setLeft] = useState(0);
  const [faceId, setFaceId] = useState<FaceIdStatus>('none');
  const [faceMessage, setFaceMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tryFaceId = useCallback(async () => {
    setFaceMessage(null);
    const r = await deps.askFaceId();
    if (r.ok) {
      await deps.clearFailures(account);
      onUnlock();
    } else setFaceMessage(faceIdFailure(r.error));
  }, [deps, onUnlock, account]);

  // Read the lockout and whether Face ID is set up.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const lockedUntil = await deps.lockedUntil(account);
      if (cancelled) return;
      setUntil(lockedUntil);
      const status = ownerAccount ? await deps.faceIdStatus(system) : 'none';
      if (!cancelled) setFaceId(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [deps, system, account, ownerAccount]);

  // Offer Face ID once, as soon as the app is on screen (the login appears while the app is in
  // the background after an auto-lock; asking then would fail). Never again on a re-render.
  const asked = useRef(false);
  useEffect(() => {
    if (faceId !== 'ready' || !active || asked.current) return;
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
      const r = await deps.verify(account, pin);
      setValue('');
      if (r.ok) {
        haptic.success();
        onUnlock();
        return;
      }
      haptic.error();
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
  const faceLine = faceId === 'ready' ? faceMessage : faceIdNote(faceId);
  return (
    <Screen contentStyle={{ alignItems: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'stretch' }}>
        <Button
          title={backLabel}
          icon="chevron.backward"
          variant="ghost"
          size="sm"
          onPress={onBack}
          testID="login-back"
        />
      </View>
      <Logo system={system} width={150} />
      <View style={{ gap: spacing.xs, alignItems: 'center' }}>
        <Text variant="title" center>
          {NAMES[system]}
        </Text>
        {person ? (
          <Text variant="headline" tone="accent" center testID="login-person">
            {person}
          </Text>
        ) : null}
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
        length={pinLengthOf(account)}
        disabled={locked || busy}
        error={!!message && !locked}
      />
      {faceId === 'ready' && !locked ? (
        <Button title="الدخول بـ Face ID" icon="faceid" variant="secondary" onPress={tryFaceId} />
      ) : null}
      {onForgot ? (
        <Button
          title="نسيت الرمز؟"
          variant="ghost"
          size="sm"
          onPress={onForgot}
          testID="login-forgot"
        />
      ) : null}
      {faceLine ? (
        <Text variant="subhead" tone="secondary" center testID="face-id-message">
          {faceLine}
        </Text>
      ) : null}
    </Screen>
  );
}
