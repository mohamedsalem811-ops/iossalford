import { Pressable, View } from 'react-native';

import { Badge, Icon, Text } from '@/components';
import type { Customer } from '@/domain/customers';
import { radius, spacing, useTheme } from '@/theme';

import { balanceText } from './model';

/** One customer: name, phone and area, and what they owe or are owed. */
export function CustomerRow({
  customer: c,
  balance,
  onPress,
}: {
  customer: Customer;
  balance: number;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const owed = balanceText(balance);
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
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: radius.full,
          backgroundColor: colors.accentSoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <Icon name="person.fill" size={18} color={colors.accent} />
      </View>
      <View style={{ flex: 1, gap: spacing.xxs }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {c.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {[c.phone, c.area].filter(Boolean).join(' • ') || 'بدون هاتف'}
        </Text>
      </View>
      {owed ? <Badge label={owed} tone={balance > 0 ? 'warning' : 'accent'} /> : null}
    </Pressable>
  );
}
