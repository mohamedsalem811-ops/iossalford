import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { getOrder, orderPayments } from '@/domain/orders';
import { OrderDetail } from '@/features/orders/order-detail';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/more/order/3: deposit order 3, its payments and what can be done next. */
export default function OrderRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const { id } = useLocalSearchParams<{ id: string }>();
  const read = useCallback(
    () => ({ order: getOrder(ctx, Number(id)), payments: orderPayments(ctx, Number(id)) }),
    [ctx, id],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return (
    <>
      <Stack.Title>{`${data.order?.kind === 'hold' ? 'حجز' : 'طلب'} رقم ${id}`}</Stack.Title>
      <OrderDetail
        ctx={ctx}
        order={data.order}
        payments={data.payments}
        actions={{
          onPay: () =>
            router.push({ pathname: '/[system]/order-pay/[id]', params: { system, id } }),
          onBuy: () =>
            router.push({ pathname: '/[system]/order-buy/[id]', params: { system, id } }),
          onDeliver: () =>
            router.push({ pathname: '/[system]/checkout', params: { system, order: id } }),
          onReceipt: (receiptId) =>
            router.push({
              pathname: '/[system]/receipt/[id]',
              params: { system, id: String(receiptId) },
            }),
          onSale: (saleId) =>
            router.push({
              pathname: '/[system]/more/sale/[id]',
              params: { system, id: String(saleId) },
            }),
          onCustomer: (customerId) =>
            router.push({
              pathname: '/[system]/more/customer/[id]',
              params: { system, id: String(customerId) },
            }),
        }}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/order/[id]');
