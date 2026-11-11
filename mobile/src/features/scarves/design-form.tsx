import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  ChipRow,
  FilterChip,
  FormHeader,
  Icon,
  NumberField,
  Text,
  TextField,
  KEYBOARD_GAP,
} from '@/components';
import { listBrands } from '@/domain/brands';
import { RuleError, type Ctx } from '@/domain/context';
import { CATEGORIES, saveScarfDesign } from '@/domain/products';
import { releasePhoto } from '@/features/products/actions';
import { BrandField } from '@/features/products/brand-field';
import { PhotoPicker } from '@/features/products/photo-picker';
import { notifyDataChanged } from '@/state/data-events';
import { useReadable } from '@/hooks/use-readable';
import { spacing, useTheme } from '@/theme';

import { findDesign, storedDesignId } from './actions';
import {
  designFormFrom,
  designFormToInput,
  emptyDesignForm,
  missingStandardSizes,
  sizeRow,
  type DesignForm,
  type SizeRow,
} from './model';

/**
 * Add or edit a scarf design: shared details (photo, name, brand, material, colour), then each
 * size with its own price, cost and stock. Quick-add buttons for the usual sizes.
 */
export function DesignFormView({
  ctx,
  designId,
  onDone,
  embedded = false,
}: {
  ctx: Ctx;
  /** undefined: a new design. */
  designId?: string;
  onDone: () => void;
  /** Shown beside the list on iPad, with its own title bar. */
  embedded?: boolean;
}) {
  const readable = useReadable();
  const { colors } = useTheme();
  const [initial] = useState(() => {
    const design = designId ? findDesign(ctx, designId) : undefined;
    const form = design ? designFormFrom(design) : emptyDesignForm();
    if (!design) form.sizes = [sizeRow('90×90')];
    return { design, form };
  });
  const [form, setForm] = useState<DesignForm>(initial.form);
  const [brands] = useState(() => listBrands(ctx).map((b) => b.name));
  const picked = useRef(new Set<string>());

  // Photos picked here but not saved are removed when the form closes.
  useEffect(() => {
    const files = picked.current;
    return () => files.forEach((f) => releasePhoto(ctx, f));
  }, [ctx]);

  const set = <K extends keyof DesignForm>(key: K, value: DesignForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setRow = (rowKey: string, patch: Partial<SizeRow>) =>
    setForm((f) => ({
      ...f,
      sizes: f.sizes.map((r) => (r.key === rowKey ? { ...r, ...patch } : r)),
    }));
  const addRow = (size = '') => setForm((f) => ({ ...f, sizes: [...f.sizes, sizeRow(size)] }));
  const removeRow = (rowKey: string) =>
    setForm((f) => ({ ...f, sizes: f.sizes.filter((r) => r.key !== rowKey) }));

  const categories = (CATEGORIES.scarves as readonly string[]).includes(form.category)
    ? [...CATEGORIES.scarves]
    : [...CATEGORIES.scarves, form.category];

  const save = () => {
    try {
      saveScarfDesign(
        ctx,
        designFormToInput(form, initial.design ? storedDesignId(initial.design.id) : undefined),
      );
    } catch (error) {
      Alert.alert(
        'لم يتم الحفظ',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ أي تغيير.',
      );
      return;
    }
    new Set(initial.design?.sizes.map((s) => s.imageFile)).forEach((f) => releasePhoto(ctx, f));
    notifyDataChanged();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone();
  };

  return (
    <>
      <FormHeader
        title={initial.design ? 'تعديل التصميم' : 'تصميم جديد'}
        embedded={embedded}
        cancelLabel={embedded ? 'إغلاق' : 'إلغاء'}
        onCancel={onDone}
        onSave={save}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled">
        <Card>
          <PhotoPicker
            ctx={ctx}
            imageFile={form.imageFile}
            placeholder="صورة التصميم"
            onPicked={(file) => {
              picked.current.add(file);
              set('imageFile', file);
            }}
            onRemove={() => set('imageFile', null)}
          />
        </Card>

        <Card>
          <Text variant="headline">التصميم</Text>
          <TextField
            label="اسم التصميم"
            value={form.name}
            onChangeText={(t) => set('name', t)}
            placeholder="مثال: وشاح الحرير الكلاسيكي"
            testID="design-name"
          />
          <BrandField value={form.brand} onChange={(b) => set('brand', b)} brands={brands} />
          <View style={{ gap: spacing.xs }}>
            <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
              الخامة
            </Text>
            <ChipRow
              options={categories.map((c) => ({ value: c, label: c }))}
              value={form.category}
              onChange={(c) => set('category', c)}
            />
          </View>
          <TextField
            label="اللون / النقشة (اختياري)"
            value={form.color}
            onChangeText={(t) => set('color', t)}
          />
        </Card>

        <Card>
          <Text variant="headline">المقاسات والأسعار</Text>
          <Text variant="caption" tone="secondary">
            لكل مقاس سعره وتكلفته ومخزونه. اكتب أي مقاس، مثال: 70×70 أو 180×70.
          </Text>
          {form.sizes.map((row, index) => (
            <SizeRowEditor
              key={row.key}
              row={row}
              index={index}
              onChange={(patch) => setRow(row.key, patch)}
              onRemove={() => removeRow(row.key)}
            />
          ))}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {missingStandardSizes(form.sizes).map((size) => (
              <FilterChip
                key={size}
                label={`＋ ${size}`}
                selected={false}
                onPress={() => addRow(size)}
                testID={`add-size-${size}`}
              />
            ))}
          </View>
          <Button
            title="مقاس آخر (اكتبه بنفسك)"
            icon="plus.circle.fill"
            variant="secondary"
            onPress={() => addRow()}
          />
        </Card>

        <Button
          title={initial.design ? 'حفظ التعديلات' : 'حفظ التصميم'}
          icon="checkmark.circle.fill"
          size="lg"
          fullWidth
          onPress={save}
          testID="design-save"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

function SizeRowEditor({
  row,
  index,
  onChange,
  onRemove,
}: {
  row: SizeRow;
  index: number;
  onChange: (patch: Partial<SizeRow>) => void;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        gap: spacing.sm,
        padding: spacing.ms,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: colors.background,
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <TextField
            label="المقاس"
            value={row.size}
            onChangeText={(t) => onChange({ size: t })}
            placeholder="مثال 90×90"
            testID={`size-${index}`}
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="حذف هذا المقاس"
          onPress={onRemove}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 44,
            height: 48,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.5 : 1,
          })}>
          <Icon name="minus.circle.fill" size={22} color={colors.warning} />
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="السعر"
            value={row.price}
            onChangeText={(t) => onChange({ price: t })}
            placeholder="0"
            testID={`size-price-${index}`}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="التكلفة"
            value={row.cost}
            onChangeText={(t) => onChange({ cost: t })}
            placeholder="0"
            testID={`size-cost-${index}`}
          />
        </View>
        <View style={{ flex: 0.7 }}>
          <NumberField
            label="الكمية"
            kind="integer"
            value={row.stock}
            onChangeText={(t) => onChange({ stock: t })}
            testID={`size-stock-${index}`}
          />
        </View>
      </View>
    </View>
  );
}
