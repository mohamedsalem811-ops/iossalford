import { router, type Href } from 'expo-router';

import { ManagementScreen, type ManageTarget } from '@/screens/management';
import { useLock } from '@/state/lock';
import { useCtx } from '@/state/system-db';
import type { SystemId } from '@/theme';

const ROUTES: Record<ManageTarget, (system: SystemId) => Href> = {
  brands: (system) => ({ pathname: '/[system]/brands', params: { system } }),
  sets: (system) => ({ pathname: '/[system]/manage-sets', params: { system } }),
  settings: (system) => ({ pathname: '/[system]/settings', params: { system } }),
};

export default function More() {
  const { lock } = useLock();
  const { system } = useCtx();
  return (
    <ManagementScreen
      onOpen={(t) => router.push(ROUTES[t](system))}
      onSwitch={() => router.replace('/')}
      onLock={lock}
    />
  );
}
