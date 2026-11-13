import { useReducer } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';

import { Appear, Button, Card, EmptyState, Icon, Stepper, Text } from '@/components';
import { lineTotal, removeLine, setQuantity, setUnitPrice, type CartLine } from '@/domain/cart';
import type { Ctx } from '@/domain/context';
import { getProduct } from '@/domain/products';
import { getRate } from '@/domain/settings';
import { parseThousandths } from '@/lib/digits';
import { editableDinars, formatLyd, formatRate, formatUsd } from '@/lib/money';
import { useCart } from '@/state/cart';
import { useOnDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { showCartProblem } from './actions';
import { belowCostNote, cartGroups, cartTotals, stockWarnings } from './model';
import { haptic } from '@/lib/haptics';
import { useCan } from '@/staff/use-can';

/**
 * The open cart: lines with quantity, price and remove; each set as one group removed as a
 * whole; a warning on any line the stock no longer covers; totals in LYD and USD.
 */
export function CartView({
  ctx,
  onCheckout,
  embedded = false,
}: {
  ctx: Ctx;
  onCheckout: () => void;
  /** Beside the products on iPad (has its own title), rather than in the cart sheet. */
  embedded?: boolean;
}) {
  const { colors } = useTheme();
  // The below-cost note tells the cost: only for someone who may see it.
  const seesCost = useCan('costs.view');
  const { cart, setCart } = useCart(ctx.system);
  // Stock or prices changed elsewhere (a delivery, an edit): check the lines again.
  const [, recheck] = useReducer((n: number) => n + 1, 0);
  useOnDataChanged(recheck);
  const rate = getRate(ctx);
  const totals = cartTotals(cart, rate);
  const warnings = stockWarnings(cart, (id) => getProduct(ctx, id));

  const changeQuantity = (line: CartLine, quantity: number) => {
    const stock = getProduct(ctx, line.productId)?.stock ?? 0;
    const r = setQuantity(cart, line.key, quantity, stock);
    if ('problem' in r) showCartProblem(r.problem);
    else setCart(r.cart);
  };

  const editPrice = (line: CartLine) =>
    Alert.prompt(
      'سعر القطعة',
      `«${line.name}»: السعر الذي يدفعه الزبون للقطعة الواحدة.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حفظ',
          onPress: (text?: string) => {
            const price = parseThousandths(text ?? '');
            if (price === null) {
              Alert.alert('لم يتغير السعر', 'اكتب سعر القطعة بالدينار.');
              return;
            }
            setCart(setUnitPrice(cart, line.key, price));
          },
        },
      ],
      'plain-text',
      editableDinars(line.unitPrice),
      'decimal-pad',
    );

  const remove = (key: string) => {
    haptic.light();
    setCart(removeLine(cart, key));
  };

  const clearAll = () =>
    Alert.alert('إفراغ السلة؟', 'تُزال كل القطع من السلة. لا يتغير المخزون.', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'إفراغ', style: 'destructive', onPress: () => setCart([]) },
    ]);

  const removeButton = (key: string, name: string) => (
    <Pressable
      onPress={() => remove(key)}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`إزالة ${name} من السلة`}
      testID={`cart-remove-${name}`}
      style={({ pressed }) => ({ padding: spacing.xs, opacity: pressed ? 0.5 : 1 })}>
      <Icon name="trash" size={18} color={colors.warning} />
    </Pressable>
  );

  // Single pieces only: a set's discount lowering a piece's share is intended.
  const costNote = (line: CartLine) => {
    if (!seesCost) return null;
    const note = belowCostNote(line.unitPrice, getProduct(ctx, line.productId)?.cost ?? 0);
    return note ? (
      <Text variant="caption" tone="warning" testID="cart-below-cost">
        {note}
      </Text>
    ) : null;
  };

  const warning = (productId: number) =>
    warnings.get(productId) ? (
      <Text variant="caption" tone="warning" testID="cart-warning">
        {warnings.get(productId)}
      </Text>
    ) : null;

  if (cart.length === 0) {
    return (
      <View style={{ flex: 1, backgroundColor: embedded ? colors.surface : colors.background }}>
        {embedded ? <CartTitle pieces={0} /> : null}
        <EmptyState
          icon="cart"
          title="السلة فارغة"
          message="اضغط على قطعة لإضافتها، أو اضغط مطولاً لاختيار الكمية والسعر."
        />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: embedded ? colors.surface : colors.background }}>
      {embedded ? <CartTitle pieces={totals.pieces} /> : null}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.ms }}
        contentInsetAdjustmentBehavior={embedded ? 'never' : 'automatic'}>
        {cartGroups(cart).map((g) =>
          g.kind === 'line' ? (
            <Appear key={g.key}>
              <Card testID={`cart-line-${g.line.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
                  <View style={{ flex: 1, gap: spacing.xxs }}>
                    <Text variant="bodyStrong">{g.line.name}</Text>
                    <Pressable
                      onPress={() => editPrice(g.line)}
                      accessibilityRole="button"
                      accessibilityLabel={`سعر القطعة ${formatLyd(g.line.unitPrice)}، اضغط للتعديل`}
                      testID={`cart-price-${g.line.name}`}>
                      <Text variant="subhead" tone="accent">
                        {`${formatLyd(g.line.unitPrice)} للقطعة ✎`}
                      </Text>
                    </Pressable>
                  </View>
                  {removeButton(g.line.key, g.line.name)}
                </View>
                {warning(g.line.productId)}
                {costNote(g.line)}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}>
                  <Stepper
                    value={g.line.quantity}
                    onChange={(q) => changeQuantity(g.line, q)}
                    testID={`cart-qty-${g.line.name}`}
                  />
                  <Text variant="headline">{formatLyd(lineTotal(g.line))}</Text>
                </View>
              </Card>
            </Appear>
          ) : (
            <Appear key={g.key}>
              <Card testID={`cart-set-${g.name}`}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                  <Icon name="square.stack.3d.up" size={18} color={colors.accent} />
                  <Text variant="bodyStrong" style={{ flex: 1 }}>
                    {`طقم «${g.name}»`}
                  </Text>
                  {removeButton(g.lines[0].key, g.name)}
                </View>
                {g.lines.map((l) => (
                  <View key={l.key} style={{ gap: spacing.xxs }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text variant="subhead" style={{ flex: 1 }}>
                        {`${l.name} × ${l.quantity}`}
                      </Text>
                      <Text variant="subhead" tone="secondary">
                        {formatLyd(lineTotal(l))}
                      </Text>
                    </View>
                    {warning(l.productId)}
                  </View>
                ))}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <Text variant="caption" tone="secondary">
                    يُباع الطقم كاملاً، والخصم موزع على قطعه.
                  </Text>
                  <Text variant="headline">{formatLyd(g.total)}</Text>
                </View>
              </Card>
            </Appear>
          ),
        )}
      </ScrollView>
      <View
        style={{
          padding: spacing.md,
          gap: spacing.sm,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="headline">{`المجموع • ${totals.pieces} قطعة`}</Text>
          <Text variant="title" tone="accent" testID="cart-total">
            {formatLyd(totals.total)}
          </Text>
        </View>
        <Text variant="caption" tone="secondary" testID="cart-total-usd">
          {`${formatUsd(totals.usd)} بسعر الصرف ${formatRate(rate)}`}
        </Text>
        <Button
          title="إتمام البيع"
          icon="checkmark.circle.fill"
          fullWidth
          disabled={warnings.size > 0}
          onPress={onCheckout}
          testID="cart-checkout"
        />
        {warnings.size > 0 ? (
          <Text variant="caption" tone="warning" center>
            عدّل الكميات أو أزل القطع المنبّه عليها قبل إتمام البيع.
          </Text>
        ) : null}
        <Button title="إفراغ السلة" variant="ghost" size="sm" onPress={clearAll} />
      </View>
    </View>
  );
}

function CartTitle({ pieces }: { pieces: number }) {
  return (
    <View style={{ paddingHorizontal: spacing.md, paddingTop: spacing.md }}>
      <Text variant="title">{pieces > 0 ? `السلة (${pieces})` : 'السلة'}</Text>
    </View>
  );
}
