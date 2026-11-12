import { Pressable, View } from 'react-native';
import { Icon, Logo, Screen, Text } from '@/components';
import { type DashboardData } from '@/features/dashboard/model';
import { useLayout } from '@/hooks/use-layout';
import { formatDay, monthTitle, type MonthKey } from '@/lib/dates';
import { formatLyd, formatRate, formatUsd } from '@/lib/money';
import { radius, spacing, useTheme, type SystemId } from '@/theme';
import {
  AttentionCard,
  BreakdownCard,
  ChartCard,
  DetailsCard,
  EmptyMonth,
  LatestCard,
  StockTiles,
  TodayCard,
  type DashboardActions,
} from '@/features/dashboard/cards';
import { Grid, KpiTile, Split } from '@/features/dashboard/layout';

export type { DashboardActions };

/**
 * The first tab. iPhone: one column. iPad: the month's numbers as a row of tiles, the daily chart
 * wide with its details beside it, and the breakdowns in one card with a switch, so no card sits
 * half empty (Split View narrows it back to one column).
 */
export function DashboardScreen({
  system,
  data,
  actions,
}: {
  system: SystemId;
  data: DashboardData;
  actions: DashboardActions;
}) {
  const { dashboardColumns: columns } = useLayout();
  const wide = columns > 1;
  const piece = system === 'scarves' ? 'وشاح' : 'قطعة';
  const s = data.summary;
  const empty = s.transactions === 0 && s.refunds === 0;
  return (
    <Screen tabBar maxWidth={1400} contentStyle={{ gap: spacing.lg }}>
      <Header system={system} data={data} actions={actions} />
      <Grid columns={Math.min(columns, 2)}>
        <TodayCard data={data} piece={piece} />
        <AttentionCard data={data} actions={actions} />
      </Grid>
      <MonthPicker month={data.month} months={data.months} onMonth={actions.onMonth} />
      {empty ? (
        <EmptyMonth data={data} />
      ) : (
        <>
          <Grid columns={wide ? 4 : 2} testID="month-summary">
            <KpiTile
              label="المبيعات"
              value={formatLyd(s.grossSales)}
              sub={formatUsd(s.grossSalesUsd)}
            />
            <KpiTile
              label="ربح المبيعات"
              value={formatLyd(s.grossProfit)}
              sub={formatUsd(s.grossProfitUsd)}
            />
            <KpiTile
              label="صافي الربح"
              value={formatLyd(s.netProfit)}
              sub={formatUsd(s.netProfitUsd)}
              strong
            />
            <KpiTile
              label={system === 'scarves' ? 'الأوشحة المباعة' : 'القطع المباعة'}
              value={String(s.itemsSold)}
              sub={`${s.transactions} بيعة`}
            />
          </Grid>
          <Split wide={wide} ratio={2}>
            <ChartCard data={data} />
            <DetailsCard data={data} />
          </Split>
          <Split wide={wide}>
            <BreakdownCard system={system} data={data} piece={piece} />
            <LatestCard data={data} onOpenSale={actions.onOpenSale} />
          </Split>
        </>
      )}
      <StockTiles data={data} piece={piece} wide={wide} onOpen={actions.onOpenProducts} />
    </Screen>
  );
}

function Header({
  system,
  data,
  actions,
}: {
  system: SystemId;
  data: DashboardData;
  actions: DashboardActions;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
      <Pressable
        onPress={actions.onSystemMenu}
        accessibilityRole="button"
        accessibilityLabel="النظام: تبديل أو قفل"
        testID="dashboard-system">
        <Logo system={system} width={150} />
      </Pressable>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          alignSelf: 'stretch',
        }}>
        <Text variant="subhead" tone="secondary">
          {formatDay(data.date, true)}
        </Text>
        <Pressable
          onPress={actions.onEditRate}
          accessibilityRole="button"
          accessibilityLabel={`سعر الصرف ${formatRate(data.rate)}، تعديل`}
          testID="rate-row"
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.xs,
            paddingHorizontal: spacing.ms,
            paddingVertical: spacing.xs,
            borderRadius: radius.full,
            backgroundColor: colors.accentSoft,
          }}>
          <Icon name="dollarsign.circle" size={16} color={colors.accent} />
          <Text variant="subhead" tone="accent">
            {formatRate(data.rate)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function MonthPicker({
  month,
  months,
  onMonth,
}: {
  month: MonthKey;
  months: MonthKey[];
  onMonth: (m: MonthKey) => void;
}) {
  const { colors } = useTheme();
  const i = months.indexOf(month);
  const older = i >= 0 && i < months.length - 1 ? months[i + 1] : null;
  const newer = i > 0 ? months[i - 1] : null;
  const arrow = (
    to: MonthKey | null,
    icon: 'chevron.backward' | 'chevron.forward',
    label: string,
  ) => (
    <Pressable
      onPress={() => to && onMonth(to)}
      disabled={!to}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={12}
      style={{ opacity: to ? 1 : 0.3, padding: spacing.xs }}
      testID={icon === 'chevron.backward' ? 'month-older' : 'month-newer'}>
      <Icon name={icon} size={18} color={colors.accent} weight="semibold" />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      {arrow(older, 'chevron.backward', 'الشهر السابق')}
      <Text variant="title" testID="month-title">
        {monthTitle(month)}
      </Text>
      {arrow(newer, 'chevron.forward', 'الشهر التالي')}
    </View>
  );
}

/** A month without sales: one card instead of a column of empty ones. */
