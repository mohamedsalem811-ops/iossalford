import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { getCustomer, shownName } from '@/domain/customers';
import { useCan } from '@/staff/use-can';
import { balance, payments, statement } from '@/domain/debts';
import { listSales } from '@/domain/sales';
import { CustomerDetail } from '@/features/customers/customer-detail';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/customer/4: a customer's details, statement, purchases and payments. */
export default function CustomerRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const { id } = useLocalSearchParams<{ id: string }>();
  const customerId = Number(id);
  const read = useCallback(
    () => ({
      customer: getCustomer(ctx, customerId),
      balance: balance(ctx, customerId),
      lines: statement(ctx, customerId),
      sales: listSales(ctx, { customerId }),
      payments: payments(ctx, customerId),
    }),
    [ctx, customerId],
  );
  const fullPhone = useCan('customers.phones');
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return (
    <>
      <Stack.Title>
        {data.customer ? shownName(data.customer.name, fullPhone) : 'الزبون'}
      </Stack.Title>
      <CustomerDetail
        ctx={ctx}
        {...data}
        onEdit={() =>
          router.push({ pathname: '/[system]/customer-form/[id]', params: { system, id } })
        }
        onPay={() => router.push({ pathname: '/[system]/payment/[id]', params: { system, id } })}
        onSale={(saleId) =>
          router.push({
            pathname: '/[system]/more/sale/[id]',
            params: { system, id: String(saleId) },
          })
        }
        onDeleted={() => router.back()}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/customer/[id]');
