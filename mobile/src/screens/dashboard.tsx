import { View } from 'react-native';

import { Button, HeroCard, ListGroup, ListRow, Logo, Screen, Stat, Text } from '@/components';
import { formatDay } from '@/lib/dates';
import { formatDinars, formatLyd, formatRate } from '@/lib/money';
import type { Today } from '@/domain/reports';
import { spacing, type SystemId } from '@/theme';

/**
 * The first tab: the system's logo in the centre, today's date and sales, and the exchange rate.
 * The full dashboard (charts, low stock, debts) comes with the reports phase.
 */
export function DashboardScreen({
  system,
  date,
  today,
  rate,
  onSwitch,
  onEditRate,
}: {
  system: SystemId;
  date: Date;
  today: Today;
  rate: number;
  onSwitch: () => void;
  /** Opens the rate editor; the dollar costs of new pieces use it. */
  onEditRate?: () => void;
}) {
  return (
    <Screen tabBar contentStyle={{ gap: spacing.lg }}>
      <View style={{ alignItems: 'center', gap: spacing.xs, paddingTop: spacing.sm }}>
        <Logo system={system} width={150} />
        <Text variant="subhead" tone="secondary" center>
          {formatDay(date, true)}
        </Text>
      </View>
      <HeroCard>
        <Text variant="subhead" tone="onAccent">
          مبيعات اليوم
        </Text>
        <Text variant="hero" tone="onAccent" testID="today-total">
          {formatLyd(today.total)}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Stat value={formatDinars(today.profit)} label="الربح" onAccent />
          <Stat value={String(today.sales)} label="فواتير" onAccent />
          <Stat
            value={String(today.pieces)}
            label={system === 'scarves' ? 'وشاح' : 'قطعة'}
            onAccent
          />
        </View>
      </HeroCard>
      <ListGroup>
        <ListRow
          icon="dollarsign.circle"
          title="سعر الصرف"
          value={formatRate(rate)}
          onPress={onEditRate}
          testID="rate-row"
        />
      </ListGroup>
      <Button
        title="تبديل النظام"
        icon="arrow.left.arrow.right"
        variant="secondary"
        fullWidth
        onPress={onSwitch}
      />
    </Screen>
  );
}
