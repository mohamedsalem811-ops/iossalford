import { router, useLocalSearchParams } from 'expo-router';

import { StockSheet } from '@/features/stock/stock-sheet';
import { useCtx } from '@/state/system-db';

/** /jewelry/stock/12: add or remove stock of piece 12 with a reason. */
export default function StockRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <StockSheet key={id} ctx={ctx} productId={Number(id)} onDone={() => router.back()} />;
}
