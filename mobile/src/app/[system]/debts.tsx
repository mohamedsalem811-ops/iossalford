import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { Card, EmptyState, Page, Text } from '@/components';
import { creditBalances, debtors } from '@/domain/debts';
import { CustomerRow } from '@/features/customers/customer-row';
import { formatLyd } from '@/lib/money';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { spacing } from '@/theme';

/** Management → Debts: who owes money and the total; customers the shop owes ("له رصيد"). */
export default function DebtsRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const read = useCallback(() => ({ owing: debtors(ctx), owed: creditBalances(ctx) }), [ctx]);
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const total = data.owing.reduce((t, d) => t + d.balance, 0);
  const open = (id: number) =>
    router.push({ pathname: '/[system]/customer/[id]', params: { system, id: String(id) } });

  return (
    <>
      <Stack.Title>الديون</Stack.Title>
      <Page>
        <Card>
          <Text variant="subhead" tone="secondary">
            مجموع الديون على الزبائن
          </Text>
          <Text variant="hero" tone={total > 0 ? 'warning' : 'accent'} testID="debts-total">
            {formatLyd(total)}
          </Text>
          <Text variant="caption" tone="secondary">
            {`${data.owing.length} زبون • البيع الآجل ناقص المرتجعات والدفعات`}
          </Text>
        </Card>
        {data.owing.length === 0 ? (
          <EmptyState icon="checkmark.seal" title="لا توجد ديون" />
        ) : (
          data.owing.map((d) => (
            <CustomerRow
              key={d.customer.id}
              customer={d.customer}
              balance={d.balance}
              onPress={() => open(d.customer.id)}
            />
          ))
        )}
        {data.owed.length ? (
          <>
            <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
              له رصيد (المحل مدين للزبون)
            </Text>
            {data.owed.map((d) => (
              <CustomerRow
                key={d.customer.id}
                customer={d.customer}
                balance={d.balance}
                onPress={() => open(d.customer.id)}
              />
            ))}
          </>
        ) : null}
      </Page>
    </>
  );
}
