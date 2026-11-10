import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, Card, EmptyState, KEYBOARD_GAP, NumberField, Stepper, Text } from '@/components';
import type { Ctx } from '@/domain/context';
import { displayName, getProduct } from '@/domain/products';
import { parseThousandths } from '@/lib/digits';
import { editableDinars, formatLyd } from '@/lib/money';
import { useCart } from '@/state/cart';
import { spacing, useTheme } from '@/theme';

import { addPiece } from './actions';
import { checkAddForm, freeStock } from './model';

/** Long-press on a product: choose how many and the price (a negotiated price) before adding. */
export function AddSheet({
  ctx,
  productId,
  onDone,
}: {
  ctx: Ctx;
  productId: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const { cart } = useCart(ctx.system);
  const [product] = useState(() => getProduct(ctx, productId));
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(() => (product ? editableDinars(product.price) : ''));

  if (!product) return <EmptyState icon="shippingbox" title="القطعة غير موجودة في المخزون" />;
  const free = freeStock(product.stock, cart, product.id);
  const unit = parseThousandths(price);

  const add = () => {
    const check = checkAddForm(String(quantity), price, free);
    if (!check.ok) {
      Alert.alert('لم تتم الإضافة', check.message);
      return;
    }
    if (addPiece(ctx, product, check.quantity, check.unitPrice)) onDone();
  };

  return (
    <>
      <Stack.Title>إضافة للسلة</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={onDone}>إلغاء</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="headline">{displayName(ctx, product)}</Text>
          <Text variant="subhead" tone={free > 0 ? 'secondary' : 'warning'}>
            {free > 0
              ? `${product.sku} • متوفر للإضافة: ${free}`
              : `${product.sku} • لا يوجد مخزون متاح لهذه القطعة`}
          </Text>
          <Text variant="subhead" tone="secondary">
            الكمية
          </Text>
          <Stepper
            value={quantity}
            onChange={setQuantity}
            max={Math.max(1, free)}
            testID="add-quantity"
          />
          <NumberField
            label="سعر القطعة"
            hint={`السعر المسجل ${formatLyd(product.price)}`}
            value={price}
            onChangeText={setPrice}
            suffix="د.ل"
            testID="add-price"
          />
          {unit !== null ? (
            <Text variant="bodyStrong" tone="accent" testID="add-total">
              {`المجموع: ${formatLyd(unit * quantity)}`}
            </Text>
          ) : null}
          <Button
            title="إضافة للسلة"
            icon="cart.badge.plus"
            fullWidth
            disabled={free === 0}
            onPress={add}
            testID="add-confirm"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
