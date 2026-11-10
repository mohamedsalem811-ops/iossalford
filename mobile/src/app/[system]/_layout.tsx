import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { DbErrorScreen } from '@/screens/db-error';
import { LoginScreen, type LoginDeps } from '@/screens/login';
import { askFaceId, faceIdStatus, pinVault, rememberSystem } from '@/security/device';
import { useLock } from '@/state/lock';
import { CtxProvider, useSystemDb } from '@/state/system-db';
import { fonts, ThemeProvider, useTheme, type SystemId } from '@/theme';

const loginDeps: LoginDeps = {
  verify: (system, pin) => pinVault.verify(system, pin),
  lockedUntil: (system) => pinVault.lockedUntil(system),
  clearFailures: (system) => pinVault.clearFailures(system),
  faceIdStatus,
  askFaceId,
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
  const onUnlock = useCallback(() => {
    rememberSystem(system);
    unlock(system);
  }, [system, unlock]);

  if (unlocked !== system) {
    return (
      <LoginScreen
        system={system}
        deps={loginDeps}
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
      <SystemStack />
    </CtxProvider>
  );
}

/**
 * The tabs, with forms, photos, the cart, checkout and receipts opening over them as iOS sheets with their
 * own header, and management screens (brands, sets) pushed over them with a back button.
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
  const pushed = {
    headerShown: true,
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.accent,
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: colors.background },
  };
  const halfSheet = {
    ...sheet,
    presentation: 'formSheet' as const,
    sheetGrabberVisible: true,
    sheetAllowedDetents: [0.7, 1],
  };
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="brands" options={pushed} />
      <Stack.Screen name="product/[id]" options={sheet} />
      <Stack.Screen name="photo/[id]" options={sheet} />
      <Stack.Screen name="design/[id]" options={sheet} />
      <Stack.Screen name="stock/[id]" options={halfSheet} />
      <Stack.Screen name="manage-sets" options={pushed} />
      <Stack.Screen name="settings" options={pushed} />
      <Stack.Screen name="sales" options={pushed} />
      <Stack.Screen name="sale/[id]" options={pushed} />
      <Stack.Screen name="returns" options={pushed} />
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
