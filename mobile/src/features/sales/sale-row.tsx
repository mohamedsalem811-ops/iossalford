import { Pressable, View } from 'react-native';

import { Badge, Text } from '@/components';
import { PAYMENT_LABELS } from '@/domain/checkout';
import type { Sale } from '@/domain/sales';
import { formatDate, formatTime } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { radius, spacing, useTheme } from '@/theme';

import { saleReturned, saleSummary, salePieces } from './model';

/** One sale in the history: number, date, customer, payment, pieces and total. */
export function SaleRow({ sale, onPress }: { sale: Sale; onPress: () => void }) {
  const { colors } = useTheme();
  const when = new Date(sale.createdAt);
  const returned = saleReturned(sale);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`sale-${sale.id}`}
      style={({ pressed }) => ({
        marginBottom: spacing.sm,
        padding: spacing.md,
        gap: spacing.xxs,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="headline" style={{ flex: 1 }}>
          {`بيعة رقم ${sale.id}`}
        </Text>
        <Text variant="headline" tone="accent">
          {formatLyd(sale.total)}
        </Text>
      </View>
      <Text variant="subhead" tone="secondary" numberOfLines={1}>
        {[`${formatDate(when)} ${formatTime(when)}`, sale.customerName, `${salePieces(sale)} قطعة`]
          .filter(Boolean)
          .join(' • ')}
      </Text>
      <Text variant="caption" tone="secondary" numberOfLines={2}>
        {saleSummary(sale)}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xxs }}>
        <Badge
          label={PAYMENT_LABELS[sale.paymentMethod]}
          tone={sale.paymentMethod === 'credit' ? 'warning' : 'accent'}
        />
        {returned > 0 ? <Badge label={`مرتجع ${returned}`} tone="warning" /> : null}
      </View>
    </Pressable>
  );
}
