import { Pressable, View } from 'react-native';

import { Card, HeroCard, Screen, Stat, Text } from '@/components';
import { LatestCard } from '@/features/dashboard/cards';
import { Grid } from '@/features/dashboard/layout';
import type { MySales } from '@/features/dashboard/my-sales';
import { QuickActions } from '@/features/dashboard/quick-actions';
import { ShiftBar } from '@/features/dashboard/shift-bar';
import { GiftRemindersCard, type GiftRemindersProps } from '@/features/marketing/gift-reminders';
import { OrderRemindersCard, type OrderRemindersProps } from '@/features/orders/reminders-card';
import { RepairRemindersCard, type RepairRemindersProps } from '@/features/repairs/reminders-card';
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
  orders,
  repairs,
  gifts,
}: {
  system: SystemId;
  name: string;
  data: MySales;
  /** The deposit reminders (I2). */
  orders?: OrderRemindersProps;
  /** Repairs due, late, or ready and not collected (J3). */
  repairs?: RepairRemindersProps;
  /** The gift reminders a week before (I4). */
  gifts?: GiftRemindersProps;
  actions: {
    onSystemMenu: () => void;
    onOpenSale: (id: number) => void;
    onNewSale: () => void;
    onNewOrder?: () => void;
    onNewRepair?: () => void;
    onReturn?: () => void;
    onDebtPayment?: () => void;
    onCustomer?: () => void;
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
      <ShiftBar shift={data.shift} onOpen={actions.onOpenShift} />
      <Text variant="title" testID="employee-hello">{`أهلاً، ${name}`}</Text>
      <QuickActions
        system={system}
        onNewSale={actions.onNewSale}
        onNewOrder={actions.onNewOrder}
        onNewRepair={actions.onNewRepair}
        onReturn={actions.onReturn}
        onDebtPayment={actions.onDebtPayment}
        onCustomer={actions.onCustomer}
      />
      {orders ? <OrderRemindersCard {...orders} /> : null}
      {repairs ? <RepairRemindersCard {...repairs} /> : null}
      {gifts ? <GiftRemindersCard {...gifts} /> : null}
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
