import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { today } from '@/domain/reports';
import { getRate } from '@/domain/settings';
import { promptRate } from '@/features/settings/rate';
import { DashboardScreen } from '@/screens/dashboard';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

export default function Dashboard() {
  const ctx = useCtx();
  const read = useCallback(
    () => ({ date: ctx.now(), today: today(ctx), rate: getRate(ctx) }),
    [ctx],
  );
  const [data, setData] = useState(read);
  // Fresh figures each time the tab comes back into view (after a sale, a return...).
  useFocusEffect(useCallback(() => setData(read()), [read]));
  return (
    <DashboardScreen
      system={ctx.system}
      {...data}
      onSwitch={() => router.replace('/')}
      onEditRate={() => promptRate(ctx, () => setData(read()))}
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('dashboard');
