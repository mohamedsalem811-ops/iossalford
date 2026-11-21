import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Icon, Logo, Screen, Text, TextField } from '@/components';
import { haptic } from '@/lib/haptics';
import type { PinAccount, VerifyResult } from '@/security/pin';
import { OWNER, pinAccountOf, type Actor, type Employee } from '@/staff/model';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

import { ChangePinScreen } from './change-pin';
import { attemptsLeftText, countdown, LoginScreen, type LoginDeps } from './login';

export type SignInDeps = LoginDeps & {
  hasPin: (account: PinAccount) => Promise<boolean>;
  setPin: (account: PinAccount, pin: string) => Promise<void>;
  /** The owner's emergency password (K10), the old 12-digit code, or neither. */
  emergencyKind: () => Promise<'password' | 'code' | null>;
  checkEmergencyCode: (code: string) => Promise<VerifyResult>;
  /** An employee chose their own PIN: no longer a temporary one. */
  pinChanged: (employeeId: string) => void;
  /** The owner approved a forgotten employee PIN's reset at the counter (logged, point 4). */
  pinReset: (who: Actor) => void;
};

type Step =
  | { kind: 'pick' }
  | { kind: 'pin'; who: Actor }
  /**
   * The owner approves, then the employee chooses a PIN: one new on this device (transferred), or
   * one who forgot their PIN (`reset`, point 3).
   */
  | { kind: 'approve'; who: Employee; reset?: boolean }
  | { kind: 'new-pin'; who: Actor }
  | { kind: 'emergency' };

/**
 * Opening a system. With no employees it is the owner's PIN (or Face ID), as before. With
 * employees, the people appear as name cards first; each opens with their own PIN. An employee
 * with a temporary PIN chooses their own at once; one transferred from the other device needs the
 * owner's approval first. The owner can set a new PIN with the emergency code.
 */
export function SignInScreen({
  system,
  employees,
  deps,
  onUnlock,
  onBack,
  active = true,
}: {
  system: SystemId;
  /** Active employees, in display order. */
  employees: Employee[];
  deps: SignInDeps;
  onUnlock: (who: Actor) => void;
  onBack: () => void;
  active?: boolean;
}) {
  const [step, setStep] = useState<Step>(
    employees.length ? { kind: 'pick' } : { kind: 'pin', who: OWNER },
  );
  const [emergency, setEmergency] = useState<'password' | 'code' | null>(null);
  useEffect(() => {
    let cancelled = false;
    deps.emergencyKind().then((kind) => !cancelled && setEmergency(kind));
    return () => {
      cancelled = true;
    };
  }, [deps]);

  const toPicker = () => setStep(employees.length ? { kind: 'pick' } : { kind: 'pin', who: OWNER });
  const choose = async (e: Employee) => {
    const who: Actor = { kind: 'employee', id: e.id, name: e.name };
    const has = await deps.hasPin(pinAccountOf(who, system));
    setStep(has ? { kind: 'pin', who } : { kind: 'approve', who: e });
  };
  const signedIn = (who: Actor) => {
    if (who.kind === 'employee' && employees.find((e) => e.id === who.id)?.mustChangePin)
      setStep({ kind: 'new-pin', who });
    else onUnlock(who);
  };

  /** «نسيت الرمز؟»: the owner's emergency password, or the owner resets an employee's PIN. */
  const forgotOf = (who: Actor) => {
    if (who.kind === 'owner')
      return emergency
        ? {
            onForgot: () => setStep({ kind: 'emergency' }),
            forgotHint:
              emergency === 'password'
                ? 'نسيت الرمز؟ افتح بكلمة سر الطوارئ واختر رمزاً جديداً.'
                : 'نسيت الرمز؟ افتح برمز الطوارئ واختر رمزاً جديداً.',
          }
        : { forgotHint: undefined };
    const e = employees.find((x) => x.id === who.id);
    return e
      ? {
          onForgot: () => setStep({ kind: 'approve', who: e, reset: true }),
          forgotHint: 'نسيت رمزك؟ اطلب من المالك أن يوافق برمزه، ثم اختر رمزاً جديداً.',
        }
      : {};
  };

  if (step.kind === 'pick')
    return (
      <Picker
        system={system}
        employees={employees}
        onOwner={() => setStep({ kind: 'pin', who: OWNER })}
        onEmployee={choose}
        onBack={onBack}
      />
    );

  if (step.kind === 'pin')
    return (
      <LoginScreen
        key={step.who.kind === 'owner' ? 'owner' : step.who.id}
        system={system}
        account={pinAccountOf(step.who, system)}
        person={
          employees.length ? (step.who.kind === 'owner' ? 'المالك' : step.who.name) : undefined
        }
        deps={deps}
        active={active}
        onUnlock={() => signedIn(step.who)}
        onBack={employees.length ? toPicker : onBack}
        backLabel={employees.length ? 'الأسماء' : 'تغيير النظام'}
        {...forgotOf(step.who)}
      />
    );

  if (step.kind === 'approve')
    return (
      <LoginScreen
        key="approve"
        system={system}
        person={
          step.reset
            ? `موافقة المالك لإعادة رمز ${step.who.name}`
            : `موافقة المالك لدخول ${step.who.name} أول مرة`
        }
        deps={deps}
        active={active}
        onUnlock={() => {
          const who: Actor = { kind: 'employee', id: step.who.id, name: step.who.name };
          if (step.reset) deps.pinReset(who);
          setStep({ kind: 'new-pin', who });
        }}
        onBack={toPicker}
        backLabel="الأسماء"
      />
    );

  if (step.kind === 'emergency')
    return (
      <EmergencyCode
        kind={emergency ?? 'code'}
        deps={deps}
        onOk={() => setStep({ kind: 'new-pin', who: OWNER })}
        onBack={toPicker}
      />
    );

  const who = step.who;
  return (
    <Screen contentStyle={{ gap: spacing.md }}>
      <Text variant="title" center style={{ paddingTop: spacing.lg }}>
        {who.kind === 'owner' ? 'رمز جديد للمالك' : `${who.name}: اختر رمزك`}
      </Text>
      <ChangePinScreen
        account={pinAccountOf(who, system)}
        deps={deps}
        skipCurrent
        note={
          who.kind === 'owner'
            ? 'الرمز الجديد لهذا النظام، على هذا الجهاز.'
            : 'رمزك الشخصي للنظامين، لا تخبر به أحداً.'
        }
        onDone={() => {
          if (who.kind === 'employee') deps.pinChanged(who.id);
          haptic.success();
          onUnlock(who);
        }}
      />
    </Screen>
  );
}

function Picker({
  system,
  employees,
  onOwner,
  onEmployee,
  onBack,
}: {
  system: SystemId;
  employees: Employee[];
  onOwner: () => void;
  onEmployee: (e: Employee) => void;
  onBack: () => void;
}) {
  return (
    <Screen maxWidth={720} contentStyle={{ alignItems: 'center', gap: spacing.lg }}>
      <View style={{ alignSelf: 'stretch' }}>
        <Button
          title="تغيير النظام"
          icon="chevron.backward"
          variant="ghost"
          size="sm"
          onPress={onBack}
        />
      </View>
      <Logo system={system} width={130} />
      <Text variant="title" center>
        من يستخدم النظام؟
      </Text>
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: spacing.ms,
          justifyContent: 'center',
        }}
        testID="sign-in-people">
        <PersonCard name="المالك" icon="crown.fill" onPress={onOwner} testID="person-owner" />
        {employees.map((e) => (
          <PersonCard
            key={e.id}
            name={e.name}
            icon="person.fill"
            onPress={() => onEmployee(e)}
            testID={`person-${e.name}`}
          />
        ))}
      </View>
    </Screen>
  );
}

function PersonCard({
  name,
  icon,
  onPress,
  testID,
}: {
  name: string;
  icon: 'crown.fill' | 'person.fill';
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`الدخول باسم ${name}`}
      testID={testID}
      style={({ pressed }) => ({
        width: 148,
        minHeight: 120,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
        borderWidth: 1,
        borderColor: colors.separator,
      })}>
      <View
        style={{
          width: 52,
          height: 52,
          borderRadius: 26,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.accentSoft,
        }}>
        <Icon name={icon} size={24} color={colors.accent} />
      </View>
      <Text variant="bodyStrong" center numberOfLines={1}>
        {name}
      </Text>
    </Pressable>
  );
}

/** The owner forgot the PIN: the emergency password the owner chose (K10), or the old code. */
function EmergencyCode({
  kind,
  deps,
  onOk,
  onBack,
}: {
  kind: 'password' | 'code';
  deps: SignInDeps;
  onOk: () => void;
  onBack: () => void;
}) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const password = kind === 'password';
  const name = password ? 'كلمة سر الطوارئ' : 'رمز الطوارئ';
  const check = async () => {
    setBusy(true);
    try {
      const r = await deps.checkEmergencyCode(code);
      if (r.ok) return onOk();
      haptic.error();
      const now = (deps.now ?? Date.now)();
      setMessage(
        'locked' in r || r.lockedUntil
          ? `محاولات خاطئة كثيرة — حاول بعد ${countdown(r.lockedUntil - now)}`
          : `${name} ${password ? 'غير صحيحة' : 'غير صحيح'}، بقيت ${attemptsLeftText(r.attemptsLeft)}`,
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <Screen keyboard maxWidth={520} contentStyle={{ gap: spacing.md }}>
      <View style={{ alignSelf: 'stretch' }}>
        <Button title="رجوع" icon="chevron.backward" variant="ghost" size="sm" onPress={onBack} />
      </View>
      <Text variant="title" center>
        {name}
      </Text>
      <Text
        variant="subhead"
        tone={message ? 'warning' : 'secondary'}
        center
        testID="emergency-message">
        {message ??
          (password
            ? 'اكتب كلمة سر الطوارئ التي اخترتها (الحروف الكبيرة والصغيرة سواء)، ثم اختر رمزاً جديداً.'
            : 'أدخل رمز الطوارئ المحفوظ عندك (12 رقماً)، ثم اختر رمزاً جديداً.')}
      </Text>
      {password ? (
        <TextField
          label={name}
          value={code}
          onChangeText={setCode}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          textContentType="none"
          testID="emergency-code"
        />
      ) : (
        <TextField
          label={name}
          value={code}
          onChangeText={setCode}
          placeholder="1234-5678-9012"
          keyboardType="number-pad"
          testID="emergency-code"
        />
      )}
      <Button title="تحقق" onPress={check} loading={busy} fullWidth testID="emergency-check" />
    </Screen>
  );
}
