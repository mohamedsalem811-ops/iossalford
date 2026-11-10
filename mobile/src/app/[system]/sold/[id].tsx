import { router, useLocalSearchParams } from 'expo-router';

import { SoldView } from '@/features/sale/sold-view';
import { useCtx } from '@/state/system-db';

/** /jewelry/sold/12: sale 12 was just saved. */
export default function SoldRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <SoldView
      key={id}
      ctx={ctx}
      saleId={Number(id)}
      onNewSale={() => router.back()}
      onReceipt={(receiptId) =>
        router.push({
          pathname: '/[system]/receipt/[id]',
          params: { system: ctx.system, id: String(receiptId) },
        })
      }
    />
  );
}
