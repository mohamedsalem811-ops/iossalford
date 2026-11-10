import { FlashList } from '@shopify/flash-list';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { EmptyState, Text } from '@/components';
import { PAYMENT_LABELS, PAYMENT_METHODS } from '@/domain/checkout';
import { listSales, type SaleQuery } from '@/domain/sales';
import { monthsOf } from '@/features/sales/model';
import { SaleRow } from '@/features/sales/sale-row';
import { monthTitle } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { spacing } from '@/theme';

/** Management → Sales history: every checkout as one sale, by month and payment, searchable. */
export default function SalesRoute() {
  const ctx = useCtx();
  const [query, setQuery] = useState<SaleQuery>({});
  const read = useCallback(
    () => ({ shown: listSales(ctx, query), months: monthsOf(listSales(ctx)) }),
    [ctx, query],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const total = data.shown.reduce((t, s) => t + s.total, 0);
  const filtered = !!(query.search || query.month || query.paymentMethod);

  return (
    <>
      <Stack.Title>سجل المبيعات</Stack.Title>
      <Stack.SearchBar
        placeholder="القطعة أو الكود أو الزبون"
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={(e) => setQuery((q) => ({ ...q, search: e.nativeEvent.text }))}
        onCancelButtonPress={() => setQuery((q) => ({ ...q, search: '' }))}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            query.month || query.paymentMethod
              ? 'line.3.horizontal.decrease.circle.fill'
              : 'line.3.horizontal.decrease.circle'
          }
          title="فلترة"
          accessibilityLabel="فلترة المبيعات">
          <Stack.Toolbar.Menu inline title="الشهر">
            <Stack.Toolbar.MenuAction
              isOn={!query.month}
              onPress={() => setQuery((q) => ({ ...q, month: undefined }))}>
              كل الأشهر
            </Stack.Toolbar.MenuAction>
            {data.months.map((m) => (
              <Stack.Toolbar.MenuAction
                key={m}
                isOn={query.month === m}
                onPress={() => setQuery((q) => ({ ...q, month: m }))}>
                {monthTitle(m)}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu inline title="طريقة الدفع">
            <Stack.Toolbar.MenuAction
              isOn={!query.paymentMethod}
              onPress={() => setQuery((q) => ({ ...q, paymentMethod: undefined }))}>
              الكل
            </Stack.Toolbar.MenuAction>
            {PAYMENT_METHODS.map((m) => (
              <Stack.Toolbar.MenuAction
                key={m}
                isOn={query.paymentMethod === m}
                onPress={() => setQuery((q) => ({ ...q, paymentMethod: m }))}>
                {PAYMENT_LABELS[m]}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        data={data.shown}
        keyExtractor={(s) => String(s.id)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: spacing.md }}
        ListHeaderComponent={
          data.shown.length ? (
            <Text
              variant="caption"
              tone="secondary"
              style={{ paddingBottom: spacing.sm }}
              testID="sales-summary">
              {`${data.shown.length} بيعة • ${formatLyd(total)}${query.month ? ` • ${monthTitle(query.month)}` : ''}`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          filtered ? (
            <EmptyState
              icon="magnifyingglass"
              title="لا توجد نتائج"
              message="غيّر البحث أو الفلتر."
            />
          ) : (
            <EmptyState icon="cart" title="لا توجد مبيعات بعد" message="تظهر هنا كل عملية بيع." />
          )
        }
        renderItem={({ item }) => (
          <SaleRow
            sale={item}
            onPress={() =>
              router.push({
                pathname: '/[system]/sale/[id]',
                params: { system: ctx.system, id: String(item.id) },
              })
            }
          />
        )}
      />
    </>
  );
}
