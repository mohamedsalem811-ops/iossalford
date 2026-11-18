import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { getRepair, repairPayments } from '@/domain/repairs';
import { RepairDetail } from '@/features/repairs/repair-detail';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/more/repair/3: repair 3, its payments and what can be done next. */
export default function RepairRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const { id } = useLocalSearchParams<{ id: string }>();
  const read = useCallback(
    () => ({ repair: getRepair(ctx, Number(id)), payments: repairPayments(ctx, Number(id)) }),
    [ctx, id],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return (
    <>
      <Stack.Title>{data.repair?.ticketNo ?? 'الصيانة'}</Stack.Title>
      <RepairDetail
        ctx={ctx}
        repair={data.repair}
        payments={data.payments}
        actions={{
          onTicket: () =>
            router.push({ pathname: '/[system]/repair-ticket/[id]', params: { system, id } }),
          onCustomer: (customerId) =>
            router.push({
              pathname: '/[system]/more/customer/[id]',
              params: { system, id: String(customerId) },
            }),
        }}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/repair/[id]');
