import { router, Stack } from 'expo-router';
import { Alert } from 'react-native';

import { ChangePinScreen, type ChangePinDeps } from '@/screens/change-pin';
import { pinVault } from '@/security/device';
import { useLock } from '@/state/lock';
import { useCtx } from '@/state/system-db';
import { OWNER, pinAccountOf } from '@/staff/model';
import { errorBoundary } from '@/components/error-screen';

const deps: ChangePinDeps = {
  verify: (account, pin) => pinVault.verify(account, pin),
  setPin: (account, pin) => pinVault.setPin(account, pin),
};

/** Settings → change the open system's PIN. */
export default function ChangePinRoute() {
  const { system } = useCtx();
  // The owner changes the system's PIN; an employee changes their own (both systems).
  const actor = useLock().actor ?? OWNER;
  return (
    <>
      <Stack.Title>تغيير الرمز</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>إلغاء</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ChangePinScreen
        account={pinAccountOf(actor, system)}
        note={
          actor.kind === 'owner'
            ? 'الرمز يحمي هذا النظام فقط، ويُحفظ على هذا الجهاز وحده.'
            : 'رمزك الشخصي للنظامين، على هذا الجهاز وحده.'
        }
        deps={deps}
        onDone={() => {
          router.back();
          Alert.alert('تم تغيير الرمز', 'استخدم الرمز الجديد من المرة القادمة.');
        }}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('change-pin');
