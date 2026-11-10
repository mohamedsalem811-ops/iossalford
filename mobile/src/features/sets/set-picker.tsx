import { Stack } from 'expo-router';
import { Pressable, ScrollView, View } from 'react-native';

import { Card, EmptyState, Icon, Text } from '@/components';
import type { Ctx } from '@/domain/context';
import { displayName, getProduct } from '@/domain/products';
import type { ProductSet } from '@/domain/sets';
import { addWholeSet } from '@/features/sale/actions';
import { formatLyd } from '@/lib/money';
import { useCart } from '@/state/cart';
import { spacing, useTheme } from '@/theme';

import { availableText, setPreview, setsAvailable } from './model';

/** The sets the shop sells, with their price and how many the stock still covers. */
export function SetList({
  ctx,
  sets,
  onPress,
  emptyAction,
  onEmptyAction,
}: {
  ctx: Ctx;
  sets: ProductSet[];
  onPress: (set: ProductSet) => void;
  emptyAction?: string;
  onEmptyAction?: () => void;
}) {
  const { colors } = useTheme();
  const { cart } = useCart(ctx.system);
  const find = (id: number) => getProduct(ctx, id);

  if (sets.length === 0) {
    return (
      <EmptyState
        icon="square.stack.3d.up"
        title="لا توجد أطقم بعد"
        message="الطقم مجموعة قطع تُباع معاً بخصم، مثل طقم العروس."
        action={emptyAction}
        onAction={onEmptyAction}
      />
    );
  }
  return (
    <Card padded={false} style={{ gap: 0, overflow: 'hidden' }}>
      {sets.map((set, i) => {
        const preview = setPreview(set.items, set.discount, find);
        const available = setsAvailable(set.items, find, cart);
        const pieces = set.items
          .map((it) => {
            const p = find(it.productId);
            return `${p ? displayName(ctx, p) : 'قطعة محذوفة'} × ${it.quantity}`;
          })
          .join('، ');
        return (
          <Pressable
            key={set.id}
            onPress={() => onPress(set)}
            accessibilityRole="button"
            accessibilityLabel={`طقم ${set.name}، ${formatLyd(preview.price)}، ${availableText(available)}`}
            testID={`set-${set.name}`}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              gap: spacing.ms,
              padding: spacing.md,
              borderTopWidth: i === 0 ? 0 : 1,
              borderTopColor: colors.separator,
              opacity: pressed ? 0.6 : 1,
            })}>
            <Icon name="square.stack.3d.up.fill" size={22} color={colors.accent} />
            <View style={{ flex: 1, gap: spacing.xxs }}>
              <Text variant="headline">{set.name}</Text>
              <Text variant="caption" tone="secondary" numberOfLines={2}>
                {pieces}
              </Text>
              <Text variant="caption" tone={available > 0 ? 'secondary' : 'warning'}>
                {availableText(available)}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text variant="headline" tone="accent">
                {formatLyd(preview.price)}
              </Text>
              {preview.discount > 0 ? (
                <Text
                  variant="caption"
                  tone="secondary"
                  style={{ textDecorationLine: 'line-through' }}>
                  {formatLyd(preview.list)}
                </Text>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </Card>
  );
}

/** Sale → sets button: tap a set to add it whole to the cart. */
export function SetPicker({
  ctx,
  sets,
  onDone,
  onNew,
}: {
  ctx: Ctx;
  sets: ProductSet[];
  onDone: () => void;
  onNew: () => void;
}) {
  const { colors } = useTheme();
  return (
    <>
      <Stack.Title>إضافة طقم</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={onDone}>إغلاق</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="طقم جديد" onPress={onNew} />
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic">
        <SetList
          ctx={ctx}
          sets={sets}
          onPress={(set) => {
            if (addWholeSet(ctx, set.id)) onDone();
          }}
          emptyAction="طقم جديد"
          onEmptyAction={onNew}
        />
        {sets.length > 0 ? (
          <Text variant="caption" tone="secondary" center>
            يُضاف الطقم كاملاً بسعره، ويُوزَّع الخصم على قطعه في الإيصال.
          </Text>
        ) : null}
      </ScrollView>
    </>
  );
}
