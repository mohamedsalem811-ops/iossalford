import type { Href } from 'expo-router';
import { router } from 'expo-router';
import { useRef } from 'react';
import { ActionSheetIOS, Pressable, View } from 'react-native';
import ReanimatedSwipeable, {
  type SwipeableMethods,
} from 'react-native-gesture-handler/ReanimatedSwipeable';

import { Icon, Text } from '@/components';
import type { Product } from '@/domain/products';
import { formatDinars, formatLyd } from '@/lib/money';
import { useCan } from '@/staff/use-can';
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
  card,
}: {
  system: SystemId;
  product: Product;
  editHref: Href;
  brandImage: string | null;
  actions: ProductActions;
  /** iPad grid: drawn as a photo card this wide instead of a swipeable row. */
  card?: number;
}) {
  const { colors } = useTheme();
  // An employee sees each piece's price and stock only: no cost, no editing, no stock changes.
  const mayEdit = useCan('products.edit');
  const mayStock = useCan('stock.adjust');
  const seesCost = useCan('costs.view');
  const swipe = useRef<SwipeableMethods>(null);
  const run = (fn: () => void) => {
    swipe.current?.close();
    fn();
  };
  // Tap edits (on iPad it opens beside the list); a long press shows every action as a menu.
  // A plain press is used rather than a native link preview: inside a swipeable list row the
  // preview view lost the row's layout on device.
  const showPhoto = p.imageFile ? () => actions.onPhoto(p) : undefined;
  const open = mayEdit ? () => router.push(editHref) : showPhoto;
  const menu = () => {
    const items: { title: string; run: () => void; destructive?: boolean }[] = [
      ...(mayEdit ? [{ title: 'تعديل', run: () => router.push(editHref) }] : []),
      ...(showPhoto ? [{ title: 'عرض الصورة', run: showPhoto }] : []),
      ...(mayStock
        ? [
            { title: '+1 مخزون', run: () => actions.onStep(p, 1) },
            ...(p.stock > 0 ? [{ title: '−1 مخزون', run: () => actions.onStep(p, -1) }] : []),
            { title: 'تعديل المخزون مع السبب', run: () => actions.onAdjust(p) },
          ]
        : []),
      ...(mayEdit
        ? [{ title: 'حذف القطعة', run: () => actions.onDelete(p), destructive: true }]
        : []),
    ];
    if (items.length === 0) return;
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

  if (card) {
    return (
      <Pressable
        testID={`product-${p.sku}`}
        accessibilityRole="button"
        accessibilityHint={mayEdit ? 'اضغط للتعديل، أو اضغط مطولاً لمزيد من الخيارات' : undefined}
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
        <ProductPhoto system={system} imageFile={p.imageFile} size={card - spacing.sm * 2} />
        {p.brand && p.brandId !== null ? (
          <BrandTag system={system} name={p.brand} imageFile={brandImage} />
        ) : null}
        <Text variant="bodyStrong" numberOfLines={1}>
          {p.name}
        </Text>
        <Text variant="caption" tone="secondary" numberOfLines={1}>
          {productDetails(p)}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Text variant="headline" tone="accent" numberOfLines={1}>
              {formatLyd(p.price)}
            </Text>
            {seesCost ? (
              <Text variant="caption" tone="secondary" numberOfLines={1}>
                تكلفة {formatDinars(p.cost)}
              </Text>
            ) : null}
          </View>
          <StockPill stock={p.stock} lowStock={p.lowStock} />
        </View>
      </Pressable>
    );
  }

  const body = (
    <Pressable
      testID={`product-${p.sku}`}
      accessibilityRole="button"
      accessibilityHint={mayEdit ? 'اضغط للتعديل، أو اضغط مطولاً لمزيد من الخيارات' : undefined}
      onPress={open}
      onLongPress={menu}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.ms,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={p.imageFile ? 'عرض صورة القطعة' : 'إضافة صورة'}
        // Adding a photo edits the piece: an employee can only look at one.
        disabled={!mayEdit && !p.imageFile}
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
          {seesCost ? (
            <Text variant="caption" tone="secondary">
              تكلفة {formatDinars(p.cost)}
            </Text>
          ) : null}
        </View>
      </View>
      <StockPill stock={p.stock} lowStock={p.lowStock} />
    </Pressable>
  );

  // Nothing to swipe for someone who may not change pieces or stock.
  if (!mayEdit && !mayStock) return body;

  return (
    <ReanimatedSwipeable
      ref={swipe}
      friction={2}
      overshootRight={false}
      overshootLeft={false}
      // The row covers its swipe buttons until it is swiped.
      containerStyle={{ backgroundColor: colors.surface, overflow: 'hidden' }}
      childrenContainerStyle={{ backgroundColor: colors.surface }}
      renderRightActions={() =>
        mayStock ? (
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
        ) : null
      }
      renderLeftActions={() =>
        mayEdit ? (
          <View style={{ flexDirection: 'row' }}>
            <SwipeAction
              label="تعديل"
              icon="pencil"
              color={colors.accent}
              onPress={() => run(() => router.push(editHref))}
            />
            <SwipeAction
              label="حذف"
              icon="trash"
              color={colors.warning}
              onPress={() => run(() => actions.onDelete(p))}
            />
          </View>
        ) : null
      }>
      {body}
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
