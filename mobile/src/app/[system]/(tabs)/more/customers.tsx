import { FlashList } from '@shopify/flash-list';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { EmptyState, Text } from '@/components';
import { listCustomers } from '@/domain/customers';
import { useCan } from '@/staff/use-can';
import { allBalances } from '@/domain/debts';
import { isVip, spendingByCustomer } from '@/domain/customer-stats';
import { getRewards } from '@/domain/rewards';
import { spendText } from '@/features/customers/model';
import { CustomerRow } from '@/features/customers/customer-row';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { useReadable } from '@/hooks/use-readable';
import { spacing } from '@/theme';
import { errorBoundary } from '@/components/error-screen';
import { useSearchShortcut, useShortcut } from '@/lib/key-commands';

/** Management → Customers: search by name, phone or area; add; open for details and debts. */
export default function CustomersRoute() {
  const ctx = useCtx();
  const readable = useReadable();
  const system = ctx.system;
  const searchRef = useSearchShortcut();
  const add = () =>
    router.push({ pathname: '/[system]/customer-form/[id]', params: { system, id: 'new' } });
  useShortcut('new', add);
  const [search, setSearch] = useState('');
  const fullPhones = useCan('customers.phones');
  const exactSpend = useCan('customers.spend');
  const read = useCallback(() => {
    const balances = allBalances(ctx);
    const rules = getRewards(ctx);
    const spending = spendingByCustomer(ctx, rules);
    return listCustomers(ctx, search, fullPhones).map((c) => {
      const spent = spending.get(c.id) ?? { spent: 0, inWindow: 0 };
      return {
        customer: c,
        balance: balances.get(c.id) ?? 0,
        vip: isVip(c.vip, spent.inWindow, rules),
        spent: spendText(spent.spent, exactSpend, rules.ranges),
      };
    });
  }, [ctx, search, fullPhones, exactSpend]);
  const [rows, setRows] = useState(read);
  const refresh = useCallback(() => setRows(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  return (
    <>
      <Stack.Title>الزبائن</Stack.Title>
      <Stack.SearchBar
        ref={searchRef}
        placeholder={fullPhones ? 'الاسم أو الهاتف أو المنطقة' : 'الاسم أو الرقم كاملاً أو المنطقة'}
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={(e) => setSearch(e.nativeEvent.text)}
        onCancelButtonPress={() => setSearch('')}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="gift"
          accessibilityLabel="متابعة الزبائن"
          onPress={() =>
            router.push({ pathname: '/[system]/more/customer-care', params: { system } })
          }>
          متابعة الزبائن
        </Stack.Toolbar.Button>
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="زبون جديد" onPress={add}>
          زبون جديد
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <FlashList
        data={rows}
        keyExtractor={(r) => String(r.customer.id)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListHeaderComponent={
          rows.length ? (
            <Text variant="caption" tone="secondary" style={{ paddingBottom: spacing.sm }}>
              {`${rows.length} زبون`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          search ? (
            <EmptyState icon="magnifyingglass" title="لا توجد نتائج" />
          ) : (
            <EmptyState
              icon="person.2"
              title="لا يوجد زبائن بعد"
              message="يُضاف الزبون تلقائياً عند البيع باسمه أو رقمه، أو من زر +."
            />
          )
        }
        renderItem={({ item }) => (
          <CustomerRow
            customer={item.customer}
            balance={item.balance}
            vip={item.vip}
            spent={item.spent}
            onPress={() =>
              router.push({
                pathname: '/[system]/more/customer/[id]',
                params: { system, id: String(item.customer.id) },
              })
            }
          />
        )}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/customers');
