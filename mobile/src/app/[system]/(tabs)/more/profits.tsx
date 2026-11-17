import { Stack, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Button, Card, EmptyState, ListGroup, ListRow, Page, Segmented, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  periodMonths,
  periodOf,
  periodTitle,
  profitRows,
  profitTotals,
  shiftPeriod,
  type ProfitPeriod,
  type ProfitSort,
} from '@/domain/profits';
import { levelTitle, printProfits, profitLine, rowLine } from '@/features/profits/report';
import { showError } from '@/features/products/actions';
import { monthKey } from '@/lib/dates';
import { logError } from '@/lib/error-log';
import { formatLyd } from '@/lib/money';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, type SystemId } from '@/theme';

const SHOP: Record<SystemId, string> = {
  jewelry: 'SALFORD المجوهرات',
  scarves: 'SALFORD الأوشحة',
};

type Params = {
  kind?: ProfitPeriod['kind'];
  key?: string;
  brand?: string;
  brandLabel?: string;
  category?: string;
  categoryLabel?: string;
};

/**
 * Management → المال → الأرباح (J4), the owner's: for a month, a quarter or a year, each brand's
 * sales, pieces, cost, profit and margin after returns. A brand opens its categories, a category
 * its pieces (each a screen of its own, so back returns to the level before). A PDF to share.
 */
function ProfitsScreen() {
  const ctx = useCtx();
  const system = ctx.system;
  const params = useLocalSearchParams<Params>();
  // Each key travels as "~key": a brand or category with no name ('') is still a level.
  const fromParam = (v?: string) => (v?.startsWith('~') ? v.slice(1) : undefined);
  const brand = fromParam(params.brand);
  const category = brand !== undefined ? fromParam(params.category) : undefined;
  const open = {
    ...(brand !== undefined ? { brand } : {}),
    ...(category !== undefined ? { category } : {}),
  };
  const [period, setPeriod] = useState<ProfitPeriod>(() =>
    params.kind && params.key
      ? ({ kind: params.kind, key: params.key } as ProfitPeriod)
      : { kind: 'month', key: monthKey(ctx.now()) },
  );
  const [sort, setSort] = useState<ProfitSort>('profit');
  const read = useCallback(
    () => profitRows(ctx, periodMonths(period), open, sort),
    // `open` comes from the route, fixed for this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, period, sort, brand, category],
  );
  const [rows, setRows] = useState(read);
  const refresh = useCallback(() => setRows(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const totals = profitTotals(rows);
  const level = levelTitle(open, { brand: params.brandLabel, category: params.categoryLabel });
  const now = monthKey(ctx.now());
  const atNow = periodOf(period.kind, now).key === period.key;
  const isPieces = open.brand !== undefined && open.category !== undefined;

  const drill = (r: (typeof rows)[number]) => {
    if (isPieces) return;
    router.push({
      pathname: '/[system]/more/profits',
      params: {
        system,
        kind: period.kind,
        key: period.key,
        ...(open.brand === undefined
          ? { brand: `~${r.key}`, brandLabel: r.label }
          : {
              brand: `~${open.brand}`,
              brandLabel: params.brandLabel ?? '',
              category: `~${r.key}`,
              categoryLabel: r.label,
            }),
      },
    });
  };

  const output = (mode: 'print' | 'share') =>
    printProfits(
      {
        shop: SHOP[system],
        period: periodTitle(period),
        level,
        rows: rows,
        totals,
        fileKey: period.key,
      },
      mode,
    ).catch((error) => {
      logError('تقرير الأرباح', error);
      showError(error);
    });

  return (
    <>
      <Stack.Title>{open.brand === undefined ? 'الأرباح' : level}</Stack.Title>
      <Page>
        {open.brand === undefined ? (
          <Segmented<ProfitPeriod['kind']>
            options={[
              { value: 'month', label: 'شهر' },
              { value: 'quarter', label: 'ربع' },
              { value: 'year', label: 'سنة' },
            ]}
            value={period.kind}
            onChange={(kind) => setPeriod(periodOf(kind, now))}
            testID="profits-kind"
          />
        ) : null}
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Button
              title="السابق"
              icon="chevron.forward"
              variant="secondary"
              onPress={() => setPeriod((p) => shiftPeriod(p, -1))}
              testID="profits-previous"
            />
            <View style={{ flex: 1 }}>
              <Text variant="headline" center testID="profits-period">
                {periodTitle(period)}
              </Text>
              <Text variant="caption" tone="secondary" center>
                {level}
              </Text>
            </View>
            <Button
              title="التالي"
              icon="chevron.backward"
              variant="secondary"
              disabled={atNow}
              onPress={() => setPeriod((p) => shiftPeriod(p, 1))}
              testID="profits-next"
            />
          </View>
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body">الربح</Text>
            <Text variant="headline" tone="accent" testID="profits-total">
              {profitLine(totals)}
            </Text>
          </View>
          <Text variant="caption" tone="secondary">
            {rowLine(totals)}
          </Text>
          <Text variant="caption" tone="secondary">
            بعد المرتجعات، من سعر وتكلفة كل بيعة يوم البيع. لا يشمل المصروفات ولا دخل الصيانة.
          </Text>
        </Card>

        <Segmented<ProfitSort>
          options={[
            { value: 'profit', label: 'حسب الربح' },
            { value: 'margin', label: 'حسب الهامش' },
          ]}
          value={sort}
          onChange={setSort}
          testID="profits-sort"
        />

        {rows.length ? (
          <ListGroup>
            {rows.map((r) => (
              <ListRow
                key={r.key}
                title={r.label}
                subtitle={rowLine(r)}
                value={profitLine(r)}
                tone={r.profit < 0 ? 'warning' : 'normal'}
                onPress={isPieces ? undefined : () => drill(r)}
                testID={`profits-row-${r.key}`}
              />
            ))}
          </ListGroup>
        ) : (
          <EmptyState icon="chart.bar" title="لا مبيعات في هذه الفترة" />
        )}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Button
              title="طباعة"
              icon="printer"
              variant="secondary"
              fullWidth
              onPress={() => output('print')}
              testID="profits-print"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="مشاركة PDF"
              icon="square.and.arrow.up"
              variant="secondary"
              fullWidth
              onPress={() => output('share')}
              testID="profits-share"
            />
          </View>
        </View>
        <Text variant="caption" tone="secondary" center>
          {`صافي المبيعات ${formatLyd(totals.netSales)}`}
        </Text>
      </Page>
    </>
  );
}

export default function ProfitsRoute() {
  return (
    <Allowed permission="costs.view" title="الأرباح">
      <ProfitsScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/profits');
