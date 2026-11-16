import { Pressable, View } from 'react-native';

import { Badge, Text } from '@/components';
import { shownName } from '@/domain/customers';
import { STATUS_LABELS, type Order } from '@/domain/orders';
import { formatDate } from '@/lib/dates';
import { radius, spacing, useTheme } from '@/theme';

import { moneyLine, needsAttention, statusLine } from './model';

/** One deposit order in a list: what, for whom, its stage and its money. */
export function OrderRow({
  order,
  today,
  phones,
  onPress,
}: {
  order: Order;
  today: string;
  /** May this person see the customers' numbers (and so their full names, feature 26). */
  phones: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const warn = needsAttention(order, today);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`order-${order.id}`}
      style={({ pressed }) => ({
        marginBottom: spacing.sm,
        padding: spacing.md,
        gap: spacing.xxs,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
          {order.description}
        </Text>
        <Text variant="subhead" tone="secondary">
          {`رقم ${order.id}`}
        </Text>
      </View>
      <Text variant="subhead" tone="secondary" numberOfLines={1}>
        {[shownName(order.customerName, phones), formatDate(new Date(order.createdAt))].join(' • ')}
      </Text>
      <Text variant="caption" tone="secondary">
        {moneyLine(order)}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xxs }}>
        <Badge label={order.kind === 'hold' ? 'حجز' : 'طلب'} />
        <Badge
          label={
            order.status === 'cancelled' || order.status === 'delivered'
              ? STATUS_LABELS[order.status]
              : statusLine(order, today)
          }
          tone={warn ? 'warning' : 'accent'}
        />
      </View>
    </Pressable>
  );
}
