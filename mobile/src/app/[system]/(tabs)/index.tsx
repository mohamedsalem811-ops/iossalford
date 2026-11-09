import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { today } from '@/domain/reports';
import { getRate } from '@/domain/settings';
import { DashboardScreen } from '@/screens/dashboard';
import { useCtx } from '@/state/system-db';

export default function Dashboard() {
  const ctx = useCtx();
  const read = useCallback(
    () => ({ date: ctx.now(), today: today(ctx), rate: getRate(ctx) }),
    [ctx],
  );
  const [data, setData] = useState(read);
  // Fresh figures each time the tab comes back into view (after a sale, a return...).
  useFocusEffect(useCallback(() => setData(read()), [read]));
  return <DashboardScreen system={ctx.system} {...data} onSwitch={() => router.replace('/')} />;
}
