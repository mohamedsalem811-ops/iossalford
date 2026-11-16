import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';

import { getOrder } from '@/domain/orders';
import { CheckoutView } from '@/features/sale/checkout-view';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/**
 * Checkout of the system's cart, or (?order=3) the delivery of deposit order 3; on success the
 * sheet becomes the success screen.
 */
export default function CheckoutRoute() {
  const ctx = useCtx();
  const { order: orderId } = useLocalSearchParams<{ order?: string }>();
  const [order] = useState(() => (orderId ? getOrder(ctx, Number(orderId)) : undefined));
  return (
    <CheckoutView
      ctx={ctx}
      order={order}
      onCancel={() => router.back()}
      onSold={(saleId) =>
        router.replace({
          pathname: '/[system]/sold/[id]',
          params: { system: ctx.system, id: String(saleId) },
        })
      }
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('checkout');
