import { router, useLocalSearchParams } from 'expo-router';

import { OrderBuyView } from '@/features/orders/order-buy';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** /jewelry/order-buy/3: the owner marks order 3 bought (cost, date), or changes its date. */
export default function OrderBuyRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  // The owner's step: an employee opening it by a link sees «للمالك فقط» (its saving is refused too).
  return (
    <Allowed permission="orders.purchase" title="تم الشراء من المورد">
      <OrderBuyView
        ctx={ctx}
        orderId={Number(id)}
        onCancel={() => router.back()}
        onDone={() => router.back()}
      />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('order-buy/[id]');
