import { router, useLocalSearchParams } from 'expo-router';

import { ProductFormView } from '@/features/products/product-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/product/new adds a piece; /jewelry/product/12 edits piece 12. */
export default function ProductRoute() {
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

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('product/[id]');
