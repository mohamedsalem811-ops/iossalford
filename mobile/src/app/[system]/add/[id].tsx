import { router, useLocalSearchParams } from 'expo-router';

import { AddSheet } from '@/features/sale/add-sheet';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/add/12: add piece 12 to the cart with a chosen quantity and price. */
export default function AddRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <AddSheet key={id} ctx={ctx} productId={Number(id)} onDone={() => router.back()} />;
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('add/[id]');
