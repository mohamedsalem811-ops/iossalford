import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  EmptyState,
  FilterChip,
  FormHeader,
  KEYBOARD_GAP,
  NumberField,
  Segmented,
  Text,
  TextField,
} from '@/components';
import { checkout, PAYMENT_LABELS, PAYMENT_METHODS, type PaymentMethod } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { customerByPhone, customerSuggestions, type Customer } from '@/domain/customers';
import { getRate } from '@/domain/settings';
import { showError } from '@/features/products/actions';
import { formatLyd, formatRate, formatUsd } from '@/lib/money';
import { putCart, useCart } from '@/state/cart';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { cartTotals, checkoutProblem, emptyCheckoutForm, type CheckoutForm } from './model';

/**
 * Checkout: how the customer pays, who the customer is (found by phone first, then name, or
 * added), a note, and the totals in LYD and USD. A credit sale needs a name or phone.
 */
export function CheckoutView({
  ctx,
  onCancel,
  onSold,
}: {
  ctx: Ctx;
  onCancel: () => void;
  onSold: (saleId: number) => void;
}) {
  const { colors } = useTheme();
  const { cart } = useCart(ctx.system);
  const [form, setForm] = useState<CheckoutForm>(emptyCheckoutForm);
  const [busy, setBusy] = useState(false);
  const rate = getRate(ctx);
  const totals = cartTotals(cart, rate);
  const set = <K extends keyof CheckoutForm>(k: K, v: CheckoutForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const known = form.phone ? customerByPhone(ctx, form.phone) : undefined;
  const suggestions = form.name && !known ? customerSuggestions(ctx, form.name) : [];
  const pick = (c: Customer) =>
    setForm((f) => ({ ...f, name: c.name, phone: c.phone ?? f.phone, area: c.area ?? f.area }));

  if (cart.length === 0) {
    return (
      <>
        <FormHeader title="إتمام البيع" embedded={false} onCancel={onCancel} onSave={onCancel} />
        <EmptyState icon="cart" title="السلة فارغة" message="أضف قطعاً من شاشة البيع أولاً." />
      </>
    );
  }

  const confirm = () => {
    const problem = checkoutProblem(form, cart);
    if (problem) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      Alert.alert('لم يتم البيع', problem);
      return;
    }
    setBusy(true);
    try {
      const r = checkout(ctx, {
        cart,
        paymentMethod: form.method,
        customer: {
          name: form.name || known?.name,
          phone: form.phone,
          area: form.area,
        },
        note: form.note,
      });
      putCart(ctx.system, []);
      notifyDataChanged();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onSold(r.saleId);
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      showError(error);
      setBusy(false);
    }
  };

  const credit = form.method === 'credit';
  return (
    <>
      <FormHeader
        title="إتمام البيع"
        embedded={false}
        onCancel={onCancel}
        onSave={confirm}
        cancelLabel="رجوع"
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="subhead" tone="secondary">
            طريقة الدفع
          </Text>
          <Segmented<PaymentMethod>
            options={PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABELS[m] }))}
            value={form.method}
            onChange={(m) => set('method', m)}
            testID="checkout-method"
          />
          {credit ? (
            <Text variant="caption" tone="warning">
              البيع الآجل يُسجَّل ديناً على الزبون: اكتب اسمه أو رقم هاتفه.
            </Text>
          ) : null}
        </Card>

        <Card>
          <Text variant="subhead" tone="secondary">
            {credit ? 'الزبون (مطلوب)' : 'الزبون (اختياري)'}
          </Text>
          <NumberField
            label="رقم الهاتف"
            kind="phone"
            value={form.phone}
            onChangeText={(t) => set('phone', t)}
            placeholder="09XXXXXXXX"
            testID="checkout-phone"
          />
          {known ? (
            <Text variant="caption" tone="accent" testID="checkout-known">
              {`زبون مسجل: ${known.name}${known.area ? ` • ${known.area}` : ''}`}
            </Text>
          ) : null}
          <TextField
            label="الاسم"
            value={form.name}
            onChangeText={(t) => set('name', t)}
            placeholder={known ? known.name : 'اسم الزبون'}
            testID="checkout-name"
          />
          {suggestions.length > 0 ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {suggestions.map((c) => (
                <FilterChip
                  key={c.id}
                  label={c.phone ? `${c.name} • ${c.phone}` : c.name}
                  selected={false}
                  onPress={() => pick(c)}
                />
              ))}
            </View>
          ) : null}
          <TextField
            label="المنطقة"
            value={form.area}
            onChangeText={(t) => set('area', t)}
            placeholder="اختياري"
            testID="checkout-area"
          />
          <Text variant="caption" tone="secondary">
            يُبحث عن الزبون برقم الهاتف أولاً ثم بالاسم، ويُضاف تلقائياً إن كان جديداً.
          </Text>
        </Card>

        <Card>
          <TextField
            label="ملاحظة"
            value={form.note}
            onChangeText={(t) => set('note', t)}
            placeholder="اختياري"
            testID="checkout-note"
          />
        </Card>

        <Card>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="subhead" tone="secondary">
              {`${totals.pieces} قطعة • ${PAYMENT_LABELS[form.method]}`}
            </Text>
            <Text variant="subhead" tone="secondary" testID="checkout-usd">
              {`${formatUsd(totals.usd)} (${formatRate(rate)})`}
            </Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="headline">المجموع</Text>
            <Text variant="title" tone="accent" testID="checkout-total">
              {formatLyd(totals.total)}
            </Text>
          </View>
          <Button
            title={`تأكيد البيع • ${formatLyd(totals.total)}`}
            icon="checkmark.circle.fill"
            size="lg"
            fullWidth
            loading={busy}
            onPress={confirm}
            testID="checkout-confirm"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
