import * as Updates from 'expo-updates';
import { useCallback, useState } from 'react';

import type { CheckOutcome, RunningFacts } from './model';

/**
 * Instant updates in the installed app: what is running, whether a downloaded update is waiting,
 * and a manual check. Nothing here ever blocks the app; a failed check only shows a message.
 */
export function useAppUpdate() {
  const { currentlyRunning, isUpdatePending } = Updates.useUpdates();
  const [busy, setBusy] = useState(false);

  const facts: RunningFacts = {
    enabled: Updates.isEnabled,
    embedded: currentlyRunning.isEmbeddedLaunch,
    createdAt: currentlyRunning.createdAt ?? null,
    emergency: currentlyRunning.isEmergencyLaunch,
  };

  const check = useCallback(async (): Promise<CheckOutcome> => {
    setBusy(true);
    try {
      const found = await Updates.checkForUpdateAsync();
      if (!found.isAvailable) return 'up-to-date';
      const fetched = await Updates.fetchUpdateAsync();
      return fetched.isNew ? 'ready' : 'up-to-date';
    } catch {
      return 'failed';
    } finally {
      setBusy(false);
    }
  }, []);

  const restart = useCallback(() => Updates.reloadAsync(), []);

  return { facts, pending: isUpdatePending, busy, check, restart };
}
