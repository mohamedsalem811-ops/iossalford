import { FlashList } from '@shopify/flash-list';
import * as Haptics from 'expo-haptics';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActionSheetIOS, Alert, Pressable, View } from 'react-native';

import { Badge, EmptyState, Text } from '@/components';
import { deleteReturn, getSaleLine, listReturns, type ReturnRecord } from '@/domain/sales';
import { showError } from '@/features/products/actions';
import { monthsOf } from '@/features/sales/model';
import { formatDate, monthTitle } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { useReadable } from '@/hooks/use-readable';
import { radius, spacing, useTheme } from '@/theme';

/** Management → Returns: every return by month; a return without a sale; delete one by mistake. */
export default function ReturnsRoute() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const system = ctx.system;
  const [month, setMonth] = useState<string | undefined>();
  const read = useCallback(
    () => ({ shown: listReturns(ctx, month), months: monthsOf(listReturns(ctx)) }),
    [ctx, month],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const total = data.shown.reduce((t, r) => t + r.refund, 0);

  const remove = (r: ReturnRecord) =>
    Alert.alert(
      'إلغاء المرتجع؟',
      `«${r.name}» × ${r.quantity}: تُسحب القطع من المخزون مرة أخرى، ويُلغى الاسترداد ${formatLyd(r.refund)}.`,
      [
        { text: 'تراجع', style: 'cancel' },
        {
          text: 'إلغاء المرتجع',
          style: 'destructive',
          onPress: () => {
            try {
              deleteReturn(ctx, r.id);
            } catch (error) {
              showError(error);
              return;
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            notifyDataChanged();
          },
        },
      ],
    );

  const menu = (r: ReturnRecord) => {
    const saleId = r.saleLineId ? getSaleLine(ctx, r.saleLineId)?.saleId : undefined;
    const items = [
      ...(saleId
        ? [
            {
              title: `فتح البيعة رقم ${saleId}`,
              run: () =>
                router.push({
                  pathname: '/[system]/sale/[id]',
                  params: { system, id: String(saleId) },
                }),
            },
          ]
        : []),
      { title: 'إلغاء المرتجع', run: () => remove(r) },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: r.name,
        options: [...items.map((i) => i.title), 'إغلاق'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: items.length - 1,
      },
      (i) => items[i]?.run(),
    );
  };

  return (
    <>
      <Stack.Title>المرتجعات</Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={month ? 'calendar.circle.fill' : 'calendar.circle'}
          title="الشهر"
          accessibilityLabel="الشهر">
          <Stack.Toolbar.MenuAction isOn={!month} onPress={() => setMonth(undefined)}>
            كل الأشهر
          </Stack.Toolbar.MenuAction>
          {data.months.map((m) => (
            <Stack.Toolbar.MenuAction key={m} isOn={month === m} onPress={() => setMonth(m)}>
              {monthTitle(m)}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel="مرتجع بدون فاتورة"
          onPress={() =>
            router.push({ pathname: '/[system]/return/[id]', params: { system, id: 'new' } })
          }
        />
      </Stack.Toolbar>
      <FlashList
        data={data.shown}
        keyExtractor={(r) => String(r.id)}
        contentInsetAdjustmentBehavior="automatic"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListHeaderComponent={
          <Text variant="caption" tone="secondary" style={{ paddingBottom: spacing.sm }}>
            {data.shown.length
              ? `${data.shown.length} مرتجع • ${formatLyd(total)}${month ? ` • ${monthTitle(month)}` : ''}`
              : 'لإرجاع قطعة من بيعة، افتح البيعة من سجل المبيعات. زر + لقطعة بيعت قبل التطبيق.'}
          </Text>
        }
        ListEmptyComponent={<EmptyState icon="arrow.uturn.backward" title="لا توجد مرتجعات" />}
        renderItem={({ item: r }) => (
          <Pressable
            onPress={() => menu(r)}
            onLongPress={() => menu(r)}
            accessibilityRole="button"
            testID={`return-${r.id}`}
            style={({ pressed }) => ({
              marginBottom: spacing.sm,
              padding: spacing.md,
              gap: spacing.xxs,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: pressed ? colors.accentSoft : colors.surface,
            })}>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Text variant="headline" style={{ flex: 1 }}>{`${r.name} × ${r.quantity}`}</Text>
              <Text variant="headline" tone="warning">
                {formatLyd(r.refund)}
              </Text>
            </View>
            <Text variant="caption" tone="secondary">
              {[formatDate(new Date(r.createdAt)), r.reason].filter(Boolean).join(' • ')}
            </Text>
            <View style={{ flexDirection: 'row' }}>
              <Badge label={r.saleLineId ? 'من بيعة' : 'بدون فاتورة'} />
            </View>
          </Pressable>
        )}
      />
    </>
  );
}
