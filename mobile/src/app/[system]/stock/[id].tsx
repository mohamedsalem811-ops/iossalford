import { router, useLocalSearchParams } from 'expo-router';

import { StockSheet } from '@/features/stock/stock-sheet';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** /jewelry/stock/12: add or remove stock of piece 12 with a reason. */
function StockRouteScreen() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StockSheet key={id} ctx={ctx} productId={Number(id)} onDone={() => router.back()} />;
}

/** Guarded as a whole: only someone with `stock.adjust` can open it (see staff/permissions.ts). */
export default function StockRoute() {
  return (
    <Allowed permission="stock.adjust">
      <StockRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('stock/[id]');
