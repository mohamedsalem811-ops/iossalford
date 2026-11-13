import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView } from 'react-native';

import { Button, Card, EmptyState, ListGroup, ListRow, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  applyCount,
  cancelCount,
  COUNT_STATUS_LABELS,
  costText,
  countResult,
  type CountLine,
} from '@/domain/stock-count';
import { showError } from '@/features/products/actions';
import { useReadable } from '@/hooks/use-readable';
import { useSaveOnce } from '@/hooks/use-save-once';
import { formatDay, formatTime } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, useTheme } from '@/theme';

const at = (stamp: string) => `${formatDay(new Date(stamp))} ${formatTime(new Date(stamp))}`;
const lineName = (l: CountLine) => (l.size ? `${l.name} (${l.size})` : l.name);
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0');

/**
 * A stock count's result (phase S6, the owner): what was counted against the stock when each
 * piece was counted, the missing and extra pieces (also at cost), the pieces nobody counted, and
 * "apply" to change the stock with the reason "جرد", or cancel.
 */
function CountReviewScreen() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const readable = useReadable();
  const { colors } = useTheme();
  const once = useSaveOnce();
  const read = useCallback(() => countResult(ctx, Number(id)), [ctx, id]);
  const [result, setResult] = useState(read);
  const refresh = useCallback(() => setResult(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  if (!result) return <EmptyState icon="list.number" title="الجرد غير موجود" />;
  const { count } = result;
  const different = result.lines.filter((l) => l.difference !== 0);

  const done = () => {
    haptic.success();
    notifyDataChanged();
    refresh();
    return true;
  };

  const apply = () =>
    Alert.alert(
      'تطبيق الفروق على المخزون؟',
      `${different.length} قطعة يتغير مخزونها: ناقص ${result.missingPieces}، زائد ${result.extraPieces}. يُسجَّل كل تغيير بسبب «جرد رقم ${count.id}».`,
      [
        { text: 'رجوع', style: 'cancel' },
        {
          text: 'تطبيق',
          onPress: () =>
            once(() => {
              try {
                applyCount(ctx, count.id);
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
            cancelCount(ctx, count.id);
          } catch (error) {
            showError(error);
            return;
          }
          done();
        },
      },
    ]);

  const pending = count.status === 'open' || count.status === 'submitted';
  return (
    <>
      <Stack.Title>{`الجرد رقم ${count.id}`}</Stack.Title>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic">
        <Card>
          <Text variant="headline" testID="count-status">
            {COUNT_STATUS_LABELS[count.status]}
          </Text>
          <Text variant="caption" tone="secondary">
            {[
              `بدأه ${count.byName} • ${at(count.startedAt)}`,
              count.submittedAt
                ? `أنهاه ${count.submittedByName} • ${at(count.submittedAt)}`
                : null,
              count.doneAt
                ? `${count.status === 'applied' ? 'طبّقه' : 'ألغاه'} ${count.doneByName} • ${at(count.doneAt)}`
                : null,
            ]
              .filter(Boolean)
              .join('\n')}
          </Text>
          <Text variant="bodyStrong" testID="count-summary">
            {`ناقص ${result.missingPieces} • زائد ${result.extraPieces} • مطابق ${result.matching}`}
          </Text>
          {result.costDifference ? (
            <Text
              variant="body"
              tone={result.costDifference < 0 ? 'warning' : undefined}
              testID="count-cost">
              {`الفرق بالتكلفة ${costText(result.costDifference)}`}
            </Text>
          ) : null}
          <Text variant="caption" tone="secondary">
            {`${result.uncounted} قطعة لم تُعدّ وتبقى كما هي.`}
          </Text>
        </Card>
        {different.length ? (
          <ListGroup header="الفروق">
            {different.map((l) => (
              <ListRow
                key={l.productId}
                title={lineName(l)}
                subtitle={`المتوقع ${l.expected} • المعدود ${l.counted}${l.applied !== null && l.applied !== l.difference ? ` • طُبّق ${signed(l.applied)}` : ''}`}
                value={signed(l.difference)}
                tone={l.difference < 0 ? 'warning' : 'normal'}
                testID={`count-line-${l.productId}`}
              />
            ))}
          </ListGroup>
        ) : (
          <Text variant="body" tone="secondary" testID="count-no-difference">
            كل القطع المعدودة مطابقة للمخزون.
          </Text>
        )}
        {count.status === 'submitted' ? (
          <Button
            title="تطبيق الفروق على المخزون"
            icon="checkmark.circle.fill"
            size="lg"
            fullWidth
            onPress={apply}
            testID="count-apply"
          />
        ) : null}
        {count.status === 'open' ? (
          <Text variant="caption" tone="secondary">
            الجرد ما زال جارياً: يمكن تطبيقه بعد إنهائه.
          </Text>
        ) : null}
        {pending ? (
          <Button
            title="إلغاء الجرد"
            variant="secondary"
            fullWidth
            onPress={cancel}
            testID="count-cancel-review"
          />
        ) : null}
      </ScrollView>
    </>
  );
}

/** The owner only (`counts.view`): the differences are never shown to who counted. */
export default function CountReviewRoute() {
  return (
    <Allowed permission="counts.view" title="نتائج الجرد">
      <CountReviewScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/count');
