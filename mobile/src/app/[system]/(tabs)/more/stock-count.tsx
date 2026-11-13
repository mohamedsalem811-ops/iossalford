import { FlashList } from '@shopify/flash-list';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Card, EmptyState, ListGroup, ListRow, Text, TextField } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  cancelCount,
  COUNT_STATUS_LABELS,
  countPiece,
  countProgress,
  countSheet,
  listCounts,
  openCount,
  startCount,
  submitCount,
  type CountSheetRow,
} from '@/domain/stock-count';
import { showError } from '@/features/products/actions';
import { usePaged } from '@/hooks/use-paged';
import { useReadable } from '@/hooks/use-readable';
import { useSaveOnce } from '@/hooks/use-save-once';
import { formatDay, formatTime } from '@/lib/dates';
import { latinDigits } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { useCan } from '@/staff/use-can';
import { radius, spacing, useTheme } from '@/theme';

const at = (stamp: string) => `${formatDay(new Date(stamp))} ${formatTime(new Date(stamp))}`;
const pieceName = (r: Pick<CountSheetRow, 'name' | 'size'>) =>
  r.size ? `${r.name} (${r.size})` : r.name;

/**
 * Management → Stock count (phase S6). Anyone who sells counts the pieces: tap a piece, type how
 * many are there. The stock is never shown (a blind count). When done, the count goes to the
 * owner, who sees the differences (the count's own screen) and applies them. The owner also sees
 * the past counts here.
 */
function StockCountScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const owner = useCan('counts.view');
  const onceStart = useSaveOnce(true);
  const onceSubmit = useSaveOnce(true);
  const [search, setSearch] = useState('');
  const read = useCallback(() => {
    const open = openCount(ctx);
    return {
      open,
      progress: open ? countProgress(ctx, open.id) : null,
      past: owner ? listCounts(ctx, { limit: 20, offset: 0 }) : [],
    };
  }, [ctx, owner]);
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const countId = data.open?.id;
  const sheet = usePaged(
    useCallback(
      (limit: number, offset: number) =>
        countId ? countSheet(ctx, countId, search, { limit, offset }) : [],
      [ctx, countId, search],
    ),
  );

  const done = () => {
    haptic.success();
    notifyDataChanged();
    refresh();
    return true;
  };

  const start = () => {
    try {
      startCount(ctx);
    } catch (error) {
      showError(error);
      return;
    }
    return done();
  };

  const enter = (row: CountSheetRow) =>
    Alert.prompt(
      pieceName(row),
      'كم قطعة موجودة؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حفظ',
          onPress: (text?: string) => {
            const n = Number(latinDigits(text ?? '').trim());
            if (!(text ?? '').trim() || !Number.isInteger(n)) {
              haptic.error();
              Alert.alert('لم يتم الحفظ', 'اكتب عدد القطع (صفر أو أكثر).');
              return;
            }
            try {
              countPiece(ctx, countId!, row.productId, n);
            } catch (error) {
              showError(error);
              return;
            }
            done();
          },
        },
      ],
      'plain-text',
      row.counted === null ? '' : String(row.counted),
      'number-pad',
    );

  const submit = () =>
    Alert.alert(
      'إنهاء الجرد؟',
      `عُدّت ${data.progress?.counted ?? 0} من ${data.progress?.total ?? 0} قطعة. القطع التي لم تُعدّ تبقى كما هي. يُرسل الجرد للمالك ولا يمكن تعديله بعد ذلك.`,
      [
        { text: 'متابعة العد', style: 'cancel' },
        {
          text: 'إنهاء وإرسال',
          onPress: () =>
            onceSubmit(() => {
              try {
                submitCount(ctx, countId!);
              } catch (error) {
                showError(error);
                return;
              }
              return done();
            }),
        },
      ],
    );

  const cancel = () =>
    Alert.alert('إلغاء الجرد؟', 'لن يتغير المخزون.', [
      { text: 'رجوع', style: 'cancel' },
      {
        text: 'إلغاء الجرد',
        style: 'destructive',
        onPress: () => {
          try {
            cancelCount(ctx, countId!);
          } catch (error) {
            showError(error);
            return;
          }
          done();
        },
      },
    ]);

  const openPast = (id: number) =>
    router.push({
      pathname: '/[system]/more/count/[id]',
      params: { system: ctx.system, id: String(id) },
    });

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      {data.open ? (
        <Card testID="count-open">
          <Text variant="headline">{`الجرد رقم ${data.open.id}`}</Text>
          <Text variant="caption" tone="secondary">
            {`بدأه ${data.open.byName} • ${at(data.open.startedAt)}`}
          </Text>
          <Text variant="bodyStrong" testID="count-progress">
            {`عُدّ ${data.progress?.counted ?? 0} من ${data.progress?.total ?? 0}`}
          </Text>
          <Text variant="caption" tone="secondary">
            اضغط على القطعة واكتب العدد الموجود فعلاً. لا يظهر المخزون أثناء الجرد.
          </Text>
          <Button
            title="إنهاء الجرد وإرساله للمالك"
            icon="checkmark.circle.fill"
            fullWidth
            onPress={submit}
            testID="count-submit"
          />
          {owner ? (
            <Button
              title="إلغاء الجرد"
              variant="secondary"
              fullWidth
              onPress={cancel}
              testID="count-cancel"
            />
          ) : null}
        </Card>
      ) : (
        <Card>
          <Text variant="headline">جرد المخزون</Text>
          <Text variant="caption" tone="secondary">
            عُدّ القطع الموجودة في المحل. يرى المالك الفروق بعد إنهاء الجرد ويطبقها على المخزون.
          </Text>
          <Button
            title="بدء جرد جديد"
            icon="list.number"
            size="lg"
            fullWidth
            onPress={() => onceStart(start)}
            testID="count-start"
          />
        </Card>
      )}
      {data.open ? (
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث بالاسم أو الرمز"
          returnKeyType="search"
          testID="count-search"
        />
      ) : null}
    </View>
  );

  const footer =
    owner && data.past.length ? (
      <View style={{ paddingTop: spacing.md }}>
        <ListGroup header="الجرد السابق">
          {data.past
            .filter((c) => c.status !== 'open')
            .map((c) => (
              <ListRow
                key={c.id}
                title={`الجرد رقم ${c.id} • ${COUNT_STATUS_LABELS[c.status]}`}
                subtitle={`${c.byName} • ${at(c.startedAt)} • ${c.pieces} قطعة`}
                tone={c.status === 'submitted' ? 'warning' : 'normal'}
                onPress={() => openPast(c.id)}
                testID={`count-${c.id}`}
              />
            ))}
        </ListGroup>
      </View>
    ) : null;

  return (
    <>
      <Stack.Title>جرد المخزون</Stack.Title>
      <FlashList
        data={sheet.items}
        onEndReached={sheet.loadMore}
        onEndReachedThreshold={0.5}
        keyExtractor={(r) => String(r.productId)}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        ListEmptyComponent={
          data.open ? <EmptyState icon="magnifyingglass" title="لا توجد قطع بهذا الاسم" /> : null
        }
        renderItem={({ item: r }) => (
          <Pressable
            onPress={() => enter(r)}
            accessibilityRole="button"
            accessibilityLabel={`${pieceName(r)}، ${r.counted === null ? 'لم تُعدّ' : `عُدّ ${r.counted}`}`}
            testID={`count-row-${r.productId}`}
            style={({ pressed }) => ({
              marginBottom: spacing.sm,
              padding: spacing.md,
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.md,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: pressed ? colors.accentSoft : colors.surface,
            })}>
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text variant="headline">{pieceName(r)}</Text>
              <Text variant="caption" tone="secondary">
                {r.sku}
              </Text>
            </View>
            <Text
              variant="title"
              tone={r.counted === null ? 'secondary' : 'accent'}
              testID={`count-value-${r.productId}`}>
              {r.counted === null ? '—' : String(r.counted)}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}

/** Anyone who sells (`stock.count`); the past counts and their differences are the owner's. */
export default function StockCountRoute() {
  return (
    <Allowed permission="stock.count" title="جرد المخزون">
      <StockCountScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/stock-count');
