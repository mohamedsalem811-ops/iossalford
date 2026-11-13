import { router, useLocalSearchParams } from 'expo-router';

import { ReturnForm } from '@/features/sales/return-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** /jewelry/return/31 returns from sale line 31; /jewelry/return/new is a return without a sale. */
function ReturnRouteScreen() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lineId = id === 'new' ? undefined : Number(id);
  // A return without a sale (sold before the app) is the owner's only.
  if (id === 'new')
    return (
      <Allowed permission="returns.noSale">
        <ReturnForm key={id} ctx={ctx} onDone={() => router.back()} />
      </Allowed>
    );
  return (
    <ReturnForm
      key={id}
      ctx={ctx}
      saleLineId={Number.isInteger(lineId) ? lineId : undefined}
      onDone={() => router.back()}
    />
  );
}

/** Guarded as a whole: only someone with `returns.create` can open it (see staff/permissions.ts). */
export default function ReturnRoute() {
  return (
    <Allowed permission="returns.create">
      <ReturnRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('return/[id]');
