import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Badge, Card, EmptyState, Text } from '@/components';
import type { Ctx } from '@/domain/context';
import type { Product } from '@/domain/products';
import { ProductPhoto } from '@/features/products/product-photo';
import { findDesign } from '@/features/scarves/actions';
import { formatLyd } from '@/lib/money';
import { useCart } from '@/state/cart';
import { spacing, useTheme } from '@/theme';

import { addPiece } from './actions';
import { freeStock } from './model';

/**
 * A scarf design's sizes with their price and free stock. Tap a size to add one; long-press it
 * to choose quantity and price.
 */
export function SizePicker({
  ctx,
  designId,
  onDone,
  onChoose,
}: {
  ctx: Ctx;
  designId: string;
  onDone: () => void;
  /** Long-press: the quantity and price sheet for this size. */
  onChoose: (p: Product) => void;
}) {
  const { colors } = useTheme();
  const { cart } = useCart(ctx.system);
  const [design] = useState(() => findDesign(ctx, designId));
  if (!design) return <EmptyState icon="wind" title="التصميم غير موجود" />;
  const first = design.sizes[0];

  return (
    <>
      <Stack.Title>اختر المقاس</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={onDone}>إغلاق</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic">
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.ms }}>
          <ProductPhoto system={ctx.system} imageFile={first.imageFile} size={64} />
          <View style={{ flex: 1 }}>
            <Text variant="headline">{design.name}</Text>
            <Text variant="subhead" tone="secondary">
              {[first.brand, first.category, first.color].filter(Boolean).join(' • ')}
            </Text>
          </View>
        </View>
        <Card padded={false} style={{ gap: 0 }}>
          {design.sizes.map((p, i) => {
            const free = freeStock(p.stock, cart, p.id);
            const held = cart
              .filter((l) => l.productId === p.id)
              .reduce((sum, l) => sum + l.quantity, 0);
            const size = p.size ?? 'بدون مقاس';
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  if (addPiece(ctx, p)) onDone();
                }}
                onLongPress={() => onChoose(p)}
                delayLongPress={350}
                accessibilityRole="button"
                accessibilityLabel={`${size}، ${formatLyd(p.price)}، ${free > 0 ? `متوفر ${free}` : 'نفد المخزون'}`}
                testID={`size-${size}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.ms,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.ms,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.separator,
                  opacity: free === 0 ? 0.5 : pressed ? 0.6 : 1,
                })}>
                <View style={{ flex: 1, gap: spacing.xxs }}>
                  <Text variant="headline">{size}</Text>
                  <Text variant="caption" tone={free > 0 ? 'secondary' : 'warning'}>
                    {free > 0 ? `متوفر ${free} • ${p.sku}` : `نفد المخزون • ${p.sku}`}
                  </Text>
                </View>
                {held > 0 ? <Badge label={`في السلة ${held}`} /> : null}
                <Text variant="headline" tone="accent">
                  {formatLyd(p.price)}
                </Text>
              </Pressable>
            );
          })}
        </Card>
        <Text variant="caption" tone="secondary" center>
          اضغط مطولاً على المقاس لاختيار الكمية والسعر.
        </Text>
      </ScrollView>
    </>
  );
}
