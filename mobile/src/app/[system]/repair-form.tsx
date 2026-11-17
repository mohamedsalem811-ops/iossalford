import { router, useLocalSearchParams } from 'expo-router';

import { RepairFormView } from '@/features/repairs/repair-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/repair-form (or ?customer=4): a new repair; once taken, its ticket opens. */
export default function RepairFormRoute() {
  const ctx = useCtx();
  const { customer } = useLocalSearchParams<{ customer?: string }>();
  return (
    <RepairFormView
      ctx={ctx}
      customerId={customer ? Number(customer) : undefined}
      onCancel={() => router.back()}
      onDone={(repairId) =>
        router.replace({
          pathname: '/[system]/repair-ticket/[id]',
          params: { system: ctx.system, id: String(repairId) },
        })
      }
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('repair-form');
