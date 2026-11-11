import { FlashList } from '@shopify/flash-list';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { EmptyState, Text } from '@/components';
import { PAYMENT_LABELS, PAYMENT_METHODS } from '@/domain/checkout';
import { listSales, saleMonths, salesSummary, type SaleQuery } from '@/domain/sales';
import { SaleRow } from '@/features/sales/sale-row';
import { monthTitle } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { usePaged } from '@/hooks/use-paged';
import { useReadable } from '@/hooks/use-readable';
import { spacing } from '@/theme';
import { errorBoundary } from '@/components/error-screen';

/** Management → Sales history: every checkout as one sale, by month and payment, searchable. */
export default function SalesRoute() {
  const ctx = useCtx();
  const readable = useReadable();
  const [query, setQuery] = useState<SaleQuery>({});
  const shown = usePaged(
    useCallback(
      (limit: number, offset: number) => listSales(ctx, query, { limit, offset }),
      [ctx, query],
    ),
  );
  const readFacts = useCallback(
    () => ({ months: saleMonths(ctx), summary: salesSummary(ctx, query) }),
    [ctx, query],
  );
  const [facts, setFacts] = useState(readFacts);
  const refreshFacts = useCallback(() => setFacts(readFacts()), [readFacts]);
  useFocusEffect(refreshFacts);
  useOnDataChanged(refreshFacts);
  const data = { shown: shown.items, months: facts.months };
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
        onEndReached={shown.loadMore}
        onEndReachedThreshold={0.5}
        keyExtractor={(s) => String(s.id)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListHeaderComponent={
          data.shown.length ? (
            <Text
              variant="caption"
              tone="secondary"
              style={{ paddingBottom: spacing.sm }}
              testID="sales-summary">
              {`${facts.summary.count} بيعة • ${formatLyd(facts.summary.total)}${query.month ? ` • ${monthTitle(query.month)}` : ''}`}
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
                pathname: '/[system]/more/sale/[id]',
                params: { system: ctx.system, id: String(item.id) },
              })
            }
          />
        )}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/sales');
