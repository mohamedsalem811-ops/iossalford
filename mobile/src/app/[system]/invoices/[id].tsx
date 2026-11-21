import { router, Stack, useLocalSearchParams } from 'expo-router';

import { errorBoundary } from '@/components/error-screen';
import { PieceInvoices } from '@/features/invoices/piece-invoices';
import { useCtx } from '@/state/system-db';

/** /jewelry/invoices/12: the original invoices of piece 12. */
export default function InvoicesRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Title>الفاتورة الأصلية</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>إغلاق</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <PieceInvoices key={id} ctx={ctx} productId={Number(id)} />
    </>
  );
}

export const ErrorBoundary = errorBoundary('invoices/[id]');
