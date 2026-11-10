import { NativeTabs } from 'expo-router/native-tabs';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components';
import { formatLyd } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

/**
 * The cart bar above the tabs (iOS 26 tab bar accessory): pieces and total; tap opens the cart.
 * iOS draws it twice (full, and small inside the shrunk tab bar), so it keeps no state.
 */
export function CartAccessory({
  pieces,
  total,
  onOpen,
}: {
  pieces: number;
  total: number;
  onOpen: () => void;
}) {
  const { colors } = useTheme();
  const inline = NativeTabs.BottomAccessory.usePlacement() === 'inline';
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`السلة، ${pieces} قطعة، ${formatLyd(total)}. اضغط لفتحها`}
      testID="cart-bar"
      style={({ pressed }) => ({
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.sm,
        paddingHorizontal: spacing.md,
        opacity: pressed ? 0.6 : 1,
      })}>
      <Icon name="cart.fill" size={18} color={colors.accent} />
      {inline ? (
        <Text variant="subhead" numberOfLines={1} style={{ flex: 1 }}>
          {formatLyd(total)}
        </Text>
      ) : (
        <>
          <View style={{ flex: 1 }}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {`السلة • ${pieces} قطعة`}
            </Text>
          </View>
          <Text variant="headline" tone="accent" numberOfLines={1}>
            {formatLyd(total)}
          </Text>
          <Icon name="chevron.up" size={14} color={colors.textSecondary} />
        </>
      )}
    </Pressable>
  );
}
