import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import { receiptForSale } from '@/domain/receipts';
import { getSale } from '@/domain/sales';
import { SaleDetail } from '@/features/sales/sale-detail';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/sale/12: sale 12 with its lines, returns and receipt. */
export default function SaleRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const { id } = useLocalSearchParams<{ id: string }>();
  const read = useCallback(
    () => ({ sale: getSale(ctx, Number(id)), receipt: receiptForSale(ctx, Number(id)) }),
    [ctx, id],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return (
    <>
      <Stack.Title>{`بيعة رقم ${id}`}</Stack.Title>
      <SaleDetail
        ctx={ctx}
        sale={data.sale}
        receipt={data.receipt}
        onReturn={(lineId) =>
          router.push({ pathname: '/[system]/return/[id]', params: { system, id: String(lineId) } })
        }
        onReceipt={(receiptId) =>
          router.push({
            pathname: '/[system]/receipt/[id]',
            params: { system, id: String(receiptId) },
          })
        }
        onCustomer={(customerId) =>
          router.push({
            pathname: '/[system]/more/customer/[id]',
            params: { system, id: String(customerId) },
          })
        }
        onDeleted={() => router.back()}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/sale/[id]');
