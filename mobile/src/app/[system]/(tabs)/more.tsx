import { router } from 'expo-router';

import { ManagementScreen } from '@/screens/management';
import { useLock } from '@/state/lock';

export default function More() {
  const { lock } = useLock();
  return <ManagementScreen onSwitch={() => router.replace('/')} onLock={lock} />;
}
