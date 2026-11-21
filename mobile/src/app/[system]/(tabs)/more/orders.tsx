import { FlashList } from '@shopify/flash-list';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { EmptyState, Segmented, Text } from '@/components';
import { countOrders, depositsHeld, listOrders, type OrderQuery } from '@/domain/orders';
import { OrderRow } from '@/features/orders/order-row';
import { dayKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { usePaged } from '@/hooks/use-paged';
import { useReadable } from '@/hooks/use-readable';
import { useCan } from '@/staff/use-can';
import { spacing } from '@/theme';
import { errorBoundary } from '@/components/error-screen';
import { useSearchShortcut } from '@/lib/key-commands';
import { typed } from '@/lib/typing';

type Show = 'open' | 'done';

/**
 * Management → الطلبات بعربون (I2): pieces ordered for customers and pieces held for them, still
 * waiting (by expected date, the ones with none first) or done (delivered or cancelled).
 */
export default function OrdersRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const searchRef = useSearchShortcut();
  const readable = useReadable();
  const phones = useCan('customers.phones');
  const [query, setQuery] = useState<OrderQuery>({ show: 'open' });
  const shown = usePaged(
    useCallback(
      (limit: number, offset: number) => listOrders(ctx, query, { limit, offset }),
      [ctx, query],
    ),
  );
  const readFacts = useCallback(
    () => ({ held: depositsHeld(ctx), count: countOrders(ctx, query) }),
    [ctx, query],
  );
  const [facts, setFacts] = useState(readFacts);
  const refresh = useCallback(() => setFacts(readFacts()), [readFacts]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const today = dayKey(ctx.now());
  const newOrder = (kind: 'order' | 'hold') =>
    router.push({ pathname: '/[system]/order-form', params: { system, kind } });

  return (
    <>
      <Stack.Title>الطلبات بعربون</Stack.Title>
      <Stack.SearchBar
        ref={searchRef}
        placeholder="الزبون أو القطعة"
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={typed((e) => setQuery((q) => ({ ...q, search: e.nativeEvent.text })))}
        onCancelButtonPress={() => setQuery((q) => ({ ...q, search: '' }))}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu icon="plus" title="جديد" accessibilityLabel="طلب أو حجز جديد">
          <Stack.Toolbar.MenuAction icon="shippingbox" onPress={() => newOrder('order')}>
            طلب قطعة من المورد
          </Stack.Toolbar.MenuAction>
          <Stack.Toolbar.MenuAction icon="lock" onPress={() => newOrder('hold')}>
            حجز قطعة موجودة
          </Stack.Toolbar.MenuAction>
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        data={shown.items}
        onEndReached={shown.loadMore}
        onEndReachedThreshold={0.5}
        keyExtractor={(o) => String(o.id)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            <Segmented<Show>
              options={[
                { value: 'open', label: 'قيد الانتظار' },
                { value: 'done', label: 'المُسلّمة والملغاة' },
              ]}
              value={query.show === 'done' ? 'done' : 'open'}
              onChange={(show) => setQuery((q) => ({ ...q, show }))}
              testID="orders-show"
            />
            {query.show !== 'done' && facts.held.orders > 0 ? (
              <Text variant="caption" tone="secondary" testID="orders-held">
                {`${facts.held.orders} طلب • عربون محفوظ للزبائن ${formatLyd(facts.held.amount)}`}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.search ? (
            <EmptyState icon="magnifyingglass" title="لا توجد نتائج" message="غيّر البحث." />
          ) : query.show === 'done' ? (
            <EmptyState icon="shippingbox" title="لا توجد طلبات مُغلقة بعد" />
          ) : (
            <EmptyState
              icon="shippingbox"
              title="لا توجد طلبات بعربون"
              message="اضغط + لطلب قطعة من المورد لزبونة، أو لحجز قطعة موجودة بعربون."
            />
          )
        }
        renderItem={({ item }) => (
          <OrderRow
            order={item}
            today={today}
            phones={phones}
            onPress={() =>
              router.push({
                pathname: '/[system]/more/order/[id]',
                params: { system, id: String(item.id) },
              })
            }
          />
        )}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/orders');
