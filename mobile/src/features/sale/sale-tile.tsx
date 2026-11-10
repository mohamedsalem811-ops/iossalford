import { Pressable, View } from 'react-native';

import { Badge, Text } from '@/components';
import type { Product, ScarfDesign } from '@/domain/products';
import { ProductPhoto } from '@/features/products/product-photo';
import { priceRange } from '@/features/scarves/model';
import { formatLyd } from '@/lib/money';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

/**
 * A product in the sale grid: photo, name, price and the stock still free to add. Tap adds one
 * (scarves open the size picker); long-press chooses quantity and price first.
 */
export function SaleTile({
  system,
  width,
  item,
  free,
  inCart,
  onPress,
  onLongPress,
}: {
  system: SystemId;
  width: number;
  item: { kind: 'piece'; product: Product } | { kind: 'design'; design: ScarfDesign };
  /** Pieces still free to add (stock minus the cart). */
  free: number;
  /** Pieces of it already in the cart. */
  inCart: number;
  onPress: () => void;
  onLongPress?: () => void;
}) {
  const { colors } = useTheme();
  const first = item.kind === 'piece' ? item.product : item.design.sizes[0];
  const name = item.kind === 'piece' ? item.product.name : item.design.name;
  const price = item.kind === 'piece' ? formatLyd(item.product.price) : priceRange(item.design);
  const sizes = item.kind === 'design' ? item.design.sizes.length : 0;
  const out = free <= 0;
  const stockText = out
    ? inCart > 0
      ? 'كل المتوفر في السلة'
      : 'نفد المخزون'
    : `متوفر ${free}${sizes > 1 ? ` • ${sizes} مقاسات` : ''}`;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={350}
      accessibilityRole="button"
      accessibilityLabel={`${name}، ${price}، ${stockText}`}
      accessibilityHint={
        item.kind === 'design' ? 'اختر المقاس' : 'إضافة للسلة، اضغط مطولاً لاختيار الكمية والسعر'
      }
      testID={`sale-tile-${name}`}
      style={({ pressed }) => ({
        width,
        padding: spacing.sm,
        gap: spacing.xs,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        boxShadow: colors.cardShadow === 'none' ? undefined : colors.cardShadow,
        opacity: out ? 0.55 : pressed ? 0.75 : 1,
        transform: [{ scale: pressed ? 0.97 : 1 }],
      })}>
      <View>
        <ProductPhoto system={system} imageFile={first.imageFile} size={width - spacing.sm * 2} />
        {inCart > 0 ? (
          <View style={{ position: 'absolute', top: spacing.xs, end: spacing.xs }}>
            <Badge label={`في السلة ${inCart}`} tone="accent" />
          </View>
        ) : null}
      </View>
      <Text variant="bodyStrong" numberOfLines={2}>
        {name}
      </Text>
      {first.brand ? (
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {first.brand}
        </Text>
      ) : null}
      <Text variant="headline" tone="accent" numberOfLines={1}>
        {price}
      </Text>
      <Text variant="caption" tone={out ? 'warning' : 'secondary'} numberOfLines={1}>
        {stockText}
      </Text>
    </Pressable>
  );
}
