import { Stack } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
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
import {
  cartDiscount,
  hasPercentOff,
  listPrices,
  needsApproval,
  percentOff,
  updatePrices,
} from '@/domain/cart';
import { getSet, setForCart } from '@/domain/sets';
import { getPolicies } from '@/domain/policies';
import { getProduct } from '@/domain/products';
import { askOwner, chooseReason } from '@/staff/approvals';
import { useActor, useCan } from '@/staff/use-can';
import { RuleError, type Ctx } from '@/domain/context';
import {
  customerByPhone,
  customerSuggestions,
  GENDER_LABELS,
  shownName,
  shownPhone,
  type Customer,
  type Gender,
  type SaleCustomerDetails,
} from '@/domain/customers';
import { balance } from '@/domain/debts';
import { getLoyalty, redeemable } from '@/domain/loyalty';
import { getRewards } from '@/domain/rewards';
import { rewardCart, rewardStatus } from '@/domain/visit-reward';
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
  pointsForShare,
  typedPoints,
  type CheckoutForm,
} from './model';
import { CustomerCard } from '@/features/customers/customer-card';
import { DetailsFields } from '@/features/customers/details-fields';
import {
  detailsFromForm,
  detailsTouched,
  emptyDetailsForm,
  type DetailsForm,
} from '@/features/customers/model';
import { useSaveOnce } from '@/hooks/use-save-once';
import { haptic } from '@/lib/haptics';

const GENDERS: Gender[] = ['female', 'male'];

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
  const policies = getPolicies(ctx);
  const priceOf = (id: number) => getProduct(ctx, id)?.price;
  const discount = cartDiscount(cart, priceOf, policies);
  /** The owner's quick discount buttons (feature 10), each with what it takes off this sale. */
  const quick = policies.quickDiscounts
    .map((percent) => ({ percent, ...percentOff(cart, priceOf, percent) }))
    .filter((q) => q.total > 0);
  const toggleQuick = (q: (typeof quick)[number]) => {
    haptic.tap();
    // A quick discount and the visit reward are never used together.
    setUseReward(false);
    putCart(
      ctx.system,
      hasPercentOff(cart, priceOf, q.percent) ? listPrices(cart, priceOf) : q.cart,
    );
  };
  const set = <K extends keyof CheckoutForm>(k: K, v: CheckoutForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [picked, setPicked] = useState<Customer | null>(null);
  const [pointsText, setPointsText] = useState('');
  const [useReward, setUseReward] = useState(false);
  const [gender, setGender] = useState<Gender | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [details, setDetails] = useState<DetailsForm>(emptyDetailsForm);
  const [customerNotes, setCustomerNotes] = useState('');
  const known = form.phone ? customerByPhone(ctx, form.phone) : undefined;
  const fullPhone = useCan('customers.phones');
  const suggestions = form.name && !known ? customerSuggestions(ctx, form.name, 4, fullPhone) : [];
  /** Someone who may not see the numbers picks a customer without the phone filling in. */
  const pick = (c: Customer) => {
    setPicked(c);
    setForm((f) => ({
      ...f,
      name: c.name,
      phone: fullPhone ? (c.phone ?? f.phone) : f.phone,
      area: c.area ?? f.area,
    }));
  };
  /** The registered customer this sale goes to: by phone, or the one picked by name. */
  const customer = known ?? (picked && picked.name === form.name ? picked : undefined);
  const customerId = customer?.id;
  const rewards = useMemo(() => getRewards(ctx), [ctx]);
  const loyalty = useMemo(() => getLoyalty(ctx), [ctx]);
  const reward = useMemo(
    () => (customerId ? rewardStatus(ctx, customerId, rewards) : null),
    [ctx, customerId, rewards],
  );
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
    const checked = detailsFromForm(details);
    if (!checked.ok) {
      haptic.error();
      setShowDetails(true);
      Alert.alert('لم يتم البيع', checked.message);
      return;
    }
    const saleDetails: SaleCustomerDetails = {
      ...(detailsTouched(details) ? checked.details : {}),
      gender: gender ?? undefined,
      notes: customerNotes || undefined,
    };
    setBusy(true);
    try {
      const r = checkout(ctx, {
        cart,
        paymentMethod: form.method,
        customer: {
          name: form.name || customer?.name,
          phone: form.phone || (customer?.phone ?? undefined),
          area: form.area,
          details: saleDetails,
        },
        note: form.note,
        points: pointsUsed,
        reward: rewardOn,
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
    // A reward ready and not used: ask, and keep it for the next purchase if not (G2).
    if (canReward && !rewardOn) {
      haptic.medium();
      Alert.alert('لم يستخدم الزبون المكافأة؟', 'تبقى المكافأة محفوظة للشراء القادم.', [
        { text: 'استخدامها الآن', onPress: () => setUseReward(true) },
        { text: 'إبقاؤها للمرة القادمة', onPress: () => sell() },
      ]);
      return;
    }
    return sell();
  };

  const credit = form.method === 'credit';
  const use = creditUse(customerCredit, totals.total);
  /** Loyalty points (F3): what this customer may pay with on this sale (cash or card only). */
  // The visit reward (G2) comes off first; points then pay at most their share of what is left.
  const canReward = !!reward?.ready && totals.total >= rewards.minRewardSale;
  const rewardOn = useReward && canReward;
  const rewardOff = rewardOn ? rewardCart(cart, rewards).off : 0;
  const afterReward = totals.total - rewardOff;
  const points = !credit && customer ? redeemable(ctx, customer.id, afterReward, loyalty) : null;
  const pointsUsed = points ? typedPoints(pointsText, points.points) : 0;
  const pointsPaid = pointsUsed * loyalty.pointValue;
  const toPay = afterReward - pointsPaid;
  const toggleReward = () => {
    haptic.tap();
    if (!useReward && policies.quickDiscounts.some((p) => hasPercentOff(cart, priceOf, p)))
      putCart(ctx.system, listPrices(cart, priceOf));
    setUseReward((u) => !u);
  };
  const setShare = (percent: number | 'max') => {
    if (!points) return;
    haptic.tap();
    const n =
      percent === 'max'
        ? points.points
        : pointsForShare(afterReward, percent, loyalty.pointValue, points.points);
    setPointsText(n > 0 ? String(n) : '');
  };
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
          {customer ? (
            <CustomerCard
              ctx={ctx}
              customer={customer}
              testID={known ? 'checkout-known' : 'checkout-picked'}
            />
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
                  label={
                    c.phone
                      ? `${shownName(c.name, fullPhone)} • ${shownPhone(c.phone, fullPhone)}`
                      : shownName(c.name, fullPhone)
                  }
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
          {!customer?.gender ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {GENDERS.map((g) => (
                <FilterChip
                  key={g}
                  label={GENDER_LABELS[g]}
                  selected={gender === g}
                  onPress={() => {
                    haptic.tap();
                    setGender((x) => (x === g ? null : g));
                  }}
                  testID={`checkout-gender-${g}`}
                />
              ))}
            </View>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: showDetails }}
            hitSlop={8}
            onPress={() => {
              haptic.tap();
              setShowDetails((v) => !v);
            }}
            testID="checkout-details-toggle">
            <Text variant="subhead" tone="accent">
              {showDetails ? 'إخفاء التفاصيل الإضافية' : 'تفاصيل إضافية (اختياري)'}
            </Text>
          </Pressable>
          {showDetails ? (
            <View style={{ gap: spacing.ms }}>
              <DetailsFields
                system={ctx.system}
                value={details}
                onChange={setDetails}
                testID="checkout-details"
              />
              <TextField
                label="ملاحظات عن الزبون"
                value={customerNotes}
                onChangeText={setCustomerNotes}
                placeholder="اختياري"
                testID="checkout-customer-notes"
              />
              {customer ? (
                <Text variant="caption" tone="secondary">
                  تُضاف فقط إلى ما ليس محفوظاً للزبون؛ التعديل من صفحة الزبون.
                </Text>
              ) : null}
            </View>
          ) : null}
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
          {quick.length > 0 ? (
            <View
              style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}
              testID="checkout-quick">
              {quick.map((q) => (
                <FilterChip
                  key={q.percent}
                  label={`خصم ${q.percent}% • ${formatLyd(q.total)}`}
                  selected={hasPercentOff(cart, priceOf, q.percent)}
                  onPress={() => toggleQuick(q)}
                  testID={`checkout-quick-${q.percent}`}
                />
              ))}
            </View>
          ) : null}
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
          {canReward ? (
            <FilterChip
              label={`${rewardOn ? '✓ ' : ''}تطبيق مكافأة ${rewards.percent}% • ${formatLyd(rewardCart(cart, rewards).off)}`}
              selected={rewardOn}
              onPress={toggleReward}
              testID="checkout-reward"
            />
          ) : reward?.ready ? (
            <Text variant="caption" tone="secondary" testID="checkout-reward-waits">
              {`مكافأة ${rewards.percent}% جاهزة لبيعة من ${formatLyd(rewards.minRewardSale)} أو أكثر.`}
            </Text>
          ) : null}
          {rewardOff > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="subhead" tone="accent">
                مكافأة الزيارة
              </Text>
              <Text variant="subhead" tone="accent" testID="checkout-reward-off">
                {`− ${formatLyd(rewardOff)}`}
              </Text>
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="headline">المجموع</Text>
            <Text variant="title" tone="accent" testID="checkout-total">
              {formatLyd(afterReward)}
            </Text>
          </View>
          {points ? (
            <View style={{ gap: spacing.sm }} testID="checkout-points">
              <NumberField
                label={`الدفع بالنقاط (حتى ${points.points} من ${points.balance} نقطة • ${formatLyd(points.value)})`}
                kind="integer"
                value={pointsText}
                onChangeText={setPointsText}
                placeholder="0"
                suffix="نقطة"
                testID="checkout-points-field"
              />
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                {([20, 30, 'max'] as const).map((p) => (
                  <FilterChip
                    key={p}
                    label={p === 'max' ? 'الأقصى' : `${p}%`}
                    selected={
                      pointsUsed > 0 &&
                      pointsUsed ===
                        (p === 'max'
                          ? points.points
                          : pointsForShare(afterReward, p, loyalty.pointValue, points.points))
                    }
                    onPress={() => setShare(p)}
                    testID={`checkout-points-${p}`}
                  />
                ))}
              </View>
            </View>
          ) : null}
          {pointsPaid > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="subhead" tone="secondary">
                مدفوع بالنقاط
              </Text>
              <Text variant="subhead" tone="secondary" testID="checkout-points-paid">
                {`− ${formatLyd(pointsPaid)}`}
              </Text>
            </View>
          ) : null}
          <Button
            title={`تأكيد البيع • ${formatLyd(toPay)}`}
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
