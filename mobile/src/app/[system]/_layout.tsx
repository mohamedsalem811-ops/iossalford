import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback } from 'react';

import { DbErrorScreen } from '@/screens/db-error';
import { LoginScreen, type LoginDeps } from '@/screens/login';
import { askFaceId, faceIdAvailable, pinVault, rememberSystem } from '@/security/device';
import { useLock } from '@/state/lock';
import { CtxProvider, useSystemDb } from '@/state/system-db';
import { ThemeProvider, type SystemId } from '@/theme';

const loginDeps: LoginDeps = {
  verify: (system, pin) => pinVault.verify(system, pin),
  lockedUntil: (system) => pinVault.lockedUntil(system),
  clearFailures: (system) => pinVault.clearFailures(system),
  faceIdAvailable,
  askFaceId,
};

const toChooser = () => router.replace('/');

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
      <Stack screenOptions={{ headerShown: false }} />
    </CtxProvider>
  );
}
