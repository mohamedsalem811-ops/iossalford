import { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  FilterChip,
  FormHeader,
  KEYBOARD_GAP,
  ListGroup,
  ListRow,
  NumberField,
  Segmented,
  Stepper,
  Text,
  TextField,
  useSheetBottomSpace,
} from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import {
  customerSuggestions,
  getCustomer,
  shownName,
  shownPhone,
  type Customer,
} from '@/domain/customers';
import {
  DepositApprovalNeeded,
  getDepositRules,
  takeOrder,
  type TakeOrderInput,
} from '@/domain/orders';
import { CATEGORIES, displayName, getProduct, listProducts } from '@/domain/products';
import { reservedCounts } from '@/domain/reserved';
import { PAYMENT_WAYS } from '@/features/customers/model';
import { PhotoPicker } from '@/features/products/photo-picker';
import { releasePhoto } from '@/features/products/actions';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { useSaveOnce } from '@/hooks/use-save-once';
import { askOwner } from '@/staff/approvals';
import { useActor, useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { depositHint, emptyOrderForm, formPrice, orderFormProblem, type OrderForm } from './model';

/**
 * A deposit (I2): a piece ordered from a supplier for a customer, or a piece in stock held for
 * her. The customer's name and phone, the piece and the agreed price, then the deposit and how
 * it was paid. Saving issues the deposit receipt, which `onDone` opens.
 */
export function OrderFormView({
  ctx,
  kind,
  productId,
  customerId,
  onCancel,
  onDone,
}: {
  ctx: Ctx;
  kind: 'order' | 'hold';
  productId?: number;
  customerId?: number;
  onCancel: () => void;
  onDone: (receiptId: number, orderId: number) => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const bottomSpace = useSheetBottomSpace();
  const isOwner = useActor()?.kind === 'owner';
  const phones = useCan('customers.phones');
  const rules = useMemo(() => getDepositRules(ctx), [ctx]);
  const [picked, setPicked] = useState<Customer | null>(() =>
    customerId ? (getCustomer(ctx, customerId) ?? null) : null,
  );
  const [form, setForm] = useState<OrderForm>(() => ({
    ...emptyOrderForm(kind),
    productId: productId ?? null,
    name: picked?.name ?? '',
    phone: phones ? (picked?.phone ?? '') : '',
  }));
  const [search, setSearch] = useState('');
  const set = <K extends keyof OrderForm>(k: K, v: OrderForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  // A photo picked here and not kept is removed when the form closes.
  const photos = useRef(new Set<string>());
  const [imageFile, setImageFile] = useState<string | null>(null);
  const saved = useRef<string | null>(null);
  useEffect(() => {
    const files = photos.current;
    return () => files.forEach((f) => f !== saved.current && releasePhoto(ctx, f));
  }, [ctx]);

  const piece = form.productId ? getProduct(ctx, form.productId) : undefined;
  const held = piece ? (reservedCounts(ctx, [piece.id]).get(piece.id) ?? 0) : 0;
  const free = piece ? piece.stock - held : 0;
  const found = useMemo(
    () =>
      form.kind === 'hold' && search.trim()
        ? listProducts(ctx, { search, stock: 'available' }).slice(0, 8)
        : [],
    [ctx, form.kind, search],
  );
  const suggestions = form.name && !picked ? customerSuggestions(ctx, form.name, 4, phones) : [];
  const price = formPrice(form, piece?.price ?? null);
  const hint = depositHint(form, piece?.price ?? null, rules, isOwner);
  /** The customer it goes to: picked from the suggestions, unless the name was changed. */
  const customer = picked && picked.name === form.name.trim() ? picked : null;

  const pick = (c: Customer) => {
    haptic.tap();
    setPicked(c);
    setForm((f) => ({ ...f, name: c.name, phone: phones ? (c.phone ?? f.phone) : f.phone }));
  };

  const save = (approval?: string): boolean | void => {
    // Someone who can't see the numbers picks a known customer without typing her phone.
    const phone = form.phone.trim() || customer?.phone || '';
    const problem = orderFormProblem({ ...form, phone }, piece?.price ?? null);
    if (problem) {
      haptic.error();
      Alert.alert('لم يُحفظ العربون', problem);
      return;
    }
    const base = {
      customer: { name: form.name.trim(), phone },
      deposit: { amount: parseThousandths(form.deposit)!, method: form.method },
      note: form.note,
      approval,
    };
    const input: TakeOrderInput =
      form.kind === 'hold'
        ? { ...base, kind: 'hold', productId: form.productId!, quantity: form.quantity }
        : {
            ...base,
            kind: 'order',
            description: form.description,
            brand: form.brand,
            category: form.category,
            size: form.size,
            color: form.color,
            imageFile,
            unitPrice: parseThousandths(form.price)!,
            quantity: form.quantity,
          };
    try {
      const r = takeOrder(ctx, input);
      saved.current = imageFile;
      haptic.success();
      notifyDataChanged();
      onDone(r.receipt.id, r.orderId);
      return true;
    } catch (error) {
      if (error instanceof DepositApprovalNeeded) {
        haptic.medium();
        askOwner(ctx.system, 'deposit', error.message).then((token) => {
          if (token) save(token);
        });
        return;
      }
      haptic.error();
      Alert.alert(
        'لم يُحفظ العربون',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ شيء.',
      );
    }
  };
  const saveOnce = () => once(() => save());

  return (
    <>
      <FormHeader
        title={form.kind === 'hold' ? 'حجز بعربون' : 'طلب بعربون'}
        onCancel={onCancel}
        onSave={saveOnce}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Segmented<'order' | 'hold'>
          options={[
            { value: 'order', label: 'طلب من المورد' },
            { value: 'hold', label: 'حجز قطعة موجودة' },
          ]}
          value={form.kind}
          onChange={(k) => set('kind', k)}
          testID="order-kind"
        />

        <Card>
          <Text variant="subhead" tone="secondary">
            الزبون
          </Text>
          <TextField
            label="الاسم"
            value={form.name}
            onChangeText={(t) => set('name', t)}
            placeholder="اسم الزبون"
            testID="order-name"
          />
          {suggestions.length ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {suggestions.map((c) => (
                <FilterChip
                  key={c.id}
                  label={
                    c.phone
                      ? `${shownName(c.name, phones)} • ${shownPhone(c.phone, phones)}`
                      : shownName(c.name, phones)
                  }
                  selected={false}
                  onPress={() => pick(c)}
                />
              ))}
            </View>
          ) : null}
          {customer && !phones && customer.phone ? (
            <Text variant="caption" tone="secondary" testID="order-known-phone">
              {`الهاتف المحفوظ: ${shownPhone(customer.phone, false)}`}
            </Text>
          ) : (
            <NumberField
              label="رقم الهاتف"
              kind="phone"
              value={form.phone}
              onChangeText={(t) => set('phone', t)}
              placeholder="09XXXXXXXX"
              testID="order-phone"
            />
          )}
        </Card>

        {form.kind === 'hold' ? (
          <Card>
            <Text variant="subhead" tone="secondary">
              القطعة المحجوزة
            </Text>
            {piece ? (
              <ListGroup>
                <ListRow
                  icon="lock"
                  title={displayName(ctx, piece)}
                  subtitle={`${piece.sku} • المتوفر للحجز ${free}`}
                  value={formatLyd(piece.price)}
                  onPress={() => set('productId', null)}
                  testID="order-piece"
                />
              </ListGroup>
            ) : (
              <>
                <TextField
                  label="ابحث عن القطعة"
                  value={search}
                  onChangeText={setSearch}
                  placeholder="الاسم أو الكود أو الماركة"
                  testID="order-search"
                />
                {found.length ? (
                  <ListGroup>
                    {found.map((p) => (
                      <ListRow
                        key={p.id}
                        title={displayName(ctx, p)}
                        subtitle={`${p.sku} • المخزون ${p.stock}`}
                        value={formatLyd(p.price)}
                        onPress={() => {
                          haptic.tap();
                          set('productId', p.id);
                        }}
                        testID={`order-found-${p.id}`}
                      />
                    ))}
                  </ListGroup>
                ) : null}
              </>
            )}
            {piece ? (
              <Text variant="caption" tone="secondary">
                السعر سعر القطعة اليوم، ويُثبَّت لها مع العربون.
              </Text>
            ) : null}
          </Card>
        ) : (
          <Card>
            <Text variant="subhead" tone="secondary">
              القطعة المطلوبة
            </Text>
            <PhotoPicker
              ctx={ctx}
              imageFile={imageFile}
              placeholder="صورة القطعة المطلوبة (اختياري)"
              onPicked={(file) => {
                photos.current.add(file);
                setImageFile(file);
              }}
              onRemove={() => setImageFile(null)}
            />
            <TextField
              label="القطعة"
              value={form.description}
              onChangeText={(t) => set('description', t)}
              placeholder="مثلاً: سوار Tiffany T فضة"
              testID="order-description"
            />
            <TextField
              label="الماركة"
              value={form.brand}
              onChangeText={(t) => set('brand', t)}
              placeholder="Swarovski، Tiffany، Pandora…"
              testID="order-brand"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {CATEGORIES[ctx.system].map((c) => (
                <FilterChip
                  key={c}
                  label={c}
                  selected={form.category === c}
                  onPress={() => set('category', form.category === c ? '' : c)}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <TextField
                  label="المقاس"
                  value={form.size}
                  onChangeText={(t) => set('size', t)}
                  placeholder="اختياري"
                />
              </View>
              <View style={{ flex: 1 }}>
                <TextField
                  label="اللون"
                  value={form.color}
                  onChangeText={(t) => set('color', t)}
                  placeholder="اختياري"
                />
              </View>
            </View>
            <NumberField
              label="السعر المتفق عليه للقطعة"
              value={form.price}
              onChangeText={(t) => set('price', t)}
              suffix="د.ل"
              testID="order-price"
            />
          </Card>
        )}

        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="body" style={{ flex: 1 }}>
              الكمية
            </Text>
            <Stepper
              value={form.quantity}
              min={1}
              max={form.kind === 'hold' && piece ? Math.max(1, free) : 99}
              onChange={(n) => set('quantity', n)}
              testID="order-quantity"
            />
          </View>
          {price ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="headline">السعر المتفق عليه</Text>
              <Text variant="headline" tone="accent" testID="order-total">
                {formatLyd(price)}
              </Text>
            </View>
          ) : null}
          <NumberField
            label="العربون"
            value={form.deposit}
            onChangeText={(t) => set('deposit', t)}
            suffix="د.ل"
            testID="order-deposit"
          />
          {hint ? (
            <Text variant="caption" tone={hint.warn ? 'warning' : 'secondary'} testID="order-hint">
              {hint.text}
            </Text>
          ) : null}
          <Segmented
            options={PAYMENT_WAYS.map((w) => ({ value: w.value, label: w.label }))}
            value={form.method}
            onChange={(m) => set('method', m)}
            testID="order-method"
          />
          <TextField
            label="ملاحظة"
            value={form.note}
            onChangeText={(t) => set('note', t)}
            placeholder="اختياري"
          />
          <Text variant="caption" tone="secondary">
            {rules.policy}
          </Text>
          <Button
            title={
              parseThousandths(form.deposit)
                ? `أخذ العربون • ${formatLyd(parseThousandths(form.deposit)!)}`
                : 'أخذ العربون'
            }
            icon="checkmark.circle.fill"
            size="lg"
            fullWidth
            onPress={saveOnce}
            testID="order-save"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
