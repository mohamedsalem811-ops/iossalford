import { Pressable, View } from 'react-native';
import { Icon, Logo, Screen, Text } from '@/components';
import { type DashboardData } from '@/features/dashboard/model';
import { useLayout } from '@/hooks/use-layout';
import { formatDay } from '@/lib/dates';
import { formatRate } from '@/lib/money';
import { radius, spacing, useTheme, type SystemId } from '@/theme';
import {
  AttentionCard,
  BreakdownCard,
  ChartCard,
  EmptyMonth,
  LatestCard,
  StockTiles,
  TodayCard,
  type DashboardActions,
} from '@/features/dashboard/cards';
import { Grid, Split } from '@/features/dashboard/layout';
import { MonthSummary } from '@/features/dashboard/month-summary';
import { QuickActions } from '@/features/dashboard/quick-actions';

export type { DashboardActions };

/**
 * The first tab: the shortcuts (new sale, new receipt, new piece), today and what needs attention,
 * "ملخص الشهر" (four tiles, each with a dot comparing with the month before), the daily chart,
 * the breakdowns and the latest sales, then the stock. iPhone: one column; iPad: the cards fill
 * the width (Split View narrows it back to one column).
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
      <DashboardHeader
        system={system}
        date={data.date}
        rate={data.rate}
        onSystemMenu={actions.onSystemMenu}
        onEditRate={actions.onEditRate}
      />
      <QuickActions
        system={system}
        onNewSale={actions.onNewSale}
        onNewReceipt={actions.onNewReceipt}
        onNewProduct={actions.onNewProduct}
      />
      <Grid columns={Math.min(columns, 2)}>
        <TodayCard data={data} piece={piece} onOpenDay={actions.onOpenDay} />
        <AttentionCard data={data} actions={actions} />
      </Grid>
      <MonthSummary data={data} piece={piece} wide={wide} onMonth={actions.onMonth} />
      {empty ? (
        <EmptyMonth data={data} />
      ) : (
        <>
          <ChartCard data={data} />
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

/** The logo (switch system or lock), the date and the dollar rate (editable by the owner). */
export function DashboardHeader({
  system,
  date,
  rate,
  onSystemMenu,
  onEditRate,
}: {
  system: SystemId;
  date: Date;
  rate: number;
  onSystemMenu: () => void;
  /** Absent: the rate is shown, not editable. */
  onEditRate?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ alignItems: 'center', gap: spacing.sm, paddingTop: spacing.sm }}>
      <Pressable
        onPress={onSystemMenu}
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
          {formatDay(date, true)}
        </Text>
        <Pressable
          onPress={onEditRate}
          disabled={!onEditRate}
          accessibilityRole={onEditRate ? 'button' : 'text'}
          accessibilityLabel={`سعر الصرف ${formatRate(rate)}${onEditRate ? '، تعديل' : ''}`}
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
            {formatRate(rate)}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
