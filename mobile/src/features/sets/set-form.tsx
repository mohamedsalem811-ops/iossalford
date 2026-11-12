import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
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
import { displayName, getProduct, listProducts } from '@/domain/products';
import { deleteSet, getSet, saveSet } from '@/domain/sets';
import { showError } from '@/features/products/actions';
import { applyQuery, DEFAULT_QUERY } from '@/features/products/model';
import { ProductPhoto } from '@/features/products/product-photo';
import { parseThousandths } from '@/lib/digits';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import {
  addItem,
  availableText,
  emptySetForm,
  removeItem,
  setFormFrom,
  setFormToInput,
  setItemQuantity,
  setPreview,
  setsAvailable,
} from './model';
import { useSaveOnce } from '@/hooks/use-save-once';
import { haptic } from '@/lib/haptics';

const PICK_LIMIT = 30;

/**
 * A set: its name, its pieces (scarves show their size), a discount, and a live preview of
 * the price and how many sets the stock covers.
 */
export function SetFormView({
  ctx,
  setId,
  onDone,
}: {
  ctx: Ctx;
  setId?: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const saveOnce = () => once(save);
  const bottomSpace = useSheetBottomSpace();
  const [existing] = useState(() => (setId ? getSet(ctx, setId) : undefined));
  const [form, setForm] = useState(() => (existing ? setFormFrom(existing) : emptySetForm()));
  const [search, setSearch] = useState('');
  const [products] = useState(() => listProducts(ctx));
  const find = (id: number) => getProduct(ctx, id);
  const preview = setPreview(form.items, parseThousandths(form.discount) ?? 0, find);
  const available = setsAvailable(form.items, find);
  const chosen = new Set(form.items.map((i) => i.productId));
  const matches = applyQuery(products, { ...DEFAULT_QUERY, search })
    .filter((p) => !chosen.has(p.id))
    .slice(0, PICK_LIMIT);

  const save = () => {
    try {
      saveSet(ctx, setFormToInput(form, existing?.id));
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    onDone();
    return true;
  };

  const remove = () =>
    Alert.alert(`حذف طقم «${existing?.name}»؟`, 'لا تتأثر القطع ولا المبيعات السابقة.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          try {
            if (existing) deleteSet(ctx, existing.id);
          } catch (error) {
            showError(error);
            return;
          }
          notifyDataChanged();
          onDone();
        },
      },
    ]);

  return (
    <>
      <FormHeader
        title={existing ? 'تعديل الطقم' : 'طقم جديد'}
        onCancel={onDone}
        onSave={saveOnce}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <TextField
            label="اسم الطقم"
            value={form.name}
            onChangeText={(name) => setForm((f) => ({ ...f, name }))}
            placeholder="مثل: طقم العروس"
            testID="set-name"
          />
          <NumberField
            label="الخصم"
            hint="يُخصم من مجموع أسعار القطع، ويُوزّع عليها عند البيع"
            value={form.discount}
            onChangeText={(discount) => setForm((f) => ({ ...f, discount }))}
            placeholder="0"
            suffix="د.ل"
            testID="set-discount"
          />
        </Card>

        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          {`قطع الطقم (${form.items.length})`}
        </Text>
        <Card padded={false} style={{ gap: 0 }}>
          {form.items.length === 0 ? (
            <Text variant="subhead" tone="secondary" style={{ padding: spacing.md }}>
              اختر القطع من القائمة بالأسفل.
            </Text>
          ) : (
            form.items.map((it, i) => {
              const p = find(it.productId);
              const name = p ? displayName(ctx, p) : 'قطعة محذوفة';
              return (
                <View
                  key={it.productId}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.sm,
                    padding: spacing.ms,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.separator,
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {name}
                    </Text>
                    <Text variant="caption" tone={p && p.stock > 0 ? 'secondary' : 'warning'}>
                      {p ? `${formatLyd(p.price)} • المخزون ${p.stock}` : 'لم تعد في المخزون'}
                    </Text>
                  </View>
                  <Stepper
                    value={it.quantity}
                    onChange={(q) =>
                      setForm((f) => ({ ...f, items: setItemQuantity(f.items, it.productId, q) }))
                    }
                  />
                  <Pressable
                    onPress={() =>
                      setForm((f) => ({ ...f, items: removeItem(f.items, it.productId) }))
                    }
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`إزالة ${name} من الطقم`}>
                    <Icon name="minus.circle.fill" size={22} color={colors.warning} />
                  </Pressable>
                </View>
              );
            })
          )}
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="subhead" tone="secondary">
              مجموع الأسعار
            </Text>
            <Text variant="subhead">{formatLyd(preview.list)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="subhead" tone="secondary">
              الخصم
            </Text>
            <Text variant="subhead">{formatLyd(preview.discount)}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="headline">سعر الطقم</Text>
            <Text variant="title" tone="accent" testID="set-price">
              {formatLyd(preview.price)}
            </Text>
          </View>
          <Text variant="caption" tone={available > 0 ? 'secondary' : 'warning'}>
            {form.items.length ? availableText(available) : ' '}
          </Text>
        </Card>

        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          إضافة قطع
        </Text>
        <TextField
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث بالاسم أو الكود أو الماركة"
          testID="set-search"
        />
        <Card padded={false} style={{ gap: 0 }}>
          {matches.length === 0 ? (
            <Text variant="subhead" tone="secondary" style={{ padding: spacing.md }}>
              {products.length === 0 ? 'لا توجد منتجات بعد.' : 'لا توجد نتائج.'}
            </Text>
          ) : (
            matches.map((p, i) => (
              <Pressable
                key={p.id}
                onPress={() => setForm((f) => ({ ...f, items: addItem(f.items, p.id) }))}
                accessibilityRole="button"
                accessibilityLabel={`إضافة ${displayName(ctx, p)} للطقم`}
                testID={`set-pick-${displayName(ctx, p)}`}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.ms,
                  padding: spacing.ms,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.separator,
                  opacity: pressed ? 0.6 : 1,
                })}>
                <ProductPhoto system={ctx.system} imageFile={p.imageFile} size={40} />
                <View style={{ flex: 1 }}>
                  <Text variant="body" numberOfLines={1}>
                    {displayName(ctx, p)}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {`${p.sku} • ${formatLyd(p.price)} • المخزون ${p.stock}`}
                  </Text>
                </View>
                <Icon name="plus.circle.fill" size={22} color={colors.accent} />
              </Pressable>
            ))
          )}
        </Card>

        {existing ? (
          <Button title="حذف الطقم" variant="destructive" icon="trash" onPress={remove} />
        ) : null}
      </KeyboardAwareScrollView>
    </>
  );
}
