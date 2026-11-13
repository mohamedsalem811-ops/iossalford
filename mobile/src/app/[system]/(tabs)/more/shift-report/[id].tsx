import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Button, Card, EmptyState, ListGroup, ListRow, NumberField, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  cashMoves,
  chargeShortage,
  closeShift,
  shiftForReport,
  shiftTotals,
  shortageCharge,
} from '@/domain/shifts';
import { showError } from '@/features/products/actions';
import { printShiftReport, reportRows, type ShiftReport } from '@/features/shifts/report';
import { useReadable } from '@/hooks/use-readable';
import { useSaveOnce } from '@/hooks/use-save-once';
import { formatDay, formatTime } from '@/lib/dates';
import { parseThousandths } from '@/lib/digits';
import { logError } from '@/lib/error-log';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { useCan } from '@/staff/use-can';
import { spacing, useTheme, type SystemId } from '@/theme';

const SHOP: Record<SystemId, string> = {
  jewelry: 'SALFORD المجوهرات',
  scarves: 'SALFORD الأوشحة',
};

const at = (stamp: string) => `${formatDay(new Date(stamp))} ${formatTime(new Date(stamp))}`;

/**
 * A shift's report (phase S5): sales by payment method, returns, discounts, approvals, the cash
 * moves and the count. The owner reads any shift, puts a shortage on the employee's account and
 * can close a shift the employee left open; a person reads their own. Printable as a PDF.
 */
function ShiftReportScreen() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const readable = useReadable();
  const { colors } = useTheme();
  const owner = useCan('staff.ledger');
  const once = useSaveOnce(true);
  const read = useCallback((): (ShiftReport & { charged: boolean }) | null => {
    let shift;
    try {
      shift = shiftForReport(ctx, Number(id));
    } catch {
      return null;
    }
    if (!shift) return null;
    return {
      shift,
      totals: shiftTotals(ctx, shift),
      moves: cashMoves(ctx, shift.id),
      shop: SHOP[ctx.system],
      charged: !!shortageCharge(ctx, shift.id),
    };
  }, [ctx, id]);
  const [report, setReport] = useState(read);
  const refresh = useCallback(() => setReport(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const [counted, setCounted] = useState('');

  if (!report) return <EmptyState icon="lock" title="الوردية غير موجودة أو ليست لك" />;
  const { shift } = report;
  const employee = shift.person.startsWith('emp-');
  const short = (shift.difference ?? 0) < 0;

  const done = () => {
    haptic.success();
    notifyDataChanged();
    refresh();
    return true;
  };

  const charge = () =>
    Alert.alert(
      'تحميل العجز على الموظف؟',
      `${formatLyd(-(shift.difference ?? 0))} على حساب ${shift.personName}.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تحميل',
          style: 'destructive',
          onPress: () =>
            once(() => {
              try {
                chargeShortage(ctx, shift.id);
              } catch (error) {
                showError(error);
                return;
              }
              return done();
            }),
        },
      ],
    );

  const closeForThem = () => {
    const value = counted.trim() ? parseThousandths(counted) : null;
    if (value === null) {
      haptic.error();
      Alert.alert('لم تُغلق الوردية', 'عدّ النقد في الدرج واكتبه بالدينار.');
      return;
    }
    once(() => {
      try {
        closeShift(ctx, value, { shiftId: shift.id, note: 'أغلقها المالك' });
      } catch (error) {
        showError(error);
        return;
      }
      setCounted('');
      return done();
    });
  };

  const output = (mode: 'print' | 'share') =>
    printShiftReport(report, mode).catch((error) => {
      logError('تقرير الوردية', error);
      showError(error);
    });

  return (
    <>
      <Stack.Title>{`تقرير الوردية ${shift.id}`}</Stack.Title>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="headline" testID="report-person">
            {shift.personName}
          </Text>
          <Text variant="caption" tone="secondary">
            {shift.closedAt
              ? `${at(shift.openedAt)} ← ${at(shift.closedAt)}${shift.closedByName ? ` • أغلقها ${shift.closedByName}` : ''}`
              : `مفتوحة منذ ${at(shift.openedAt)}`}
          </Text>
          {shift.note ? <Text variant="caption">{`ملاحظة: ${shift.note}`}</Text> : null}
        </Card>
        <ListGroup>
          {reportRows(report).map((r, i) => (
            <ListRow key={r.label} title={r.label} value={r.value} testID={`report-row-${i}`} />
          ))}
        </ListGroup>
        {report.moves.length ? (
          <ListGroup header="حركات النقد">
            {report.moves.map((m) => (
              <ListRow
                key={m.id}
                title={m.reason}
                subtitle={m.kind === 'in' ? 'إدخال' : 'إخراج'}
                value={`${m.kind === 'in' ? '+' : '−'}${formatLyd(m.amount)}`}
              />
            ))}
          </ListGroup>
        ) : null}
        {owner && employee && short ? (
          report.charged ? (
            <Text variant="bodyStrong" tone="secondary" testID="report-charged">
              العجز على حساب الموظف
            </Text>
          ) : (
            <Button
              title="تحميل العجز على الموظف"
              icon="person.crop.circle.badge.exclamationmark"
              variant="secondary"
              fullWidth
              onPress={charge}
              testID="report-charge"
            />
          )
        ) : null}
        {owner && !shift.closedAt && employee ? (
          <Card>
            <Text variant="headline">إغلاق نيابة عن الموظف</Text>
            <NumberField
              label="النقد المعدود"
              value={counted}
              onChangeText={setCounted}
              suffix="د.ل"
              testID="report-counted"
            />
            <Button
              title="إغلاق الوردية"
              variant="secondary"
              onPress={closeForThem}
              testID="report-close"
            />
          </Card>
        ) : null}
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="طباعة"
              icon="printer"
              variant="secondary"
              fullWidth
              onPress={() => output('print')}
              testID="report-print"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="مشاركة PDF"
              icon="square.and.arrow.up"
              variant="secondary"
              fullWidth
              onPress={() => output('share')}
              testID="report-share"
            />
          </View>
        </View>
      </ScrollView>
    </>
  );
}

/** Checked inside: the owner, or the person whose shift it is. */
export default ShiftReportScreen;

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/shift-report');
