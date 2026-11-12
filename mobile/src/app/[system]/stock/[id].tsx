import { router, useLocalSearchParams } from 'expo-router';

import { StockSheet } from '@/features/stock/stock-sheet';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/stock/12: add or remove stock of piece 12 with a reason. */
export default function StockRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StockSheet key={id} ctx={ctx} productId={Number(id)} onDone={() => router.back()} />;
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('stock/[id]');
