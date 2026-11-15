import { router, useLocalSearchParams } from 'expo-router';

import { OrderFormView } from '@/features/orders/order-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/**
 * /jewelry/order-form?kind=order (or hold, with product=12 or customer=4): a new deposit; once
 * taken, its receipt opens in place of the form.
 */
export default function OrderFormRoute() {
  const ctx = useCtx();
  const { kind, product, customer } = useLocalSearchParams<{
    kind?: string;
    product?: string;
    customer?: string;
  }>();
  return (
    <OrderFormView
      ctx={ctx}
      kind={kind === 'hold' || product ? 'hold' : 'order'}
      productId={product ? Number(product) : undefined}
      customerId={customer ? Number(customer) : undefined}
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
export const ErrorBoundary = errorBoundary('order-form');
