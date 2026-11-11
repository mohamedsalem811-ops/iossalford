import { router, useLocalSearchParams } from 'expo-router';

import { ReceiptStudio } from '@/features/receipts/receipt-studio';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/receipt/new makes a receipt by hand; /jewelry/receipt/7 opens receipt 7. */
export default function ReceiptRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const receiptId = id === 'new' ? undefined : Number(id);
  return (
    <ReceiptStudio
      key={id}
      ctx={ctx}
      receiptId={Number.isInteger(receiptId) ? receiptId : undefined}
      onDone={() => router.back()}
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('receipt/[id]');
