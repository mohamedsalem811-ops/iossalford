import { Stack, router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, ListGroup, ListRow, Page, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { daySummary, nextDay, previousDay } from '@/domain/day-summary';
import { dayTitle, daySections, printDaySummary, shiftLine } from '@/features/day-summary/report';
import { showError } from '@/features/products/actions';
import { dayKey } from '@/lib/dates';
import { logError } from '@/lib/error-log';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, type SystemId } from '@/theme';

const SHOP: Record<SystemId, string> = {
  jewelry: 'SALFORD المجوهرات',
  scarves: 'SALFORD الأوشحة',
};

/**
 * Management → End-of-day summary: one day's sales, cash, returns and shifts on one page, any
 * day back, to print or share as a PDF each evening.
 */
function DaySummaryScreen() {
  const ctx = useCtx();
  const today = dayKey(ctx.now());
  const [day, setDay] = useState(today);
  const read = useCallback(() => daySummary(ctx, day), [ctx, day]);
  const [summary, setSummary] = useState(read);
  const refresh = useCallback(() => setSummary(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const current = summary.day === day ? summary : read();

  const output = (mode: 'print' | 'share') =>
    printDaySummary(current, SHOP[ctx.system], mode).catch((error) => {
      logError('ملخص اليوم', error);
      showError(error);
    });

  const openShift = (id: number) =>
    router.push({
      pathname: '/[system]/more/shift-report/[id]',
      params: { system: ctx.system, id: String(id) },
    });

  return (
    <>
      <Stack.Title>ملخص اليوم</Stack.Title>
      <Page>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Button
              title="السابق"
              icon="chevron.forward"
              variant="secondary"
              onPress={() => setDay(previousDay(day))}
              testID="day-previous"
            />
            <View style={{ flex: 1 }}>
              <Text variant="headline" center testID="day-title">
                {dayTitle(day)}
              </Text>
              {day === today ? (
                <Text variant="caption" tone="secondary" center>
                  اليوم
                </Text>
              ) : null}
            </View>
            <Button
              title="التالي"
              icon="chevron.backward"
              variant="secondary"
              disabled={day >= today}
              onPress={() => setDay(nextDay(day))}
              testID="day-next"
            />
          </View>
        </Card>

        {daySections(current).map((section, s) => (
          <ListGroup key={section.title} header={section.title}>
            {section.rows.map((r, i) => (
              <ListRow key={r.label} title={r.label} value={r.value} testID={`day-row-${s}-${i}`} />
            ))}
          </ListGroup>
        ))}

        <ListGroup header="الورديات">
          {current.shifts.length ? (
            current.shifts.map((s) => {
              const line = shiftLine(s);
              const short = (s.shift.difference ?? 0) < 0;
              return (
                <ListRow
                  key={s.shift.id}
                  icon="tray.full"
                  title={line.label}
                  subtitle={line.value}
                  tone={short ? 'warning' : 'normal'}
                  onPress={() => openShift(s.shift.id)}
                  testID={`day-shift-${s.shift.id}`}
                />
              );
            })
          ) : (
            <ListRow title="لا ورديات في هذا اليوم" testID="day-no-shifts" />
          )}
        </ListGroup>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="طباعة"
              icon="printer"
              variant="secondary"
              fullWidth
              onPress={() => output('print')}
              testID="day-print"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="مشاركة PDF"
              icon="square.and.arrow.up"
              variant="secondary"
              fullWidth
              onPress={() => output('share')}
              testID="day-share"
            />
          </View>
        </View>
      </Page>
    </>
  );
}

export default function DaySummaryRoute() {
  return (
    <Allowed permission="reports.view" title="ملخص اليوم">
      <DaySummaryScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/day-summary');
