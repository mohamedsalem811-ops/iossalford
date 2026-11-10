import { router } from 'expo-router';

import { ManagementScreen } from '@/screens/management';
import { useLock } from '@/state/lock';
import { useCtx } from '@/state/system-db';

export default function More() {
  const { lock } = useLock();
  const { system } = useCtx();
  return (
    <ManagementScreen
      onSwitch={() => router.replace('/')}
      onLock={lock}
      onBrands={() => router.push({ pathname: '/[system]/brands', params: { system } })}
      onSets={() => router.push({ pathname: '/[system]/manage-sets', params: { system } })}
    />
  );
}
