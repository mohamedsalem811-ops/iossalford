import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ListGroup, ListRow, Page, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { staffReport } from '@/domain/staff-goals';
import { showError } from '@/features/products/actions';
import { creditBonusesFlow } from '@/features/staff/goal-actions';
import { personRows, personTitle, printStaffReport } from '@/features/staff/staff-report';
import { addMonths, monthKey, monthTitle, type MonthKey } from '@/lib/dates';
import { logError } from '@/lib/error-log';
import { formatLyd } from '@/lib/money';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { employeesOf } from '@/staff/model';
import { useStaff } from '@/staff/store';
import { spacing, type SystemId } from '@/theme';

const SHOP: Record<SystemId, string> = {
  jewelry: 'SALFORD المجوهرات',
  scarves: 'SALFORD الأوشحة',
};

/**
 * Management → تقرير الموظفين (phase L3, the owner only): each employee's month, best seller
 * first, any month back; adding an ended month's bonuses to the accounts; print or share as PDF.
 */
function StaffReportScreen() {
  const ctx = useCtx();
  const staff = useStaff();
  const people = useMemo(
    () => employeesOf(staff, ctx.system).map((e) => ({ key: `emp-${e.id}`, name: e.name })),
    [staff, ctx.system],
  );
  const thisMonth = monthKey(ctx.now());
  // The month that just ended first: the one whose bonus goes into the accounts.
  const [month, setMonth] = useState<MonthKey>(() => addMonths(thisMonth, -1));
  const read = useCallback(() => staffReport(ctx, month, people), [ctx, month, people]);
  const [report, setReport] = useState(read);
  const refresh = useCallback(() => setReport(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const current = report.month === month ? report : read();

  const output = (mode: 'print' | 'share') =>
    printStaffReport(current, SHOP[ctx.system], mode).catch((error) => {
      logError('تقرير الموظفين', error);
      showError(error);
    });

  return (
    <>
      <Stack.Title>تقرير الموظفين</Stack.Title>
      <Page>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Button
              title="السابق"
              icon="chevron.forward"
              variant="secondary"
              onPress={() => setMonth(addMonths(month, -1))}
              testID="report-previous"
            />
            <View style={{ flex: 1 }}>
              <Text variant="headline" center testID="report-title">
                {monthTitle(month)}
              </Text>
              <Text variant="caption" tone="secondary" center>
                {current.target ? `الهدف ${formatLyd(current.target)} لكل موظف` : 'بدون هدف'}
              </Text>
            </View>
            <Button
              title="التالي"
              icon="chevron.backward"
              variant="secondary"
              disabled={month >= thisMonth}
              onPress={() => setMonth(addMonths(month, 1))}
              testID="report-next"
            />
          </View>
        </Card>

        {current.ended && current.toCredit > 0 ? (
          <Button
            title="إضافة مكافآت الشهر إلى الحسابات"
            icon="gift"
            fullWidth
            onPress={() => creditBonusesFlow(ctx, month, monthTitle(month), people, refresh)}
            testID="report-credit"
          />
        ) : null}

        {current.rows.length ? (
          current.rows.map((r, i) => (
            <ListGroup key={r.key} header={personTitle(r, i + 1)}>
              {personRows(r, current.target, current.ended).map((line, j) => (
                <ListRow
                  key={line.label}
                  title={line.label}
                  value={line.value}
                  testID={`report-${r.key}-${j}`}
                />
              ))}
            </ListGroup>
          ))
        ) : (
          <Card>
            <Text variant="body" tone="secondary" testID="report-empty">
              لا يوجد موظفون في هذا النظام.
            </Text>
          </Card>
        )}

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
      </Page>
    </>
  );
}

export default function StaffReportRoute() {
  return (
    <Allowed permission="staff.manage" title="تقرير الموظفين">
      <StaffReportScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/staff-report');
