import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';

import { Button, EmptyState, Screen } from '@/components';
import { SetupScreen } from '@/screens/setup';
import { pinVault } from '@/security/device';
import type { SystemId } from '@/theme';

const SYSTEMS: SystemId[] = ['jewelry', 'scarves'];

/** First-launch PIN setup, for the systems that have no PIN yet. */
export default function Setup() {
  const [missing, setMissing] = useState<SystemId[] | 'error' | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all(SYSTEMS.map((s) => pinVault.hasPin(s))).then(
      (has) => !cancelled && setMissing(SYSTEMS.filter((_, i) => !has[i])),
      () => !cancelled && setMissing('error'),
    );
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  if (missing === null) return null;
  if (missing === 'error') {
    return (
      <Screen>
        <EmptyState icon="lock.trianglebadge.exclamationmark" title="تعذر قراءة رموز الدخول" />
        <Button
          title="حاول مرة أخرى"
          icon="arrow.clockwise"
          fullWidth
          onPress={() => setAttempt((n) => n + 1)}
        />
      </Screen>
    );
  }
  if (!missing.length) return <Redirect href="/" />;
  return (
    <SetupScreen
      systems={missing}
      savePin={(system, pin) => pinVault.setPin(system, pin)}
      onDone={() => router.replace('/')}
    />
  );
}
