import { Stack, useFocusEffect } from 'expo-router';
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
  return (
    <>
      <Stack.Title>الموظفون</Stack.Title>
      <StaffScreen
        staff={staff}
        hasEmergencyCode={hasCode}
        actions={{
          onAdd: addEmployeeFlow,
          onResetPin: resetPinFlow,
          onRename: renameFlow,
          onToggleActive: toggleActiveFlow,
          onLock: saveLock,
          onEmergencyCode: () => emergencyCodeFlow(hasCode, readCode),
          onSendList: sendStaffList,
          onReceiveList: receiveStaffList,
        }}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/staff');
