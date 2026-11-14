import { Pressable, View } from 'react-native';

import { Badge, Text } from '@/components';
import { shownName, shownPhone, type Customer } from '@/domain/customers';
import { useCan } from '@/staff/use-can';
import { useCtx } from '@/state/system-db';

import { CustomerAvatar } from './customer-avatar';
import { radius, spacing, useTheme } from '@/theme';

import { balanceText } from './model';

/** One customer: name, phone and area, and what they owe or are owed. */
export function CustomerRow({
  customer: c,
  balance,
  vip = false,
  spent,
  onPress,
}: {
  customer: Customer;
  balance: number;
  /** VIP (G1): by spending or the owner's choice. */
  vip?: boolean;
  /** What they spent, as this person may see it (a range for an employee). */
  spent?: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const owed = balanceText(balance);
  const full = useCan('customers.phones');
  const { system } = useCtx();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`customer-${c.name}`}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.ms,
        marginBottom: spacing.sm,
        padding: spacing.md,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}>
      <CustomerAvatar system={system} gender={c.gender} imageFile={c.imageFile} size={44} />
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {shownName(c.name, full)}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {[shownPhone(c.phone, full), c.area].filter(Boolean).join(' • ') || 'بدون هاتف'}
        </Text>
        {spent ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {spent}
          </Text>
        ) : null}
      </View>
      {vip ? <Badge label="VIP" tone="warning" /> : null}
      {owed ? <Badge label={owed} tone={balance > 0 ? 'warning' : 'accent'} /> : null}
    </Pressable>
  );
}
