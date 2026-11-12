import { router, useLocalSearchParams } from 'expo-router';

import { PaymentForm } from '@/features/customers/payment-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/payment/4: money received from customer 4 towards their debt. */
export default function PaymentRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PaymentForm key={id} ctx={ctx} customerId={Number(id)} onDone={() => router.back()} />;
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('payment/[id]');
