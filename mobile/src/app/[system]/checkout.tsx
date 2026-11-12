import { router } from 'expo-router';

import { CheckoutView } from '@/features/sale/checkout-view';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** Checkout of the system's cart; on success the sheet becomes the success screen. */
export default function CheckoutRoute() {
  const ctx = useCtx();
  return (
    <CheckoutView
      ctx={ctx}
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
