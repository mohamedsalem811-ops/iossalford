import { router, useFocusEffect, type Href } from 'expo-router';
import { useUpdates } from 'expo-updates';
import { useCallback, useState } from 'react';

import { copyReminder } from '@/backup/model';
import { firstBackup, lastCopied, saveBackup } from '@/backup/store';
import { logError } from '@/lib/error-log';
import { ManagementScreen, type ManageTarget } from '@/screens/management';
import { useLock } from '@/state/lock';
import { actorName, type Actor } from '@/staff/model';
import { can, type Permission } from '@/staff/permissions';
import { useStaff } from '@/staff/store';
import { useActor } from '@/staff/use-can';
import { useCtx } from '@/state/system-db';
import type { SystemId } from '@/theme';

/**
 * What each section needs to open (null: anyone signed in). A section the person may not open is
 * not listed, and its screen refuses on its own as well.
 */
export const SECTION_NEEDS: Record<ManageTarget, Permission | null> = {
  sales: null,
  returns: 'sales.viewAll',
  customers: null,
  debts: null,
  expenses: 'expenses.view',
  closing: 'reports.view',
  comparison: 'reports.view',
  brands: 'products.edit',
  sets: 'sets.edit',
  archived: 'products.edit',
  backup: 'backup.manage',
  staff: 'staff.manage',
  settings: null,
};

/** The sections this person may not open. */
export const hiddenSections = (actor: Actor | null): ManageTarget[] =>
  (Object.keys(SECTION_NEEDS) as ManageTarget[]).filter((t) => {
    const need = SECTION_NEEDS[t];
    return need !== null && !can(actor, need);
  });

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
  const { lock } = useLock();
  const actor = useActor();
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
      reminder={can(actor, 'backup.manage') ? reminder : null}
      updateReady={updateReady}
      selected={selected}
      onOpen={onOpen}
      hidden={hiddenSections(actor)}
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
