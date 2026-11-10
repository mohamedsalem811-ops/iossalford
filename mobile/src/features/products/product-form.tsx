import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  ChipRow,
  FormHeader,
  Icon,
  NumberField,
  Segmented,
  Text,
  TextField,
  KEYBOARD_GAP,
} from '@/components';
import { listBrands } from '@/domain/brands';
import type { Ctx } from '@/domain/context';
import { RuleError } from '@/domain/context';
import { CATEGORIES, getProduct, productBySku, saveProduct } from '@/domain/products';
import { getRate } from '@/domain/settings';
import { parseInteger } from '@/lib/digits';
import { formatLyd, formatRate } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, touchTarget, useTheme } from '@/theme';

import { releasePhoto } from './actions';
import { BrandField } from './brand-field';
import {
  costInDirhams,
  emptyForm,
  formFromProduct,
  formToInput,
  margin,
  validateForm,
  type ProductForm,
} from './form-model';
import { PhotoPicker } from './photo-picker';

/**
 * Add or edit a piece: photo, details, price with live profit, and stock. Saving checks the code
 * is not used by another piece. Photos picked here and not kept are removed when it closes.
 */
export function ProductFormView({
  ctx,
  productId,
  onDone,
  embedded = false,
}: {
  ctx: Ctx;
  /** undefined: a new piece. */
  productId?: number;
  onDone: () => void;
  /** Shown beside the list on iPad, with its own title bar. */
  embedded?: boolean;
}) {
  const { colors } = useTheme();
  const [initial] = useState(() => {
    const p = productId ? getProduct(ctx, productId) : undefined;
    return { product: p, form: p ? formFromProduct(p) : emptyForm(ctx.system) };
  });
  const [form, setForm] = useState<ProductForm>(initial.form);
  const [tried, setTried] = useState(false);
  const [brands] = useState(() => listBrands(ctx).map((b) => b.name));
  const [rate] = useState(() => getRate(ctx));
  const picked = useRef(new Set<string>());

  // Photos picked here but not saved are removed when the form closes, however it is closed.
  useEffect(() => {
    const files = picked.current;
    return () => files.forEach((f) => releasePhoto(ctx, f));
  }, [ctx]);

  const set = <K extends keyof ProductForm>(key: K, value: ProductForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const errors = tried ? validateForm(form) : {};
  const skuOwner = form.sku.trim() ? productBySku(ctx, form.sku) : undefined;
  const skuTaken = skuOwner && skuOwner.id !== productId ? skuOwner : undefined;
  const profit = margin(form, rate);
  const costLyd = form.currency === 'usd' ? costInDirhams(form, rate) : null;
  const categories = CATEGORIES[ctx.system].includes(form.category as never)
    ? [...CATEGORIES[ctx.system]]
    : [...CATEGORIES[ctx.system], form.category];

  const save = () => {
    setTried(true);
    const problems = validateForm(form);
    const first = Object.values(problems)[0];
    if (first) {
      Alert.alert('لم يتم الحفظ', first);
      return;
    }
    try {
      saveProduct(ctx, formToInput(form, productId));
    } catch (error) {
      Alert.alert(
        'لم يتم الحفظ',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ أي تغيير.',
      );
      return;
    }
    // The photo this piece had before, if it was replaced or removed and nothing else shows it.
    releasePhoto(ctx, initial.product?.imageFile);
    notifyDataChanged();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone();
  };

  const stock = parseInteger(form.stock) ?? 0;

  return (
    <>
      <FormHeader
        title={productId ? 'تعديل القطعة' : 'قطعة جديدة'}
        embedded={embedded}
        cancelLabel={embedded ? 'إغلاق' : 'إلغاء'}
        onCancel={onDone}
        onSave={save}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{
          padding: spacing.md,
          gap: spacing.md,
          width: '100%',
          maxWidth: 760,
          alignSelf: 'center',
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <Card>
          <PhotoPicker
            ctx={ctx}
            imageFile={form.imageFile}
            onPicked={(file) => {
              picked.current.add(file);
              set('imageFile', file);
            }}
            onRemove={() => set('imageFile', null)}
          />
        </Card>

        <Card>
          <Text variant="headline">بيانات القطعة</Text>
          <TextField
            label="اسم القطعة"
            value={form.name}
            onChangeText={(t) => set('name', t)}
            placeholder={ctx.system === 'jewelry' ? 'مثال: خاتم سوليتير ألماس' : 'مثال: وشاح حرير'}
            error={errors.name}
            testID="product-name"
          />
          <BrandField value={form.brand} onChange={(b) => set('brand', b)} brands={brands} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
              الفئة
            </Text>
            <ChipRow
              options={categories.map((c) => ({ value: c, label: c }))}
              value={form.category}
              onChange={(c) => set('category', c)}
            />
          </View>
          <TextField
            label="اللون (اختياري)"
            value={form.color}
            onChangeText={(t) => set('color', t)}
            placeholder="ذهبي، فضي، روز جولد"
          />
          <TextField
            label="المقاس (اختياري)"
            value={form.size}
            onChangeText={(t) => set('size', t)}
            placeholder="مثال: 7 أو M"
          />
          <TextField
            label="الكود"
            value={form.sku}
            onChangeText={(t) => set('sku', t.toUpperCase())}
            placeholder="يُولّد تلقائياً إذا تُرك فارغاً"
            autoCapitalize="characters"
            autoCorrect={false}
            hint="يجب أن يكون الكود مختلفاً لكل قطعة"
            error={skuTaken ? `الكود مستخدم للقطعة «${skuTaken.name}»` : undefined}
            testID="product-sku"
          />
        </Card>

        <Card>
          <Text variant="headline">السعر</Text>
          <NumberField
            label="سعر البيع"
            value={form.price}
            onChangeText={(t) => set('price', t)}
            suffix="د.ل"
            placeholder="0"
            error={errors.price}
            testID="product-price"
          />
          <View style={{ gap: spacing.xs }}>
            <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
              عملة التكلفة
            </Text>
            <Segmented
              options={[
                { value: 'lyd', label: 'دينار ليبي' },
                { value: 'usd', label: 'دولار' },
              ]}
              value={form.currency}
              onChange={(c) => setForm((f) => ({ ...f, currency: c, cost: '' }))}
            />
          </View>
          <NumberField
            label="سعر التكلفة"
            value={form.cost}
            onChangeText={(t) => set('cost', t)}
            suffix={form.currency === 'usd' ? '$' : 'د.ل'}
            placeholder="0"
            error={errors.cost}
            hint={
              costLyd !== null
                ? `= ${formatLyd(costLyd)} بسعر الصرف ${formatRate(rate)}`
                : 'أدخل 0 إذا كانت التكلفة غير معروفة. التكلفة بالدولار تُحفظ بسعر الصرف الحالي.'
            }
            testID="product-cost"
          />
          {profit ? (
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}>
              <Text variant="body">الربح للقطعة</Text>
              <Text variant="bodyStrong" tone={profit.profit >= 0 ? 'accent' : 'warning'}>
                {formatLyd(profit.profit)} • {profit.percent}٪
              </Text>
            </View>
          ) : null}
        </Card>

        <Card>
          <Text variant="headline">المخزون</Text>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
            <StepButton
              icon="minus"
              label="إنقاص الكمية"
              disabled={stock <= 0}
              onPress={() => set('stock', String(Math.max(0, stock - 1)))}
            />
            <View style={{ flex: 1 }}>
              <NumberField
                label="الكمية في المخزن"
                kind="integer"
                value={form.stock}
                onChangeText={(t) => set('stock', t)}
                error={errors.stock}
                testID="product-stock"
              />
            </View>
            <StepButton
              icon="plus"
              label="زيادة الكمية"
              onPress={() => set('stock', String(stock + 1))}
            />
          </View>
          <NumberField
            label="تنبيه عند وصول المخزون إلى"
            kind="integer"
            value={form.lowStock}
            onChangeText={(t) => set('lowStock', t)}
            suffix="قطع"
            error={errors.lowStock}
          />
        </Card>

        <Button
          title={productId ? 'حفظ التعديلات' : 'حفظ وإضافة القطعة'}
          icon="checkmark.circle.fill"
          size="lg"
          fullWidth
          onPress={save}
          testID="product-save"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

function StepButton({
  icon,
  label,
  onPress,
  disabled = false,
}: {
  icon: 'plus' | 'minus';
  label: string;
  onPress: () => void;
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
      style={({ pressed }) => ({
        width: touchTarget + 4,
        height: 48,
        borderRadius: 12,
        borderCurve: 'continuous',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accentSoft,
        opacity: disabled ? 0.4 : pressed ? 0.6 : 1,
      })}>
      <Icon name={icon} size={18} color={colors.accent} weight="semibold" />
    </Pressable>
  );
}
