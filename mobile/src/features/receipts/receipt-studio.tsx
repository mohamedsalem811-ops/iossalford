import { isRunningInExpoGo } from 'expo';
import { useRef, useState } from 'react';
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
  Segmented,
  Stepper,
  Text,
  TextField,
} from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import { displayName, listProducts } from '@/domain/products';
import {
  deleteReceipt,
  getReceipt,
  issueReceipt,
  updateReceipt,
  type Receipt,
} from '@/domain/receipts';
import { applyQuery, DEFAULT_QUERY } from '@/features/products/model';
import { formatLyd } from '@/lib/money';
import { printReceipt, saveReceiptToFiles, shareReceipt } from '@/receipts/output';
import { notifyDataChanged } from '@/state/data-events';
import { radius, spacing, useTheme } from '@/theme';
import { useReadable } from '@/hooks/use-readable';

import {
  blankItem,
  emptyStudio,
  itemFromProduct,
  moveItem,
  receiptDoc,
  studioDoc,
  studioFrom,
  studioItems,
  studioProblem,
  type StudioForm,
  type StudioItem,
} from './model';
import { ReceiptPreview } from './receipt-preview';
import { TemplatePicker } from './template-picker';
import { haptic } from '@/lib/haptics';
import { useCan } from '@/staff/use-can';

const PICK_LIMIT = 20;

/**
 * The receipt studio: its number, date and time; the design; official with prices or a gift
 * receipt without; the customer; the lines (from the stock or typed, reordered); a live preview;
 * then save, print, share the PDF or keep it in the Files app.
 */
export function ReceiptStudio({
  ctx,
  receiptId,
  onDone,
}: {
  ctx: Ctx;
  receiptId?: number;
  onDone: () => void;
}) {
  const readable = useReadable();
  const { colors } = useTheme();
  const mayDelete = useCan('receipts.delete');
  const [saved, setSaved] = useState<Receipt | null>(() =>
    receiptId ? (getReceipt(ctx, receiptId) ?? null) : null,
  );
  const [form, setForm] = useState<StudioForm>(() =>
    saved ? studioFrom(saved) : emptyStudio(ctx.system),
  );
  // The receipt as saved, read at once: a quick second tap on "حفظ" updates it instead of issuing
  // a second receipt with the next number.
  const savedRef = useRef(saved);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [search, setSearch] = useState('');
  const [products] = useState(() => listProducts(ctx));

  if (receiptId && !saved) return <EmptyState icon="doc.text" title="الإيصال غير موجود" />;

  const change = (next: (f: StudioForm) => StudioForm) => {
    setForm(next);
    setDirty(true);
  };
  const setItem = (key: string, patch: Partial<StudioItem>) =>
    change((f) => ({ ...f, items: f.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));

  /** Saves (a new receipt gets its number now). Returns the saved receipt, or null. */
  const save = (): Receipt | null => {
    const problem = studioProblem(form);
    if (problem) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', problem);
      return null;
    }
    try {
      const input = {
        items: studioItems(form),
        customer: form.customer,
        template: form.template,
        showPrices: form.showPrices,
        showSpecs: form.showSpecs,
      };
      const current = savedRef.current;
      const r = current ? updateReceipt(ctx, current.id, input) : issueReceipt(ctx, input);
      savedRef.current = r;
      setSaved(r);
      setDirty(false);
      notifyDataChanged();
      haptic.success();
      return r;
    } catch (error) {
      Alert.alert(
        'لم يتم الحفظ',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ أي تغيير.',
      );
      return null;
    }
  };

  /** Print, share or keep: saved first, so the PDF always has its number. */
  const output = async (kind: 'print' | 'share' | 'files') => {
    const r = dirty || !saved ? save() : saved;
    if (!r) return;
    setBusy(true);
    try {
      const doc = receiptDoc(r);
      if (kind === 'print') await printReceipt(doc);
      else if (kind === 'share') await shareReceipt(doc);
      else {
        const name = await saveReceiptToFiles(doc);
        Alert.alert(
          'حُفظ في الملفات',
          isRunningInExpoGo()
            ? `${name}\nفي Expo Go يُحفظ داخل Expo Go. في التطبيق المثبّت تجده في تطبيق الملفات ← على الـ iPhone (أو الـ iPad) ← SALFORD POS ← Receipts.`
            : `${name}\nتجده في تطبيق الملفات ← على الـ iPhone (أو الـ iPad) ← SALFORD POS ← Receipts.`,
        );
      }
    } catch {
      Alert.alert('تعذّر إنشاء ملف الإيصال', 'حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    if (!dirty) return onDone();
    Alert.alert('تجاهل التغييرات؟', 'لم تُحفظ التعديلات على هذا الإيصال.', [
      { text: 'متابعة التعديل', style: 'cancel' },
      { text: 'تجاهل', style: 'destructive', onPress: onDone },
    ]);
  };

  const remove = () =>
    saved &&
    Alert.alert(
      `حذف الإيصال ${saved.receiptNo}؟`,
      'لا يتأثر البيع ولا المخزون، ولا يُعطى رقمه لإيصال آخر.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            deleteReceipt(ctx, saved.id);
            notifyDataChanged();
            onDone();
          },
        },
      ],
    );

  const doc = studioDoc(form, saved, ctx.now());
  const total = studioItems(form).reduce((t, i) => t + i.price * i.quantity, 0);
  const matches = applyQuery(products, { ...DEFAULT_QUERY, search }).slice(0, PICK_LIMIT);

  return (
    <>
      <FormHeader
        title={saved ? saved.receiptNo : 'إيصال جديد'}
        onCancel={close}
        onSave={() => save()}
        cancelLabel="إغلاق"
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
        keyboardShouldPersistTaps="handled">
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Text variant="headline" testID="studio-number">
                {saved ? saved.receiptNo : 'إيصال جديد'}
              </Text>
              <Text variant="caption" tone="secondary">
                {saved
                  ? `${saved.date} • ${saved.time}${saved.saleId ? ` • بيعة رقم ${saved.saleId}` : ' • إيصال يدوي'}`
                  : `${doc.date} • ${doc.time} • يُعطى الرقم عند الحفظ`}
              </Text>
            </View>
            {saved && !dirty ? (
              <Text variant="caption" tone="accent">
                محفوظ ✓
              </Text>
            ) : dirty ? (
              <Text variant="caption" tone="warning">
                غير محفوظ
              </Text>
            ) : null}
          </View>
        </Card>

        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          التصميم
        </Text>
        <TemplatePicker
          system={ctx.system}
          value={form.template}
          onChange={(template) => change((f) => ({ ...f, template }))}
        />

        <Card>
          <Segmented
            options={[
              { value: 'official', label: 'رسمية بالأسعار' },
              { value: 'gift', label: 'هدية بدون أسعار' },
            ]}
            value={form.showPrices ? 'official' : 'gift'}
            onChange={(v) => change((f) => ({ ...f, showPrices: v === 'official' }))}
            testID="studio-type"
          />
          <FilterChip
            label={form.showSpecs ? '✓ المواصفات والخامة تحت القطع' : 'المواصفات والخامة مخفية'}
            selected={form.showSpecs}
            onPress={() => change((f) => ({ ...f, showSpecs: !f.showSpecs }))}
            testID="studio-specs"
          />
          <TextField
            label="الزبون"
            value={form.customer}
            onChangeText={(customer) => change((f) => ({ ...f, customer }))}
            placeholder="Salford Libya"
            hint="الاسم كما يظهر في الإيصال"
            testID="studio-customer"
          />
        </Card>

        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          {`القطع (${form.items.length})${form.showPrices && total > 0 ? ` • ${formatLyd(total)}` : ''}`}
        </Text>
        {form.items.length === 0 ? (
          <Card>
            <Text variant="subhead" tone="secondary">
              لا توجد قطع في الإيصال. أضف قطعة من المخزون أو اكتبها.
            </Text>
          </Card>
        ) : null}
        {form.items.map((it, n) => (
          <Card key={it.key} testID={`studio-item-${n}`}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
                {`القطعة ${n + 1}`}
              </Text>
              <IconButton
                icon="chevron.up"
                label="نقل للأعلى"
                disabled={n === 0}
                onPress={() => change((f) => ({ ...f, items: moveItem(f.items, it.key, -1) }))}
                testID={`studio-up-${n}`}
              />
              <IconButton
                icon="chevron.down"
                label="نقل للأسفل"
                disabled={n === form.items.length - 1}
                onPress={() => change((f) => ({ ...f, items: moveItem(f.items, it.key, 1) }))}
                testID={`studio-down-${n}`}
              />
              <IconButton
                icon="trash"
                label="حذف القطعة من الإيصال"
                danger
                onPress={() =>
                  change((f) => ({ ...f, items: f.items.filter((i) => i.key !== it.key) }))
                }
                testID={`studio-remove-${n}`}
              />
            </View>
            <TextField
              label="اسم القطعة"
              value={it.name}
              onChangeText={(name) => setItem(it.key, { name })}
              testID={`studio-name-${n}`}
            />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="الماركة"
                  value={it.brand}
                  onChangeText={(brand) => setItem(it.key, { brand })}
                  placeholder="اختياري"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="اللون"
                  value={it.color}
                  onChangeText={(color) => setItem(it.key, { color })}
                  placeholder="اختياري"
                />
              </View>
            </View>
            <TextField
              label="الكود"
              value={it.code}
              onChangeText={(code) => setItem(it.key, { code })}
              placeholder="اختياري"
            />
            <TextField
              label="المواصفات والخامة"
              value={it.specs}
              onChangeText={(specs) => setItem(it.key, { specs })}
              placeholder="اختياري"
              multiline
              maxLength={300}
              testID={`studio-specs-${n}`}
            />
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: spacing.md }}>
              <View style={{ flex: 1 }}>
                <NumberField
                  label="السعر"
                  value={it.price}
                  onChangeText={(price) => setItem(it.key, { price })}
                  suffix="د.ل"
                  placeholder={form.showPrices ? '' : 'لا يظهر في الهدية'}
                  testID={`studio-price-${n}`}
                />
              </View>
              <View style={{ paddingBottom: spacing.xs }}>
                <Stepper
                  value={it.quantity}
                  onChange={(quantity) => setItem(it.key, { quantity })}
                  testID={`studio-qty-${n}`}
                />
              </View>
            </View>
          </Card>
        ))}

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="من المخزون"
            icon="shippingbox"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => setPicking((v) => !v)}
            testID="studio-pick"
          />
          <Button
            title="قطعة تكتبها"
            icon="plus"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => change((f) => ({ ...f, items: [...f.items, blankItem()] }))}
            testID="studio-add"
          />
        </View>
        {picking ? (
          <Card padded={false} style={{ gap: 0 }}>
            <View style={{ padding: spacing.ms }}>
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث بالاسم أو الكود أو الماركة"
                testID="studio-search"
              />
            </View>
            {matches.length === 0 ? (
              <Text variant="subhead" tone="secondary" style={{ padding: spacing.md }}>
                {products.length === 0 ? 'لا توجد منتجات بعد.' : 'لا توجد نتائج.'}
              </Text>
            ) : (
              matches.map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    change((f) => ({ ...f, items: [...f.items, itemFromProduct(ctx, p)] }))
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`إضافة ${displayName(ctx, p)} للإيصال`}
                  testID={`studio-pick-${displayName(ctx, p)}`}
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
                    <Text variant="body" numberOfLines={1}>
                      {displayName(ctx, p)}
                    </Text>
                    <Text variant="caption" tone="secondary">
                      {`${p.sku} • ${formatLyd(p.price)}`}
                    </Text>
                  </View>
                  <Icon name="plus.circle.fill" size={22} color={colors.accent} />
                </Pressable>
              ))
            )}
          </Card>
        ) : null}

        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          المعاينة
        </Text>
        <ReceiptPreview doc={doc} />

        <Button
          title="طباعة"
          icon="printer.fill"
          size="lg"
          fullWidth
          loading={busy}
          onPress={() => output('print')}
          testID="studio-print"
        />
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button
            title="مشاركة PDF"
            icon="square.and.arrow.up"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={busy}
            onPress={() => output('share')}
            testID="studio-share"
          />
          <Button
            title="حفظ في الملفات"
            icon="folder"
            variant="secondary"
            style={{ flex: 1 }}
            disabled={busy}
            onPress={() => output('files')}
            testID="studio-files"
          />
        </View>
        <Button
          title={saved ? 'حفظ التعديلات' : 'حفظ الإيصال فقط'}
          icon="tray.and.arrow.down"
          variant="ghost"
          onPress={() => save()}
          testID="studio-save"
        />
        {saved && mayDelete ? (
          <Button
            title="حذف الإيصال"
            icon="trash"
            variant="destructive"
            onPress={remove}
            testID="studio-delete"
          />
        ) : null}
      </KeyboardAwareScrollView>
    </>
  );
}

function IconButton({
  icon,
  label,
  onPress,
  disabled = false,
  danger = false,
  testID,
}: {
  icon: 'chevron.up' | 'chevron.down' | 'trash';
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      testID={testID}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accentSoft,
        opacity: disabled ? 0.3 : pressed ? 0.6 : 1,
      })}>
      <Icon name={icon} size={15} color={danger ? colors.warning : colors.accent} />
    </Pressable>
  );
}
