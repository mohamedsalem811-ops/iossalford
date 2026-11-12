import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  EmptyState,
  FilterChip,
  FormHeader,
  Icon,
  KEYBOARD_GAP,
  NumberField,
  Stepper,
  Text,
  TextField,
  useSheetBottomSpace,
} from '@/components';
import type { Ctx } from '@/domain/context';
import { displayName, listProducts, type Product } from '@/domain/products';
import { addReturn, addReturnWithoutSale, getSaleLine, maxRefund } from '@/domain/sales';
import { showError } from '@/features/products/actions';
import { applyQuery, DEFAULT_QUERY } from '@/features/products/model';
import { editableDinars, formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { checkReturn, returnable, RETURN_REASONS } from './model';
import { haptic } from '@/lib/haptics';
import { useSaveOnce } from '@/hooks/use-save-once';

const PICK_LIMIT = 20;

/**
 * A return. From a sale line: up to the pieces not yet returned, refunding what the customer paid
 * (or less). Without a sale (sold before the app): pick the piece and type the amount given back.
 * The pieces go back into stock.
 */
export function ReturnForm({
  ctx,
  saleLineId,
  onDone,
}: {
  ctx: Ctx;
  saleLineId?: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const saveOnce = () => once(save);
  const bottomSpace = useSheetBottomSpace();
  const [line] = useState(() => (saleLineId ? getSaleLine(ctx, saleLineId) : undefined));
  const [products] = useState(() => (saleLineId ? [] : listProducts(ctx)));
  const [product, setProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [refund, setRefund] = useState('');
  const [reason, setReason] = useState('');

  if (saleLineId && !line) return <EmptyState icon="cart" title="البيعة غير موجودة" />;
  const left = line ? returnable(line) : Number.MAX_SAFE_INTEGER;
  if (line && left === 0)
    return <EmptyState icon="arrow.uturn.backward" title="كل قطع هذه البيعة مُرتجعة بالفعل" />;

  const save = () => {
    if (!line && !product) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'اختر القطعة المرتجعة');
      return;
    }
    const check = checkReturn(line ?? null, quantity, refund);
    if (!check.ok) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', check.message);
      return;
    }
    try {
      if (line) addReturn(ctx, { saleLineId: line.id, quantity, refund: check.refund, reason });
      else
        addReturnWithoutSale(ctx, {
          productId: product!.id,
          quantity,
          refund: check.refund!,
          reason,
        });
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    onDone();
    return true;
  };

  const matches = line
    ? []
    : applyQuery(products, { ...DEFAULT_QUERY, search }).slice(0, PICK_LIMIT);

  return (
    <>
      <FormHeader title="مرتجع" onCancel={onDone} onSave={saveOnce} />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        {line ? (
          <Card>
            <Text variant="headline">{line.name}</Text>
            <Text variant="subhead" tone="secondary">
              {`بيعة رقم ${line.saleId} • بيعت ${line.quantity} • أُرجع ${line.returned} • دفع الزبون ${formatLyd(line.lineTotal)}`}
            </Text>
          </Card>
        ) : product ? (
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text variant="headline">{displayName(ctx, product)}</Text>
                <Text variant="subhead" tone="secondary">
                  {`${product.sku} • ${formatLyd(product.price)} • مرتجع بدون فاتورة`}
                </Text>
              </View>
              <Pressable
                onPress={() => setProduct(null)}
                accessibilityRole="button"
                accessibilityLabel="اختيار قطعة أخرى">
                <Text variant="subhead" tone="accent">
                  تغيير
                </Text>
              </Pressable>
            </View>
          </Card>
        ) : (
          <Card padded={false} style={{ gap: 0 }}>
            <View style={{ padding: spacing.ms, gap: spacing.xs }}>
              <Text variant="subhead" tone="secondary">
                قطعة بيعت قبل استخدام التطبيق: اخترها
              </Text>
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث بالاسم أو الكود أو الماركة"
                testID="return-search"
              />
            </View>
            {matches.map((p) => (
              <Pressable
                key={p.id}
                onPress={() => {
                  setProduct(p);
                  setRefund('');
                }}
                accessibilityRole="button"
                testID={`return-pick-${displayName(ctx, p)}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.ms,
                  paddingHorizontal: spacing.md,
                  paddingVertical: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.separator,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{displayName(ctx, p)}</Text>
                  <Text
                    variant="caption"
                    tone="secondary">{`${p.sku} • ${formatLyd(p.price)}`}</Text>
                </View>
                <Icon name="chevron.left" size={14} color={colors.chevron} />
              </Pressable>
            ))}
          </Card>
        )}

        <Card>
          <Text variant="subhead" tone="secondary">
            الكمية
          </Text>
          <Stepper value={quantity} onChange={setQuantity} max={left} testID="return-quantity" />
          <NumberField
            label="المبلغ المُعاد للزبون"
            hint={
              line
                ? `اتركه فارغاً لإعادة ما دفعه: ${formatLyd(maxRefund(line, quantity))}`
                : 'المبلغ الذي أُعيد للزبون'
            }
            value={refund}
            onChangeText={setRefund}
            suffix="د.ل"
            placeholder={line ? editableDinars(maxRefund(line, quantity)) : ''}
            testID="return-refund"
          />
          <Text variant="subhead" tone="secondary">
            السبب
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {RETURN_REASONS.map((r) => (
              <FilterChip key={r} label={r} selected={reason === r} onPress={() => setReason(r)} />
            ))}
          </View>
          <TextField
            value={reason}
            onChangeText={setReason}
            placeholder="أو اكتب السبب"
            testID="return-reason"
          />
          <Text variant="caption" tone="secondary">
            تعود القطع إلى المخزون عند الحفظ.
          </Text>
          <Button
            title="حفظ المرتجع"
            icon="checkmark.circle.fill"
            fullWidth
            onPress={saveOnce}
            testID="return-save"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
