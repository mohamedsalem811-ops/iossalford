import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { errorBoundary } from '@/components/error-screen';
import { listProducts } from '@/domain/products';
import { ArchivedScreen } from '@/features/products/archived-screen';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';

/** Management → Archived pieces: deleted after they were sold, kept for their sales. */
export default function ArchivedRoute() {
  const ctx = useCtx();
  const read = useCallback(() => listProducts(ctx, { archived: true, sort: 'name' }), [ctx]);
  const [products, setProducts] = useState(read);
  const refresh = useCallback(() => setProducts(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return (
    <>
      <Stack.Title>القطع المؤرشفة</Stack.Title>
      <ArchivedScreen ctx={ctx} products={products} />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/archived');
