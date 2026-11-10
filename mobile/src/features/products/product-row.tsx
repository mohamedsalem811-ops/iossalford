import type { Href } from 'expo-router';
import { Link, router } from 'expo-router';
import { useRef } from 'react';
import { ActionSheetIOS, Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon, Text } from '@/components';
import type { Product } from '@/domain/products';
import { formatDinars, formatLyd } from '@/lib/money';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

import { BrandBadge } from './brand-badge';
import { productDetails, stockState } from './model';
import { ProductPhoto } from './product-photo';

export type ProductActions = {
  onPhoto: (p: Product) => void;
  onStep: (p: Product, delta: 1 | -1) => void;
  /** Opens the stock sheet: any amount, with a reason. */
  onAdjust: (p: Product) => void;
  onDelete: (p: Product) => void;
};

/**
 * One product in the list. Tap to edit. Swipe from the right for +1 / −1 stock or the stock sheet,
 * from the left for edit and delete. A long press shows the same actions as a menu.
 */
export function ProductRow({
  system,
  product: p,
  editHref,
  brandImage,
  actions,
  onOpen,
  selected = false,
}: {
  system: SystemId;
  product: Product;
  editHref: Href;
  brandImage: string | null;
  actions: ProductActions;
  /**
   * iPad split view: tapping selects the piece (its form opens beside the list) instead of
   * navigating, and a long press shows the actions as an action sheet.
   */
  onOpen?: () => void;
  /** Highlighted as the piece open beside the list. */
  selected?: boolean;
}) {
  const { colors } = useTheme();
  const swipe = useRef<SwipeableMethods>(null);
  const run = (fn: () => void) => {
    swipe.current?.close();
    fn();
  };
  const menu = () => {
    const items: { title: string; run: () => void; destructive?: boolean }[] = [
      ...(p.imageFile ? [{ title: 'عرض الصورة', run: () => actions.onPhoto(p) }] : []),
      { title: '+1 مخزون', run: () => actions.onStep(p, 1) },
      ...(p.stock > 0 ? [{ title: '−1 مخزون', run: () => actions.onStep(p, -1) }] : []),
      { title: 'تعديل المخزون مع السبب', run: () => actions.onAdjust(p) },
      { title: 'حذف القطعة', run: () => actions.onDelete(p), destructive: true },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: p.name,
        options: [...items.map((i) => i.title), 'إلغاء'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: items.findIndex((i) => i.destructive),
      },
      (index) => items[index]?.run(),
    );
  };

  const body = (
    <Pressable
      testID={`product-${p.sku}`}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityHint="اضغط للتعديل، أو اضغط مطولاً لمزيد من الخيارات"
      onPress={onOpen}
      onLongPress={onOpen ? menu : undefined}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.ms,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed || selected ? colors.accentSoft : colors.surface,
      })}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={p.imageFile ? 'عرض صورة القطعة' : 'إضافة صورة'}
        onPress={() => actions.onPhoto(p)}
        hitSlop={4}>
        <ProductPhoto system={system} imageFile={p.imageFile} size={60} />
      </Pressable>
      <View style={{ flex: 1, gap: 2 }}>
        {p.brand && p.brandId !== null ? (
          <BrandTag system={system} name={p.brand} imageFile={brandImage} />
        ) : null}
        <Text variant="bodyStrong" numberOfLines={2}>
          {p.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {productDetails(p)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm }}>
          <Text variant="headline" tone="accent">
            {formatLyd(p.price)}
          </Text>
          <Text variant="caption" tone="secondary">
            تكلفة {formatDinars(p.cost)}
          </Text>
        </View>
      </View>
      <StockPill stock={p.stock} lowStock={p.lowStock} />
    </Pressable>
  );

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      renderRightActions={() => (
        <View style={{ flexDirection: 'row' }}>
          <SwipeAction
            label="+1"
            icon="plus"
            color={colors.accent}
            onPress={() => run(() => actions.onStep(p, 1))}
          />
          <SwipeAction
            label="−1"
            icon="minus"
            color={colors.warning}
            disabled={p.stock <= 0}
            onPress={() => run(() => actions.onStep(p, -1))}
          />
          <SwipeAction
            label="مخزون"
            icon="shippingbox"
            color={colors.textSecondary}
            onPress={() => run(() => actions.onAdjust(p))}
          />
        </View>
      )}
      renderLeftActions={() => (
        <View style={{ flexDirection: 'row' }}>
          <SwipeAction
            label="تعديل"
            icon="pencil"
            color={colors.accent}
            onPress={() => run(onOpen ?? (() => router.push(editHref)))}
          />
          <SwipeAction
            label="حذف"
            icon="trash"
            color={colors.warning}
            onPress={() => run(() => actions.onDelete(p))}
          />
        </View>
      )}>
      {onOpen ? (
        body
      ) : (
        <Link href={editHref} asChild>
          <Link.Trigger>{body}</Link.Trigger>
          <Link.Menu>
            <Link.MenuAction title="تعديل" icon="pencil" onPress={() => router.push(editHref)} />
            {p.imageFile ? (
              <Link.MenuAction title="عرض الصورة" icon="photo" onPress={() => actions.onPhoto(p)} />
            ) : null}
            <Link.MenuAction title="+1 مخزون" icon="plus" onPress={() => actions.onStep(p, 1)} />
            <Link.MenuAction
              title="−1 مخزون"
              icon="minus"
              disabled={p.stock <= 0}
              onPress={() => actions.onStep(p, -1)}
            />
            <Link.MenuAction
              title="تعديل المخزون مع السبب"
              icon="shippingbox"
              onPress={() => actions.onAdjust(p)}
            />
            <Link.MenuAction
              title="حذف القطعة"
              icon="trash"
              destructive
              onPress={() => actions.onDelete(p)}
            />
          </Link.Menu>
        </Link>
      )}
    </ReanimatedSwipeable>
  );
}

function BrandTag({
  system,
  name,
  imageFile,
}: {
  system: SystemId;
  name: string;
  imageFile: string | null;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingStart: 2,
        paddingEnd: spacing.sm,
        paddingVertical: 2,
        borderRadius: radius.full,
        backgroundColor: colors.accentSoft,
      }}>
      <BrandBadge name={name} imageFile={imageFile} system={system} size={16} />
      <Text variant="caption" tone="accent" numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

function StockPill({ stock, lowStock }: { stock: number; lowStock: number }) {
  const { colors } = useTheme();
  const state = stockState({ stock, lowStock });
  const tint = state === 'ok' ? colors.accent : colors.warning;
  return (
    <View
      accessibilityLabel={state === 'out' ? 'نفد من المخزون' : `${stock} قطعة في المخزون`}
      style={{
        minWidth: 48,
        minHeight: 44,
        paddingHorizontal: spacing.xs,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius.sm,
        borderCurve: 'continuous',
        backgroundColor: colors.accentSoft,
      }}>
      <Text variant="headline" center style={{ color: tint }}>
        {stock}
      </Text>
      <Text variant="caption" center style={{ color: tint }}>
        {state === 'out' ? 'نفد' : state === 'low' ? 'منخفض' : 'قطعة'}
      </Text>
    </View>
  );
}

function SwipeAction({
  label,
  icon,
  color,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: 'plus' | 'minus' | 'pencil' | 'trash' | 'shippingbox';
  color: string;
  onPress?: () => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={{
        width: 76,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        backgroundColor: color,
        opacity: disabled ? 0.4 : 1,
      }}>
      <Icon name={icon} size={18} color={colors.onAccent} />
      <Text variant="caption" style={{ color: colors.onAccent }}>
        {label}
      </Text>
    </Pressable>
  );
}
