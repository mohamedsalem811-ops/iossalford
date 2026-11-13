import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { EmptyState } from '@/components';
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
import { isOwner } from '@/staff/model';
import { useStaff } from '@/staff/store';
import { useLock } from '@/state/lock';

/** Management → الموظفون: the owner only (an employee can't open it, even from a link). */
export default function StaffRoute() {
  const { actor } = useLock();
  const staff = useStaff();
  const [hasCode, setHasCode] = useState(false);
  const readCode = useCallback(() => {
    pinVault.hasEmergencyCode().then(setHasCode);
  }, []);
  useFocusEffect(readCode);
  if (!isOwner(actor))
    return (
      <>
        <Stack.Title>الموظفون</Stack.Title>
        <EmptyState icon="lock" title="للمالك فقط" message="هذه الشاشة يفتحها المالك وحده." />
      </>
    );
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
