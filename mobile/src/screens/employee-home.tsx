import { Pressable, View } from 'react-native';

import { Card, HeroCard, Screen, Stat, Text } from '@/components';
import { LatestCard } from '@/features/dashboard/cards';
import { Grid } from '@/features/dashboard/layout';
import type { MySales } from '@/features/dashboard/my-sales';
import { QuickActions } from '@/features/dashboard/quick-actions';
import { useLayout } from '@/hooks/use-layout';
import { formatLyd } from '@/lib/money';
import { spacing, type SystemId } from '@/theme';

import { DashboardHeader } from './dashboard';

/**
 * An employee's home screen: the shortcuts, then their own sales today and this month, and their
 * latest sales. No cost, profit, shop totals or reports. iPad: the two cards side by side.
 */
export function EmployeeHomeScreen({
  system,
  name,
  data,
  actions,
}: {
  system: SystemId;
  name: string;
  data: MySales;
  actions: {
    onSystemMenu: () => void;
    onOpenSale: (id: number) => void;
    onNewSale: () => void;
    onNewReceipt: () => void;
    onOpenAccount: () => void;
    onOpenShift: () => void;
  };
}) {
  const { dashboardColumns } = useLayout();
  return (
    <Screen tabBar maxWidth={1100} contentStyle={{ gap: spacing.lg }}>
      <DashboardHeader
        system={system}
        date={data.date}
        rate={data.rate}
        onSystemMenu={actions.onSystemMenu}
      />
      <Text variant="title" testID="employee-hello">{`أهلاً، ${name}`}</Text>
      {data.shiftOpen ? null : (
        <Pressable onPress={actions.onOpenShift} accessibilityRole="button" testID="open-shift">
          <Card>
            <Text variant="bodyStrong" tone="warning">
              افتح الوردية للبيع
            </Text>
            <Text variant="caption" tone="accent">
              عدّ النقد في الدرج وافتح الوردية
            </Text>
          </Card>
        </Pressable>
      )}
      <QuickActions
        system={system}
        onNewSale={actions.onNewSale}
        onNewReceipt={actions.onNewReceipt}
      />
      <Grid columns={Math.min(dashboardColumns, 2)}>
        <HeroCard style={{ flex: 1 }}>
          <Text variant="subhead" tone="onAccent">
            مبيعاتي اليوم
          </Text>
          <Text variant="hero" tone="onAccent" testID="my-today-total">
            {formatLyd(data.today.total)}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Stat value={String(data.today.count)} label="فواتير" onAccent />
          </View>
        </HeroCard>
        <Card style={{ flex: 1, gap: spacing.sm }}>
          <Text variant="subhead" tone="secondary">
            مبيعاتي هذا الشهر
          </Text>
          <Text variant="title" testID="my-month-total">
            {formatLyd(data.month.total)}
          </Text>
          <Stat value={String(data.month.count)} label="فواتير" />
        </Card>
      </Grid>
      {data.owed > 0 ? (
        <Pressable onPress={actions.onOpenAccount} accessibilityRole="button" testID="my-account">
          <Card>
            <Text variant="bodyStrong" tone="warning">
              {`على حسابي ${formatLyd(data.owed)}`}
            </Text>
            <Text variant="caption" tone="accent">
              عرض الحساب
            </Text>
          </Card>
        </Pressable>
      ) : null}
      <LatestCard data={data} onOpenSale={actions.onOpenSale} />
    </Screen>
  );
}
