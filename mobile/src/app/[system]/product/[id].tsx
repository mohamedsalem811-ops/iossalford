import { router, useLocalSearchParams } from 'expo-router';

import { ProductFormView } from '@/features/products/product-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** /jewelry/product/new adds a piece; /jewelry/product/12 edits piece 12. */
function ProductRouteScreen() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const productId = id === 'new' ? undefined : Number(id);
  return (
    <ProductFormView
      key={id}
      ctx={ctx}
      productId={Number.isInteger(productId) ? productId : undefined}
      onDone={() => router.back()}
    />
  );
}

/** Guarded as a whole: only someone with `products.edit` can open it (see staff/permissions.ts). */
export default function ProductRoute() {
  return (
    <Allowed permission="products.edit">
      <ProductRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('product/[id]');
