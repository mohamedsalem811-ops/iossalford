import Constants from 'expo-constants';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';

import { ChooserScreen } from '@/screens/chooser';
import { lastSystem, pinVault } from '@/security/device';
import { useLock } from '@/state/lock';
import { errorBoundary } from '@/components/error-screen';

/**
 * The start screen. Being here means no system is open: it locks on arrival, so going back into
 * a system always asks for its PIN (or Face ID). First launch goes to PIN setup.
 */
export default function Index() {
  const { lock } = useLock();
  const [ready, setReady] = useState<boolean | null>(null);
  const [last] = useState(lastSystem);

  useEffect(() => {
    lock();
    let cancelled = false;
    pinVault.ready().then(
      (v) => !cancelled && setReady(v),
      () => !cancelled && setReady(false),
    );
    return () => {
      cancelled = true;
    };
  }, [lock]);

  if (ready === null) return null;
  if (!ready) return <Redirect href="/setup" />;
  return (
    <ChooserScreen
      last={last}
      version={Constants.expoConfig?.version ?? ''}
      onChoose={(system) => router.replace({ pathname: '/[system]', params: { system } })}
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('start');
