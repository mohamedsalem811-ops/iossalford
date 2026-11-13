import { router, useFocusEffect, type Href } from 'expo-router';
import { useUpdates } from 'expo-updates';
import { useCallback, useState } from 'react';

import { copyReminder } from '@/backup/model';
import { firstBackup, lastCopied, saveBackup } from '@/backup/store';
import { logError } from '@/lib/error-log';
import { ManagementScreen, type ManageTarget } from '@/screens/management';
import { useLock } from '@/state/lock';
import { actorName, isOwner } from '@/staff/model';
import { useStaff } from '@/staff/store';
import { useCtx } from '@/state/system-db';
import type { SystemId } from '@/theme';

/** Sections only the owner opens (more follow with the permissions, phase S2). */
export const OWNER_ONLY_SECTIONS: ManageTarget[] = ['staff'];

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
  archived: 'archived',
  backup: 'backup',
  staff: 'staff',
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
  const { lock, actor } = useLock();
  const staff = useStaff();
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
    } catch (error) {
      // Never block locking or switching; the next backup tries again.
      logError('نسخة عند القفل أو التبديل', error);
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
      hidden={OWNER_ONLY_SECTIONS.filter(() => !isOwner(actor))}
      person={staff.employees.length && actor ? actorName(actor) : undefined}
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
