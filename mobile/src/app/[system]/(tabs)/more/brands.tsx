import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listBrands } from '@/domain/brands';
import { BrandsScreen } from '@/features/brands/brands-screen';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** Management → Brands. */
export default function BrandsRoute() {
  const ctx = useCtx();
  const read = useCallback(() => listBrands(ctx), [ctx]);
  const [brands, setBrands] = useState(read);
  const refresh = useCallback(() => setBrands(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return (
    <>
      <Stack.Title>الماركات</Stack.Title>
      <BrandsScreen ctx={ctx} brands={brands} />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/brands');
