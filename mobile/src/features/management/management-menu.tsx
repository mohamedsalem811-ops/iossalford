import { router, useFocusEffect, type Href } from 'expo-router';
import { useUpdates } from 'expo-updates';
import { useCallback, useState } from 'react';

import { copyReminder } from '@/backup/model';
import { firstBackup, lastCopied, saveBackup } from '@/backup/store';
import { ManagementScreen, type ManageTarget } from '@/screens/management';
import { useLock } from '@/state/lock';
import { useCtx } from '@/state/system-db';
import type { SystemId } from '@/theme';

/** The route of each section, inside the Management tab (its stack keeps the tab bar). */
export const SECTION_ROUTE: Record<ManageTarget, string> = {
  sales: 'sales',
  returns: 'returns',
  customers: 'customers',
  debts: 'debts',
  expenses: 'expenses',
  closing: 'closing',
  comparison: 'comparison',
  brands: 'brands',
  sets: 'manage-sets',
  backup: 'backup',
  settings: 'settings',
};

export const sectionHref = (target: ManageTarget, system: SystemId): Href =>
  ({ pathname: `/[system]/more/${SECTION_ROUTE[target]}`, params: { system } }) as Href;

/** The section a route name belongs to ("manage-sets" → sets), or undefined for deeper screens. */
export const sectionOf = (route: string | undefined): ManageTarget | undefined =>
  (Object.keys(SECTION_ROUTE) as ManageTarget[]).find((t) => SECTION_ROUTE[t] === route);

/**
 * The Management menu with its banners, switching and locking. On iPhone it is the tab's first
 * screen; on iPad it stays on the leading side and the chosen section opens beside it.
 */
export function ManagementMenu({
  onOpen,
  selected,
}: {
  onOpen: (target: ManageTarget) => void;
  selected?: ManageTarget;
}) {
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
  const updateReady = useUpdates().isUpdatePending;
  return (
    <ManagementScreen
      reminder={reminder}
      updateReady={updateReady}
      selected={selected}
      onOpen={onOpen}
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
