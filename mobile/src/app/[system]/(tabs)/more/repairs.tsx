import { FlashList } from '@shopify/flash-list';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { EmptyState, FilterChip, Segmented, Text } from '@/components';
import {
  countRepairs,
  listRepairs,
  OPEN_REPAIR_STATUSES,
  REPAIR_STATUS_LABELS,
  repairDepositsHeld,
  type RepairQuery,
} from '@/domain/repairs';
import { RepairRow } from '@/features/repairs/repair-row';
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

type Show = 'open' | 'done';

/**
 * Management → الصيانة (J3): the pieces in the shop for repair, by ready date (filtered by stage),
 * or the ones delivered and cancelled; search by her name or phone, the piece or the ticket.
 */
export default function RepairsRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const searchRef = useSearchShortcut();
  const readable = useReadable();
  const phones = useCan('customers.phones');
  const [query, setQuery] = useState<RepairQuery>({ show: 'open' });
  const shown = usePaged(
    useCallback(
      (limit: number, offset: number) => listRepairs(ctx, query, { limit, offset }),
      [ctx, query],
    ),
  );
  const readFacts = useCallback(
    () => ({ held: repairDepositsHeld(ctx), count: countRepairs(ctx, query) }),
    [ctx, query],
  );
  const [facts, setFacts] = useState(readFacts);
  const refresh = useCallback(() => setFacts(readFacts()), [readFacts]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const today = dayKey(ctx.now());
  const done = query.show === 'done';

  return (
    <>
      <Stack.Title>الصيانة</Stack.Title>
      <Stack.SearchBar
        ref={searchRef}
        placeholder="الزبون أو القطعة أو رقم الإيصال"
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={(e) => setQuery((q) => ({ ...q, search: e.nativeEvent.text }))}
        onCancelButtonPress={() => setQuery((q) => ({ ...q, search: '' }))}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel="صيانة جديدة"
          onPress={() => router.push({ pathname: '/[system]/repair-form', params: { system } })}>
          صيانة جديدة
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <FlashList
        data={shown.items}
        onEndReached={shown.loadMore}
        onEndReachedThreshold={0.5}
        keyExtractor={(r) => String(r.id)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="on-drag"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            <Segmented<Show>
              options={[
                { value: 'open', label: 'في المحل' },
                { value: 'done', label: 'المُسلّمة والملغاة' },
              ]}
              value={done ? 'done' : 'open'}
              onChange={(show) => setQuery((q) => ({ ...q, show, status: undefined }))}
              testID="repairs-show"
            />
            {!done ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <FilterChip
                    label="الكل"
                    selected={!query.status}
                    onPress={() => setQuery((q) => ({ ...q, status: undefined }))}
                  />
                  {OPEN_REPAIR_STATUSES.map((s) => (
                    <FilterChip
                      key={s}
                      label={REPAIR_STATUS_LABELS[s]}
                      selected={query.status === s}
                      onPress={() =>
                        setQuery((q) => ({ ...q, status: q.status === s ? undefined : s }))
                      }
                      testID={`repairs-status-${s}`}
                    />
                  ))}
                </View>
              </ScrollView>
            ) : null}
            {!done && facts.held.repairs > 0 ? (
              <Text variant="caption" tone="secondary" testID="repairs-held">
                {`${facts.held.repairs} قطعة في المحل • عربون محفوظ ${formatLyd(facts.held.amount)}`}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          query.search ? (
            <EmptyState icon="magnifyingglass" title="لا توجد نتائج" message="غيّر البحث." />
          ) : done ? (
            <EmptyState icon="wrench.and.screwdriver" title="لا توجد صيانة مُغلقة بعد" />
          ) : (
            <EmptyState
              icon="wrench.and.screwdriver"
              title="لا توجد قطع للصيانة"
              message="اضغط + لاستلام قطعة زبونة للصيانة."
            />
          )
        }
        renderItem={({ item }) => (
          <RepairRow
            repair={item}
            today={today}
            phones={phones}
            onPress={() =>
              router.push({
                pathname: '/[system]/more/repair/[id]',
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
export const ErrorBoundary = errorBoundary('more/repairs');
