import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import { Card, Page, Segmented, Text } from '@/components';
import { monthlyComparison } from '@/domain/reports';
import { barShares, monthWindow } from '@/features/money/model';
import { monthTitle } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { radius, spacing, useTheme } from '@/theme';
import { errorBoundary } from '@/components/error-screen';

const RANGES = [
  { value: '3', label: '3 أشهر' },
  { value: '6', label: '6 أشهر' },
  { value: '12', label: '12 شهراً' },
] as const;
type Range = (typeof RANGES)[number]['value'];

/** Management → Monthly comparison: net sales and net profit month by month, for a chosen range. */
export default function ComparisonRoute() {
  const ctx = useCtx();
  const { colors } = useTheme();
  const [range, setRange] = useState<Range>('6');
  const read = useCallback(() => {
    const w = monthWindow(ctx.now(), Number(range));
    return monthlyComparison(ctx, w.from, w.to);
  }, [ctx, range]);
  const [rows, setRows] = useState(read);
  const refresh = useCallback(() => setRows(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const sales = barShares(rows.map((r) => r.netSales));
  const profit = barShares(rows.map((r) => r.netProfit));
  const total = rows.reduce((t, r) => t + r.netSales, 0);
  const totalProfit = rows.reduce((t, r) => t + r.netProfit, 0);

  return (
    <>
      <Stack.Title>مقارنة الأشهر</Stack.Title>
      <Page>
        <Segmented
          options={[...RANGES]}
          value={range}
          onChange={setRange}
          testID="comparison-range"
        />
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <Legend color={colors.accent} label="صافي المبيعات" />
            <Legend color={colors.warning} label="صافي الربح" />
          </View>
          {rows.map((r, i) => (
            <View
              key={r.month}
              accessible
              accessibilityLabel={`${monthTitle(r.month)}: مبيعات ${formatLyd(r.netSales)}، ربح ${formatLyd(r.netProfit)}`}
              style={{ gap: spacing.xxs }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text variant="subhead">{monthTitle(r.month)}</Text>
                <Text variant="caption" tone="secondary">{`${r.transactions} بيعة`}</Text>
              </View>
              <Bar
                share={sales[i]}
                color={colors.accent}
                track={colors.accentSoft}
                value={formatLyd(r.netSales)}
              />
              <Bar
                share={profit[i]}
                color={r.netProfit < 0 ? colors.textSecondary : colors.warning}
                track={colors.accentSoft}
                value={formatLyd(r.netProfit)}
              />
            </View>
          ))}
        </Card>
        <Card>
          <Text variant="subhead" tone="secondary">{`مجموع ${rows.length} شهر`}</Text>
          <Text variant="headline" testID="comparison-total">{`المبيعات ${formatLyd(total)}`}</Text>
          <Text variant="headline" tone="accent">{`الربح ${formatLyd(totalProfit)}`}</Text>
        </Card>
      </Page>
    </>
  );
}

function Bar({
  share,
  color,
  track,
  value,
}: {
  share: number;
  color: string;
  track: string;
  value: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          flex: 1,
          height: 10,
          borderRadius: radius.full,
          backgroundColor: track,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${Math.round(share * 100)}%`,
            height: '100%',
            borderRadius: radius.full,
            backgroundColor: color,
          }}
        />
      </View>
      <Text variant="caption" style={{ minWidth: 84, textAlign: 'left' }}>
        {value}
      </Text>
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
      <View style={{ width: 10, height: 10, borderRadius: radius.full, backgroundColor: color }} />
      <Text variant="caption" tone="secondary">
        {label}
      </Text>
    </View>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/comparison');
