import { router, useLocalSearchParams } from 'expo-router';

import { OrderPayView } from '@/features/orders/order-pay';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/order-pay/3: another payment on order 3; its receipt opens after. */
export default function OrderPayRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <OrderPayView
      ctx={ctx}
      orderId={Number(id)}
      onCancel={() => router.back()}
      onDone={(receiptId) =>
        router.replace({
          pathname: '/[system]/receipt/[id]',
          params: { system: ctx.system, id: String(receiptId) },
        })
      }
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('order-pay/[id]');
