import { router, Stack } from 'expo-router';
import { Alert } from 'react-native';

import { ChangePinScreen, type ChangePinDeps } from '@/screens/change-pin';
import { pinVault } from '@/security/device';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

const deps: ChangePinDeps = {
  verify: (system, pin) => pinVault.verify(system, pin),
  setPin: (system, pin) => pinVault.setPin(system, pin),
};

/** Settings → change the open system's PIN. */
export default function ChangePinRoute() {
  const { system } = useCtx();
  return (
    <>
      <Stack.Title>تغيير الرمز</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>إلغاء</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ChangePinScreen
        system={system}
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
