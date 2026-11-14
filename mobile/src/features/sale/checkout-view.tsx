import { Stack } from 'expo-router';
import { useRef, useState } from 'react';
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
import {
  ApprovalNeeded,
  checkout,
  CheckoutError,
  discountMessage,
  PAYMENT_LABELS,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '@/domain/checkout';
import { cartDiscount, needsApproval, updatePrices } from '@/domain/cart';
import { getSet, setForCart } from '@/domain/sets';
import { getPolicies } from '@/domain/policies';
import { getProduct } from '@/domain/products';
import { askOwner, chooseReason } from '@/staff/approvals';
import { useActor } from '@/staff/use-can';
import { RuleError, type Ctx } from '@/domain/context';
import { customerByPhone, customerSuggestions, type Customer } from '@/domain/customers';
import { balance } from '@/domain/debts';
import { getRate } from '@/domain/settings';
import { formatLyd, formatRate, formatUsd } from '@/lib/money';
import { putCart, useCart } from '@/state/cart';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import {
  cartTotals,
  checkoutProblem,
  creditUse,
  emptyCheckoutForm,
  type CheckoutForm,
} from './model';
import { useSaveOnce } from '@/hooks/use-save-once';
import { haptic } from '@/lib/haptics';

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
  const once = useSaveOnce();
  const confirmOnce = () => once(confirm);
  const { cart } = useCart(ctx.system);
  const [form, setForm] = useState<CheckoutForm>(emptyCheckoutForm);
  const [busy, setBusy] = useState(false);
  const asking = useRef(false);
  const rate = getRate(ctx);
  const totals = cartTotals(cart, rate);
  const isOwner = useActor()?.kind === 'owner';
  const discount = cartDiscount(cart, (id) => getProduct(ctx, id)?.price, getPolicies(ctx));
  const set = <K extends keyof CheckoutForm>(k: K, v: CheckoutForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [picked, setPicked] = useState<Customer | null>(null);
  const known = form.phone ? customerByPhone(ctx, form.phone) : undefined;
  const suggestions = form.name && !known ? customerSuggestions(ctx, form.name) : [];
  const pick = (c: Customer) => {
    setPicked(c);
    setForm((f) => ({ ...f, name: c.name, phone: c.phone ?? f.phone, area: c.area ?? f.area }));
  };
  /** The registered customer this sale goes to: by phone, or the one picked by name. */
  const customer = known ?? (picked && picked.name === form.name ? picked : undefined);
  /** What the shop owes this customer (له رصيد), which a sale on credit uses up. */
  const customerCredit = customer ? Math.max(0, -balance(ctx, customer.id)) : 0;

  if (cart.length === 0) {
    return (
      <>
        <Stack.Title>إتمام البيع</Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={onCancel}>رجوع</Stack.Toolbar.Button>
        </Stack.Toolbar>
        <EmptyState icon="cart" title="السلة فارغة" message="أضف قطعاً من شاشة البيع أولاً." />
      </>
    );
  }

  /** Sells; on a discount over the limits, asks the owner on the spot and sells again. */
  const sell = (extra: { discountReason?: string; approval?: string } = {}) => {
    setBusy(true);
    try {
      const r = checkout(ctx, {
        cart,
        paymentMethod: form.method,
        customer: {
          name: form.name || customer?.name,
          phone: form.phone,
          area: form.area,
        },
        note: form.note,
        ...extra,
      });
      putCart(ctx.system, []);
      notifyDataChanged();
      haptic.success();
      onSold(r.saleId);
      return true;
    } catch (error) {
      setBusy(false);
      if (error instanceof ApprovalNeeded && !asking.current) {
        asking.current = true;
        askForDiscount(error).finally(() => {
          asking.current = false;
        });
        return;
      }
      // Nothing was sold: stock is checked again here (it may have changed since it was added).
      haptic.error();
      if (error instanceof CheckoutError && error.problems.some((p) => p.kind === 'price')) {
        const update = (keepUnsure: boolean) =>
          putCart(
            ctx.system,
            updatePrices(
              cart,
              (id) => getProduct(ctx, id),
              (id) => {
                const s = getSet(ctx, id);
                return s ? setForCart(ctx, s) : undefined;
              },
              { keepUnsure },
            ),
          );
        // A cart kept from before the update can't tell an agreed price from an old one: ask.
        const unsure = error.problems.some((p) => p.kind === 'price' && p.unsure);
        Alert.alert('تغيّرت الأسعار', error.message, [
          { text: 'رجوع', style: 'cancel' },
          ...(unsure ? [{ text: 'إبقاء السعر المتفق عليه', onPress: () => update(true) }] : []),
          { text: 'تحديث الأسعار', onPress: () => update(false) },
        ]);
        return;
      }
      Alert.alert(
        'لم يتم البيع',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُبَع أي شيء.',
      );
    }
  };

  const askForDiscount = async (e: ApprovalNeeded) => {
    haptic.medium();
    const policies = getPolicies(ctx);
    const reason = await chooseReason(
      `سبب الخصم (${formatLyd(e.discount.total)})`,
      policies.discountReasons,
    );
    if (!reason) return;
    const approval = await askOwner(
      ctx.system,
      'discount',
      `${discountMessage(e.discount, policies)}\nالسبب: ${reason}`,
    );
    if (!approval) return;
    sell({ discountReason: reason, approval });
  };

  const confirm = () => {
    const problem = checkoutProblem(form, cart);
    if (problem) {
      haptic.error();
      Alert.alert('لم يتم البيع', problem);
      return;
    }
    return sell();
  };

  const credit = form.method === 'credit';
  const use = creditUse(customerCredit, totals.total);
  return (
    <>
      <FormHeader title="إتمام البيع" onCancel={onCancel} onSave={confirmOnce} cancelLabel="رجوع" />
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
          {credit && !use ? (
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
          {use ? (
            <View style={{ gap: spacing.sm }} testID="checkout-credit">
              <Text variant="bodyStrong" tone="accent">
                {`له رصيد ${formatLyd(customerCredit)}`}
              </Text>
              {credit ? (
                <Text variant="caption" tone="secondary" testID="checkout-credit-use">
                  {use.owed > 0
                    ? `يُخصم رصيده كله (${formatLyd(use.used)}) ويبقى عليه ${formatLyd(use.owed)} ديناً.`
                    : `يُخصم ${formatLyd(use.used)} من رصيده، ويبقى له ${formatLyd(use.left)}.`}
                </Text>
              ) : (
                <Button
                  title="استخدام رصيده لهذا البيع"
                  icon="arrow.uturn.backward.circle"
                  variant="secondary"
                  fullWidth
                  onPress={() => set('method', 'credit')}
                  testID="checkout-use-credit"
                />
              )}
            </View>
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
          {discount.total > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="subhead" tone="secondary">
                الخصم
              </Text>
              <Text
                variant="subhead"
                tone={!isOwner && needsApproval(discount) ? 'warning' : 'secondary'}
                testID="checkout-discount">
                {`${formatLyd(discount.total)}${!isOwner && needsApproval(discount) ? ' • يحتاج موافقة المالك' : ''}`}
              </Text>
            </View>
          ) : null}
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
            onPress={confirmOnce}
            testID="checkout-confirm"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
