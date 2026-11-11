import { router, useFocusEffect, type Href } from 'expo-router';
import { useCallback, useState } from 'react';

import { copyReminder } from '@/backup/model';
import { firstBackup, lastCopied, saveBackup } from '@/backup/store';

import { ManagementScreen, type ManageTarget } from '@/screens/management';
import { useLock } from '@/state/lock';
import { useCtx } from '@/state/system-db';
import type { SystemId } from '@/theme';

const ROUTES: Record<ManageTarget, (system: SystemId) => Href> = {
  sales: (system) => ({ pathname: '/[system]/sales', params: { system } }),
  returns: (system) => ({ pathname: '/[system]/returns', params: { system } }),
  customers: (system) => ({ pathname: '/[system]/customers', params: { system } }),
  debts: (system) => ({ pathname: '/[system]/debts', params: { system } }),
  expenses: (system) => ({ pathname: '/[system]/expenses', params: { system } }),
  closing: (system) => ({ pathname: '/[system]/closing', params: { system } }),
  comparison: (system) => ({ pathname: '/[system]/comparison', params: { system } }),
  brands: (system) => ({ pathname: '/[system]/brands', params: { system } }),
  sets: (system) => ({ pathname: '/[system]/manage-sets', params: { system } }),
  backup: (system) => ({ pathname: '/[system]/backup', params: { system } }),
  settings: (system) => ({ pathname: '/[system]/settings', params: { system } }),
};

export default function More() {
  const { lock } = useLock();
  const ctx = useCtx();
  const system = ctx.system;
  const read = useCallback(
    () => copyReminder(lastCopied(system), ctx.now(), firstBackup(system)),
    [ctx, system],
  );
  const [reminder, setReminder] = useState(read);
  /** Leaving the system by hand saves a backup too (skipped when nothing changed). */
  const backupNow = () => {
    try {
      saveBackup(ctx, 'auto');
    } catch {
      // Never block locking or switching; the next backup tries again.
    }
  };
  useFocusEffect(useCallback(() => setReminder(read()), [read]));
  return (
    <ManagementScreen
      reminder={reminder}
      onOpen={(t) => router.push(ROUTES[t](system))}
      onSwitch={() => {
        backupNow();
        router.replace('/');
      }}
      onLock={() => {
        backupNow();
        lock();
      }}
    />
  );
}
