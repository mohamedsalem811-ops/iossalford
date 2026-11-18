import type { SymbolViewProps } from 'expo-symbols';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

export type QuickActionsProps = {
  system: SystemId;
  onNewSale: () => void;
  /** The owner's second row (I3): a new receipt and a new piece or design. */
  onNewReceipt?: () => void;
  onNewProduct?: () => void;
  /** Each one absent for someone who may not do it. */
  onNewOrder?: () => void;
  /** A repair taken in (J3), on the second row. */
  onNewRepair?: () => void;
  onReturn?: () => void;
  onDebtPayment?: () => void;
  onCustomer?: () => void;
};

/**
 * The home screen's shortcuts (I3): a new sale across the top, then طلب بعربون, مرتجع, دفعة دين
 * and زبون (each only for someone who may), and a second row with إيصال جديد and قطعة جديدة
 * (تصميم جديد for scarves) for the owner, and صيانة (J3) for whoever takes repairs.
 */
export function QuickActions({
  system,
  onNewSale,
  onNewReceipt,
  onNewProduct,
  onNewOrder,
  onNewRepair,
  onReturn,
  onDebtPayment,
  onCustomer,
}: QuickActionsProps) {
  const item = (
    onPress: (() => void) | undefined,
    title: string,
    icon: SymbolViewProps['name'],
    id: string,
  ): Item[] => (onPress ? [{ title, icon, onPress, id }] : []);
  const row = [
    ...item(onNewOrder, 'طلب بعربون', 'shippingbox.fill', 'quick-order'),
    ...item(onReturn, 'مرتجع', 'arrow.uturn.backward.circle.fill', 'quick-return'),
    ...item(onDebtPayment, 'دفعة دين', 'banknote.fill', 'quick-payment'),
    ...item(onCustomer, 'زبون', 'person.crop.circle.fill', 'quick-customer'),
  ];
  const second = [
    ...item(onNewReceipt, 'إيصال جديد', 'doc.text.fill', 'quick-receipt'),
    ...item(
      onNewProduct,
      system === 'scarves' ? 'تصميم جديد' : 'قطعة جديدة',
      'plus.square.fill',
      'quick-product',
    ),
    ...item(onNewRepair, 'صيانة', 'wrench.and.screwdriver.fill', 'quick-repair'),
  ];
  return (
    <View style={{ gap: spacing.sm }} testID="quick-actions">
      <Shortcut
        title="بيعة جديدة"
        icon="cart.badge.plus"
        main
        wide
        onPress={onNewSale}
        testID="quick-sale"
      />
      {[row, second].map((items, i) =>
        items.length ? (
          <View key={i} style={{ flexDirection: 'row', gap: spacing.sm }}>
            {items.map((x) => (
              <Shortcut
                key={x.id}
                title={x.title}
                icon={x.icon}
                onPress={x.onPress}
                testID={x.id}
              />
            ))}
          </View>
        ) : null,
      )}
    </View>
  );
}

type Item = { title: string; icon: SymbolViewProps['name']; onPress: () => void; id: string };

function Shortcut({
  title,
  icon,
  main = false,
  wide = false,
  onPress,
  testID,
}: {
  title: string;
  icon: SymbolViewProps['name'];
  main?: boolean;
  /** Across the whole width, icon beside the title. */
  wide?: boolean;
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
        flexDirection: wide ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: wide ? spacing.sm : spacing.xs,
        minHeight: wide ? 64 : 84,
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
      <Icon name={icon} size={wide ? 26 : 24} color={ink} />
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
