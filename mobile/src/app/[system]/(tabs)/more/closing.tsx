import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, ChipRow, ListGroup, ListRow, Page, Text, TextField } from '@/components';
import {
  closeQuarter,
  deleteClosing,
  existingClosing,
  listClosings,
  previewQuarter,
  type Closing,
} from '@/domain/closing';
import { recentQuarters } from '@/features/money/model';
import { formatDate, quarterKey, quarterTitle, type Quarter } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { spacing } from '@/theme';
import { errorBoundary } from '@/components/error-screen';
import { haptic } from '@/lib/haptics';
import { Allowed } from '@/staff/allowed';

/**
 * Management → Quarterly closing: choose a quarter, see what it totals (only its own sales,
 * returns and expenses), then issue or re-issue it. The history, and delete.
 */
function ClosingRouteScreen() {
  const ctx = useCtx();
  const quarters = recentQuarters(ctx.now());
  const [q, setQ] = useState<Quarter>(quarters[0]);
  const [notes, setNotes] = useState('');
  const read = useCallback(
    () => ({
      preview: previewQuarter(ctx, q),
      existing: existingClosing(ctx, q),
      history: listClosings(ctx),
    }),
    [ctx, q],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const p = data.preview;

  const issue = () =>
    Alert.alert(
      data.existing ? `إعادة إصدار إقفال ${quarterTitle(q)}؟` : `إقفال ${quarterTitle(q)}؟`,
      data.existing
        ? 'يُستبدل الإقفال السابق بأرقام الربع الحالية.'
        : 'يُحفظ ملخص الربع كما هو الآن. يمكن إعادة إصداره لاحقاً.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: data.existing ? 'إعادة إصدار' : 'إقفال',
          onPress: () => {
            closeQuarter(ctx, q, notes);
            haptic.success();
            setNotes('');
            notifyDataChanged();
          },
        },
      ],
    );

  const remove = (c: Closing) =>
    Alert.alert(`حذف إقفال ${c.title}؟`, 'لا تتأثر المبيعات ولا المصروفات.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          deleteClosing(ctx, c.id);
          notifyDataChanged();
        },
      },
    ]);

  return (
    <>
      <Stack.Title>الإقفال الربع سنوي</Stack.Title>
      <Page>
        <ChipRow
          options={quarters.map((x) => ({ value: quarterKey(x), label: quarterTitle(x) }))}
          value={quarterKey(q)}
          onChange={(k) => setQ(quarters.find((x) => quarterKey(x) === k)!)}
        />
        <Card>
          <Text variant="headline">{quarterTitle(q)}</Text>
          <Line label="المبيعات" value={formatLyd(p.grossSales)} />
          <Line label="تكلفة المبيعات" value={formatLyd(p.costOfSales)} />
          <Line label="الربح الإجمالي" value={formatLyd(p.grossProfit)} />
          <Line label="المرتجعات (المبالغ المعادة)" value={formatLyd(p.refunds)} />
          <Line label="المصروفات" value={formatLyd(p.expenses)} />
          <Line label="صافي الربح" value={formatLyd(p.netProfit)} strong testID="closing-net" />
          <Text variant="caption" tone="secondary">
            {`${p.transactions} بيعة • ${p.itemsSold} قطعة مباعة • ${p.itemsReturned} مرتجعة`}
          </Text>
        </Card>
        {data.existing ? (
          <Text variant="caption" tone="warning" testID="closing-existing">
            {`أُقفل هذا الربع في ${formatDate(new Date(data.existing.closedAt))} بصافي ربح ${formatLyd(data.existing.netProfit)}.`}
          </Text>
        ) : null}
        <TextField label="ملاحظات" value={notes} onChangeText={setNotes} placeholder="اختياري" />
        <Button
          title={data.existing ? 'إعادة إصدار الإقفال' : 'إقفال الربع'}
          icon="checkmark.seal"
          fullWidth
          onPress={issue}
          testID="closing-issue"
        />
        {data.history.length ? (
          <ListGroup header="الإقفالات السابقة" footer="اضغط على إقفال لحذفه.">
            {data.history.map((c) => (
              <ListRow
                key={c.id}
                icon="checkmark.seal"
                title={c.title}
                subtitle={`${formatDate(new Date(c.closedAt))} • ${c.transactions} بيعة${c.notes ? ` • ${c.notes}` : ''}`}
                value={formatLyd(c.netProfit)}
                onPress={() => remove(c)}
                chevron={false}
                testID={`closing-${c.periodKey}`}
              />
            ))}
          </ListGroup>
        ) : null}
      </Page>
    </>
  );
}

function Line({
  label,
  value,
  strong,
  testID,
}: {
  label: string;
  value: string;
  strong?: boolean;
  testID?: string;
}) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
      <Text variant={strong ? 'headline' : 'subhead'} tone={strong ? 'primary' : 'secondary'}>
        {label}
      </Text>
      <Text
        variant={strong ? 'headline' : 'subhead'}
        tone={strong ? 'accent' : 'primary'}
        testID={testID}>
        {value}
      </Text>
    </View>
  );
}

/** Guarded as a whole: only someone with `reports.view` can open it (see staff/permissions.ts). */
export default function ClosingRoute() {
  return (
    <Allowed permission="reports.view" title="الإقفال الربع سنوي">
      <ClosingRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/closing');
