import { router, Stack, useFocusEffect } from 'expo-router';

import { ledgerBalances } from '@/domain/staff-ledger';
import { useCtx } from '@/state/system-db';
import { useCallback, useState } from 'react';

import { errorBoundary } from '@/components/error-screen';
import {
  addEmployeeFlow,
  emergencyCodeFlow,
  receiveStaffList,
  renameFlow,
  resetPinFlow,
  saveLock,
  sendStaffList,
  toggleActiveFlow,
  togglePhonesFlow,
  toggleSpendFlow,
} from '@/features/staff/actions';
import { StaffScreen } from '@/features/staff/staff-screen';
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
  const [hasCode, setHasCode] = useState(false);
  const readCode = useCallback(() => {
    pinVault.hasEmergencyCode().then(setHasCode);
  }, []);
  useFocusEffect(readCode);
  const ctx = useCtx();
  const [balances, setBalances] = useState(() => ledgerBalances(ctx));
  useFocusEffect(useCallback(() => setBalances(ledgerBalances(ctx)), [ctx]));
  return (
    <>
      <Stack.Title>الموظفون</Stack.Title>
      <StaffScreen
        staff={staff}
        hasEmergencyCode={hasCode}
        balances={balances}
        actions={{
          onAdd: addEmployeeFlow,
          onResetPin: resetPinFlow,
          onRename: renameFlow,
          onToggleActive: toggleActiveFlow,
          onTogglePhones: togglePhonesFlow,
          onToggleSpend: toggleSpendFlow,
          onLock: saveLock,
          onEmergencyCode: () => emergencyCodeFlow(hasCode, readCode),
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
