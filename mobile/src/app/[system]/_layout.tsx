import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { AutoBackup } from '@/backup/auto-backup';
import { KeyboardBar } from '@/components/keyboard-bar';
import { DbErrorScreen } from '@/screens/db-error';
import { SignInScreen, type SignInDeps } from '@/screens/sign-in';
import { activeEmployees, setMustChangePin, type Actor } from '@/staff/model';
import { getStaff, saveStaff, useStaff } from '@/staff/store';
import { askFaceId, faceIdStatus, pinVault, rememberSystem } from '@/security/device';
import { useLock } from '@/state/lock';
import { CtxProvider, useCtx, useSystemDb } from '@/state/system-db';
import { fonts, ThemeProvider, useTheme, type SystemId } from '@/theme';
import { errorBoundary } from '@/components/error-screen';

const signInDeps: SignInDeps = {
  verify: (account, pin) => pinVault.verify(account, pin),
  lockedUntil: (account) => pinVault.lockedUntil(account),
  clearFailures: (account) => pinVault.clearFailures(account),
  faceIdStatus,
  askFaceId,
  hasPin: (account) => pinVault.hasPin(account),
  setPin: (account, pin) => pinVault.setPin(account, pin),
  hasEmergencyCode: () => pinVault.hasEmergencyCode(),
  checkEmergencyCode: (code) => pinVault.checkEmergencyCode(code),
  pinChanged: (id) => saveStaff(setMustChangePin(getStaff(), id, false)),
};

const toChooser = () => router.replace('/');

/** A sheet opened from a link (or after a reload) still has the tabs under it. */
export const unstable_settings = { anchor: '(tabs)' };

/**
 * Everything inside one system: its colours, then its PIN (or Face ID), then its database.
 * Locking (background, switch, lock button) shows the login again in place of the screens.
 */
export default function SystemLayout() {
  const { system } = useLocalSearchParams<{ system: string }>();
  if (system !== 'jewelry' && system !== 'scarves') return <Redirect href="/" />;
  return (
    <ThemeProvider system={system}>
      <SystemGate key={system} system={system} />
    </ThemeProvider>
  );
}

function SystemGate({ system }: { system: SystemId }) {
  const { unlocked, unlock, active } = useLock();
  const staff = useStaff();
  const onUnlock = useCallback(
    (who: Actor) => {
      rememberSystem(system);
      unlock(system, who);
    },
    [system, unlock],
  );

  if (unlocked !== system) {
    return (
      <SignInScreen
        system={system}
        employees={activeEmployees(staff)}
        deps={signInDeps}
        onUnlock={onUnlock}
        onBack={toChooser}
        active={active}
      />
    );
  }
  return <SystemDb system={system} />;
}

/** The database opens only after the PIN; an error never deletes it (see DbErrorScreen). */
function SystemDb({ system }: { system: SystemId }) {
  const { result, retry } = useSystemDb(system);
  if (result.status !== 'ok') {
    return <DbErrorScreen system={system} result={result} onRetry={retry} onBack={toChooser} />;
  }
  return (
    <CtxProvider db={result.db} system={system}>
      <AutoBackupOfOpenSystem />
      <SystemStack />
    </CtxProvider>
  );
}

/** A backup of the open system each time the app goes to the background. */
function AutoBackupOfOpenSystem() {
  return <AutoBackup ctx={useCtx()} />;
}

/**
 * The tabs, with forms, photos, the cart, checkout and receipts opening over them as iOS sheets with their
 * own header. Management screens open inside the Management tab (its own stack), so the tab bar stays.
 */
function SystemStack() {
  const { colors } = useTheme();
  const sheet = {
    presentation: 'modal' as const,
    headerShown: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.accent,
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
    contentStyle: { backgroundColor: colors.background },
  };
  const halfSheet = {
    ...sheet,
    presentation: 'formSheet' as const,
    sheetGrabberVisible: true,
    sheetAllowedDetents: [0.7, 1],
  };
  return (
    <Stack
      screenOptions={{ headerShown: false }}
      // A sheet is drawn above the app, so the "تم" bar of the root layout would sit behind it:
      // each sheet gets its own, so a number pad (no return key) can always be closed.
      screenLayout={({ children, options }) =>
        options.presentation === 'modal' || options.presentation === 'formSheet' ? (
          <>
            {children}
            <KeyboardBar />
          </>
        ) : (
          children
        )
      }>
      <Stack.Screen name="product/[id]" options={sheet} />
      <Stack.Screen name="photo/[id]" options={sheet} />
      <Stack.Screen name="design/[id]" options={sheet} />
      <Stack.Screen name="stock/[id]" options={halfSheet} />
      <Stack.Screen name="customer-form/[id]" options={sheet} />
      <Stack.Screen name="payment/[id]" options={halfSheet} />
      <Stack.Screen name="return/[id]" options={sheet} />
      <Stack.Screen name="change-pin" options={sheet} />
      <Stack.Screen name="set/[id]" options={sheet} />
      <Stack.Screen name="sets" options={sheet} />
      <Stack.Screen name="cart" options={sheet} />
      <Stack.Screen name="checkout" options={sheet} />
      <Stack.Screen name="sold/[id]" options={{ ...sheet, gestureEnabled: false }} />
      <Stack.Screen name="receipt/[id]" options={sheet} />
      <Stack.Screen name="add/[id]" options={halfSheet} />
      <Stack.Screen name="sizes/[id]" options={halfSheet} />
    </Stack>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('system');
