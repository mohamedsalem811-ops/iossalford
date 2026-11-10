import { router, useLocalSearchParams } from 'expo-router';

import { ReturnForm } from '@/features/sales/return-form';
import { useCtx } from '@/state/system-db';

/** /jewelry/return/31 returns from sale line 31; /jewelry/return/new is a return without a sale. */
export default function ReturnRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const lineId = id === 'new' ? undefined : Number(id);
  return (
    <ReturnForm
      key={id}
      ctx={ctx}
      saleLineId={Number.isInteger(lineId) ? lineId : undefined}
      onDone={() => router.back()}
    />
  );
}
