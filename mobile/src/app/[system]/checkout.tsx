import { router } from 'expo-router';

import { CheckoutView } from '@/features/sale/checkout-view';
import { useCtx } from '@/state/system-db';

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
