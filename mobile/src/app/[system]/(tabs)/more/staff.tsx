import { router, Stack, useFocusEffect } from 'expo-router';

import { ledgerBalances } from '@/domain/staff-ledger';
import { useCtx } from '@/state/system-db';
import { useCallback, useState } from 'react';

import { errorBoundary } from '@/components/error-screen';
import {
  addEmployeeFlow,
  emergencyPasswordFlow,
  receiveStaffList,
  renameFlow,
  resetPinFlow,
  saveLock,
  sendStaffList,
  toggleActiveFlow,
  togglePhonesFlow,
  toggleSpendFlow,
  toggleSystemFlow,
} from '@/features/staff/actions';
import { editBonusDefaultFlow, editTargetFlow } from '@/features/staff/goal-actions';
import { StaffScreen } from '@/features/staff/staff-screen';
import { sectionHref } from '@/features/management/management-menu';
import { getGoals } from '@/domain/staff-goals';
import { pinVault } from '@/security/device';
import { Allowed } from '@/staff/allowed';
import { useStaff } from '@/staff/store';

/** Management → الموظفون: the owner only (an employee can't open it, even from a link). */
export default function StaffRoute() {
  return (
    <Allowed permission="staff.manage" title="الموظفون">
      <StaffRouteScreen />
    </Allowed>
  );
}

function StaffRouteScreen() {
  const staff = useStaff();
  const [emergency, setEmergency] = useState<'password' | 'code' | null>(null);
  const readCode = useCallback(() => {
    pinVault.emergencyKind().then(setEmergency);
  }, []);
  useFocusEffect(readCode);
  const ctx = useCtx();
  const [balances, setBalances] = useState(() => ledgerBalances(ctx));
  const [goals, setGoalsShown] = useState(() => getGoals(ctx));
  const reread = useCallback(() => {
    setBalances(ledgerBalances(ctx));
    setGoalsShown(getGoals(ctx));
  }, [ctx]);
  useFocusEffect(reread);
  return (
    <>
      <Stack.Title>الموظفون</Stack.Title>
      <StaffScreen
        staff={staff}
        emergency={emergency}
        balances={balances}
        goals={goals}
        actions={{
          onTarget: () => editTargetFlow(ctx, reread),
          onBonusDefault: () => editBonusDefaultFlow(ctx, reread),
          onReport: () => router.push(sectionHref('staffReport', ctx.system)),
          onAdd: addEmployeeFlow,
          onResetPin: resetPinFlow,
          onRename: renameFlow,
          onToggleActive: toggleActiveFlow,
          onTogglePhones: togglePhonesFlow,
          onToggleSpend: toggleSpendFlow,
          onToggleSystem: toggleSystemFlow,
          onLock: saveLock,
          onEmergencyPassword: () =>
            emergencyPasswordFlow(ctx.system, emergency === 'password', readCode),
          onSendList: sendStaffList,
          onReceiveList: receiveStaffList,
          onAccount: (e) =>
            router.push({
              pathname: '/[system]/more/account/[id]',
              params: { system: ctx.system, id: e.id },
            }),
        }}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/staff');
