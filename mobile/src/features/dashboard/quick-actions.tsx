import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

/** The home screen's shortcuts: a new sale (the main one), a new receipt, a new piece or design. */
export function QuickActions({
  system,
  onNewSale,
  onNewReceipt,
  onNewProduct,
}: {
  system: SystemId;
  onNewSale: () => void;
  onNewReceipt: () => void;
  onNewProduct: () => void;
}) {
  return (
    <View style={{ flexDirection: 'row', gap: spacing.sm }} testID="quick-actions">
      <Shortcut
        title="بيعة جديدة"
        icon="cart.badge.plus"
        main
        onPress={onNewSale}
        testID="quick-sale"
      />
      <Shortcut
        title="إيصال جديد"
        icon="doc.text.fill"
        onPress={onNewReceipt}
        testID="quick-receipt"
      />
      <Shortcut
        title={system === 'scarves' ? 'تصميم جديد' : 'قطعة جديدة'}
        icon="plus.square.fill"
        onPress={onNewProduct}
        testID="quick-product"
      />
    </View>
  );
}

function Shortcut({
  title,
  icon,
  main = false,
  onPress,
  testID,
}: {
  title: string;
  icon: 'cart.badge.plus' | 'doc.text.fill' | 'plus.square.fill';
  main?: boolean;
  onPress: () => void;
  testID: string;
}) {
  const { colors } = useTheme();
  const ink = main ? colors.onAccent : colors.text;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      testID={testID}
      style={({ pressed }) => ({
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.xs,
        minHeight: 84,
        paddingVertical: spacing.ms,
        paddingHorizontal: spacing.xs,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: main ? colors.accent : colors.surface,
        borderWidth: main ? 0 : 1,
        borderColor: colors.separator,
        boxShadow: main
          ? colors.floatingShadow
          : colors.cardShadow === 'none'
            ? undefined
            : colors.cardShadow,
        opacity: pressed ? 0.8 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <Icon name={icon} size={28} color={ink} />
      <Text
        variant="bodyStrong"
        center
        numberOfLines={1}
        adjustsFontSizeToFit
        style={{ color: ink }}>
        {title}
      </Text>
    </Pressable>
  );
}
