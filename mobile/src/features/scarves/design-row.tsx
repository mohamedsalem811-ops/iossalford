import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useRef } from 'react';
import { ActionSheetIOS, Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon, Text } from '@/components';
import type { ScarfDesign } from '@/domain/products';
import { BrandBadge } from '@/features/products/brand-badge';
import { ProductPhoto } from '@/features/products/product-photo';
import { stockState } from '@/features/products/model';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

import { designDetails, priceRange } from './model';

/** One scarf design: photo, brand, name, material • colour, stock per size, price range. */
export function DesignRow({
  system,
  design: d,
  href,
  brandImage,
  onDelete,
  onAdjust,
  onOpen,
  selected = false,
  card,
}: {
  system: SystemId;
  design: ScarfDesign;
  href: Href;
  brandImage: string | null;
  onDelete: (d: ScarfDesign) => void;
  /** Opens the stock sheet for one size. */
  onAdjust: (productId: number) => void;
  /** iPad split view: tapping selects the design instead of navigating. */
  onOpen?: () => void;
  selected?: boolean;
  /** iPad grid: drawn as a photo card this wide instead of a swipeable row. */
  card?: number;
}) {
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const first = d.sizes[0];
  const photo = d.sizes.find((s) => s.imageFile)?.imageFile ?? null;
  const details = designDetails(d);
  // Tap edits (on iPad it opens beside the list); a long press shows every action as a menu.
  const open = onOpen ?? (() => router.push(href));
  const menu = () => {
    const items = [
      ...(onOpen ? [] : [{ title: 'تعديل التصميم والمقاسات', run: open }]),
      ...d.sizes.map((s) => ({
        title: `تعديل مخزون ${s.size ?? '—'} (${s.stock})`,
        run: () => onAdjust(s.id),
      })),
      { title: 'حذف التصميم', run: () => onDelete(d) },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: d.name,
        options: [...items.map((i) => i.title), 'إلغاء'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: items.length - 1,
      },
      (index) => items[index]?.run(),
    );
  };

  const sizeChips = (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4 }}>
      {d.sizes.map((s) => {
        const state = stockState(s);
        return (
          <View
            key={s.id}
            style={{
              paddingHorizontal: 6,
              paddingVertical: 1,
              borderRadius: radius.full,
              backgroundColor: colors.accentSoft,
            }}>
            <Text
              variant="caption"
              style={{ color: state === 'ok' ? colors.accent : colors.warning }}>
              {`${s.size ?? '—'}: ${s.stock}`}
            </Text>
          </View>
        );
      })}
    </View>
  );

  if (card) {
    return (
      <Pressable
        testID={`design-${first.name}`}
        accessibilityRole="button"
        accessibilityHint="اضغط لتعديل التصميم ومقاساته"
        onPress={open}
        onLongPress={menu}
        style={({ pressed }) => ({
          width: card,
          padding: spacing.sm,
          gap: spacing.xs,
          borderRadius: radius.lg,
          borderCurve: 'continuous',
          backgroundColor: pressed ? colors.accentSoft : colors.surface,
        })}>
        <ProductPhoto system={system} imageFile={photo} size={card - spacing.sm * 2} />
        {first.brand && first.brandId !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <BrandBadge name={first.brand} imageFile={brandImage} system={system} size={16} />
            <Text variant="caption" tone="accent" numberOfLines={1}>
              {first.brand}
            </Text>
          </View>
        ) : null}
        <Text variant="bodyStrong" numberOfLines={1}>
          {first.name}
        </Text>
        {details ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {details}
          </Text>
        ) : null}
        {sizeChips}
        <Text variant="headline" tone="accent" numberOfLines={1}>
          {priceRange(d)}
        </Text>
      </Pressable>
    );
  }

  const body = (
    <Pressable
      testID={`design-${first.name}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint="اضغط لتعديل التصميم ومقاساته"
      onPress={open}
      onLongPress={menu}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.ms,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed || selected ? colors.accentSoft : colors.surface,
      })}>
      <ProductPhoto system={system} imageFile={photo} size={64} />
      <View style={{ flex: 1, gap: 3 }}>
        {first.brand && first.brandId !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
            <BrandBadge name={first.brand} imageFile={brandImage} system={system} size={16} />
            <Text variant="caption" tone="accent" numberOfLines={1}>
              {first.brand}
            </Text>
          </View>
        ) : null}
        <Text variant="bodyStrong" numberOfLines={2}>
          {first.name}
        </Text>
        {details ? (
          <Text variant="caption" tone="secondary" numberOfLines={1}>
            {details}
          </Text>
        ) : null}
        {sizeChips}
        <Text variant="subhead" tone="accent">
          {priceRange(d)}
        </Text>
      </View>
      <View style={{ alignItems: 'center', minWidth: 48 }}>
        <Text variant="headline" center tone={d.totalStock > 0 ? 'primary' : 'warning'}>
          {d.totalStock}
        </Text>
        <Text variant="caption" tone="secondary" center>
          {d.totalStock > 0 ? 'قطعة' : 'نفد'}
        </Text>
      </View>
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      overshootLeft={false}
      // The row covers its swipe button until it is swiped.
      containerStyle={{ backgroundColor: colors.surface, overflow: 'hidden' }}
      childrenContainerStyle={{ backgroundColor: colors.surface }}
      renderLeftActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="حذف التصميم"
          onPress={() => {
            swipe.current?.close();
            onDelete(d);
          }}
          style={{
            width: 76,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            backgroundColor: colors.warning,
          }}>
          <Icon name="trash" size={18} color={colors.onAccent} />
          <Text variant="caption" style={{ color: colors.onAccent }}>
            حذف
          </Text>
        </Pressable>
      )}>
      {body}
    </ReanimatedSwipeable>
  );
}
