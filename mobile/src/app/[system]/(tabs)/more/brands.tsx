import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listBrands } from '@/domain/brands';
import { BrandsScreen } from '@/features/brands/brands-screen';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** Management → Brands. */
function BrandsRouteScreen() {
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

/** Guarded as a whole: only someone with `products.edit` can open it (see staff/permissions.ts). */
export default function BrandsRoute() {
  return (
    <Allowed permission="products.edit" title="الماركات">
      <BrandsRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/brands');
