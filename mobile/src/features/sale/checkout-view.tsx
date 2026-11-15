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
  BirthdayApprovalNeeded,
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
import { orderCart, type Order } from '@/domain/orders';
import { askOwner, chooseReason } from '@/staff/approvals';
import { useActor, useCan } from '@/staff/use-can';
import { RuleError, type Ctx } from '@/domain/context';
import {
  customerByPhone,
  customerSuggestions,
  GENDER_LABELS,
  shownName,
  shownPhone,
  getCustomer,
  type Customer,
  type Gender,
  type SaleCustomerDetails,
} from '@/domain/customers';
import { balance } from '@/domain/debts';
import { getLoyalty, redeemable } from '@/domain/loyalty';
import { getRewards } from '@/domain/rewards';
import { rewardCart, rewardStatus } from '@/domain/visit-reward';
import { birthdayStatus, getBirthday, windowEnd } from '@/domain/birthday';
import {
  activeOffer,
  firstPurchase,
  friendOn,
  friendStatus,
  getMarketing,
} from '@/domain/marketing';
import {
  emptyGiftForm,
  GiftMemory,
  giftFromForm,
  ReferrerPicker,
  type GiftForm,
} from './checkout-extras';
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
  order,
  onCancel,
  onSold,
}: {
  ctx: Ctx;
  /**
   * Delivering this deposit order (I2): its own cart of the order's piece at the agreed price
   * (the shop's cart is left as it is), its customer, and the deposit off what is paid now.
   */
  order?: Order;
  onCancel: () => void;
  onSold: (saleId: number) => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const confirmOnce = () => once(confirm);
  const shared = useCart(ctx.system);
  const [own, setOwn] = useState(() => (order ? (orderCart(ctx, order) ?? []) : null));
  const cart = own ?? shared.cart;
  /** Changes the cart being checked out: the delivery's own, or the shop's. */
  const setLines = (lines: typeof cart) => (own ? setOwn(lines) : putCart(ctx.system, lines));
  const deposit = order?.paid ?? 0;
  const fullPhoneAtStart = useCan('customers.phones');
  const [form, setForm] = useState<CheckoutForm>(() =>
    order
      ? {
          ...emptyCheckoutForm(),
          name: order.customerName,
          phone: fullPhoneAtStart ? (order.customerPhone ?? '') : '',
        }
      : emptyCheckoutForm(),
  );
  const [busy, setBusy] = useState(false);
  const asking = useRef(false);
  const rate = getRate(ctx);
  const totals = cartTotals(cart, rate);
  const isOwner = useActor()?.kind === 'owner';
  const policies = getPolicies(ctx);
  // The order's piece sells at its agreed price: its list price here, so not a discount.
  const priceOf = (id: number) =>
    order && id === order.productId ? order.price / order.quantity : getProduct(ctx, id)?.price;
  const discount = cartDiscount(cart, priceOf, policies);
  /** The owner's quick discount buttons (feature 10), each with what it takes off this sale. */
  const quick = policies.quickDiscounts
    .map((percent) => ({ percent, ...percentOff(cart, priceOf, percent) }))
    .filter((q) => q.total > 0);
  const toggleQuick = (q: (typeof quick)[number]) => {
    haptic.tap();
    // A quick discount and the rewards are never used together.
    setUseReward(false);
    setUseBirthday(false);
    setFriendChosen(false);
    setOfferChosen(false);
    setLines(hasPercentOff(cart, priceOf, q.percent) ? listPrices(cart, priceOf) : q.cart);
  };
  const set = <K extends keyof CheckoutForm>(k: K, v: CheckoutForm[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const [picked, setPicked] = useState<Customer | null>(() =>
    order ? (getCustomer(ctx, order.customerId) ?? null) : null,
  );
  const [pointsText, setPointsText] = useState('');
  const [useReward, setUseReward] = useState(false);
  const [useBirthday, setUseBirthday] = useState(false);
  // Marketing (I4): the friend's first-purchase gift, a "we miss you" offer, gift memory.
  const [friendChosen, setFriendChosen] = useState(false);
  const [offerChosen, setOfferChosen] = useState(false);
  const [referrer, setReferrer] = useState<Customer | null>(null);
  const [giftForm, setGiftForm] = useState<GiftForm>(emptyGiftForm);
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
  const giftRules = useMemo(() => getBirthday(ctx), [ctx]);
  /** The birthday discount (H1): in the customer's birthday week. */
  const gift = useMemo(
    () => (customerId ? birthdayStatus(ctx, customerId, giftRules) : null),
    [ctx, customerId, giftRules],
  );
  const marketing = useMemo(() => getMarketing(ctx), [ctx]);
  const friends = useMemo(() => friendOn(ctx, marketing), [ctx, marketing]);
  const friend = useMemo(
    () => (customerId ? friendStatus(ctx, customerId, marketing) : null),
    [ctx, customerId, marketing],
  );
  /** A new customer may name who sent her (no purchase yet, nobody named before). */
  const asksReferrer =
    friends && !order && !friend && (!customerId || firstPurchase(ctx, customerId));
  const offer = useMemo(
    () => (customerId ? activeOffer(ctx, customerId) : undefined),
    [ctx, customerId],
  );
  /** What the shop owes this customer (له رصيد), which a sale on credit uses up. */
  const customerCredit = customer ? Math.max(0, -balance(ctx, customer.id)) : 0;

  if (cart.length === 0) {
    return (
      <>
        <Stack.Title>{order ? 'تسليم الطلب' : 'إتمام البيع'}</Stack.Title>
        <Stack.Toolbar placement="left">
          <Stack.Toolbar.Button onPress={onCancel}>رجوع</Stack.Toolbar.Button>
        </Stack.Toolbar>
        {order ? (
          <EmptyState icon="shippingbox" title="قطعة الطلب غير موجودة" />
        ) : (
          <EmptyState icon="cart" title="السلة فارغة" message="أضف قطعاً من شاشة البيع أولاً." />
        )}
      </>
    );
  }

  /** Sells; on a discount over the limits, asks the owner on the spot and sells again. */
  const sell = (
    extra: { discountReason?: string; approval?: string; birthdayApproval?: string } = {},
  ) => {
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
        customer: order
          ? {
              name: order.customerName,
              phone: order.customerPhone ?? undefined,
              area: form.area,
              details: saleDetails,
            }
          : {
              name: form.name || customer?.name,
              phone: form.phone || (customer?.phone ?? undefined),
              area: form.area,
              details: saleDetails,
            },
        orderId: order?.id,
        note: form.note,
        points: pointsUsed,
        reward: rewardOn,
        birthday: birthdayOn,
        friend: friendOnNow,
        offer: offerOnNow,
        referrerId: asksReferrer ? referrer?.id : undefined,
        gift: giftFromForm(giftForm) ?? undefined,
        ...extra,
      });
      if (!order) putCart(ctx.system, []);
      notifyDataChanged();
      haptic.success();
      onSold(r.saleId);
      return true;
    } catch (error) {
      setBusy(false);
      if (error instanceof BirthdayApprovalNeeded && !asking.current) {
        asking.current = true;
        haptic.medium();
        askOwner(ctx.system, 'birthday', error.message)
          .then((token) => {
            if (token) sell({ ...extra, birthdayApproval: token });
          })
          .finally(() => {
            asking.current = false;
          });
        return;
      }
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
          setLines(
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
    // A reward ready and not used: ask once (G2, H1). Not using the visit reward keeps it for the
    // next purchase; the birthday discount stays until the end of the birthday week.
    if (!rewardOn && !birthdayOn && (canReward || canBirthday)) {
      haptic.medium();
      Alert.alert(
        canReward && canBirthday
          ? 'لم يستخدم الزبون مكافأته؟'
          : canBirthday
            ? 'لم يستخدم الزبون خصم عيد الميلاد؟'
            : 'لم يستخدم الزبون المكافأة؟',
        [
          canReward ? 'تبقى مكافأة الزيارة محفوظة للشراء القادم.' : null,
          canBirthday && gift ? `يبقى خصم عيد الميلاد متاحاً حتى ${windowEnd(gift)}.` : null,
        ]
          .filter(Boolean)
          .join('\n'),
        [
          ...(canBirthday
            ? [{ text: `استخدام خصم عيد الميلاد ${giftRules.percent}%`, onPress: turnOnBirthday }]
            : []),
          ...(canReward
            ? [{ text: `استخدام مكافأة الزيارة ${rewards.percent}%`, onPress: turnOnReward }]
            : []),
          { text: 'البيع بدونها', onPress: () => sell() },
        ],
      );
      return;
    }
    return sell();
  };

  const credit = form.method === 'credit';
  const use = creditUse(customerCredit, totals.total - deposit);
  /** Loyalty points (F3): what this customer may pay with on this sale (cash or card only). */
  // The visit reward (G2) comes off first; points then pay at most their share of what is left.
  const canReward = !!reward?.ready && totals.total >= rewards.minRewardSale;
  // A price changed after a reward was chosen (a discount) switches it off: never together.
  const rewardOn = useReward && canReward && discount.total === 0;
  const rewardOff = rewardOn ? rewardCart(cart, rewards).off : 0;
  const canBirthday = !!gift && !gift.used && totals.total >= giftRules.minSale;
  const birthdayOn = useBirthday && canBirthday && !rewardOn && discount.total === 0;
  const birthdayOff = birthdayOn ? rewardCart(cart, giftRules).off : 0;
  // Bring a friend (I4): her first purchase, once someone is named as who sent her.
  const friendRules = { percent: marketing.friendPercent, maxOff: Number.MAX_SAFE_INTEGER };
  const canFriend = !order && (!!friend?.ready || (asksReferrer && !!referrer));
  const friendOnNow = friendChosen && canFriend && !rewardOn && !birthdayOn && discount.total === 0;
  const friendOff = friendOnNow ? rewardCart(cart, friendRules).off : 0;
  // We miss you (I4): the owner's offer, with its cap.
  const offerRules = offer ? { percent: offer.percent, maxOff: offer.cap } : null;
  const offerOnNow =
    offerChosen && !!offerRules && !rewardOn && !birthdayOn && !friendOnNow && discount.total === 0;
  const offerOff = offerOnNow && offerRules ? rewardCart(cart, offerRules).off : 0;
  const afterReward = totals.total - rewardOff - birthdayOff - friendOff - offerOff;
  // Points pay only what is left after the deposit.
  const points =
    !credit && customer ? redeemable(ctx, customer.id, afterReward - deposit, loyalty) : null;
  const pointsUsed = points ? typedPoints(pointsText, points.points) : 0;
  const pointsPaid = pointsUsed * loyalty.pointValue;
  const toPay = afterReward - pointsPaid - deposit;
  /**
   * Rewards are never used with another discount (the owner's rule, H1): turning one on when a
   * price is below the list price asks to put the list prices back first.
   */
  function withListPrices(what: string, turnOn: () => void) {
    if (discount.total <= 0) return turnOn();
    const quickOnly = policies.quickDiscounts.some((p) => hasPercentOff(cart, priceOf, p));
    if (quickOnly) {
      setLines(listPrices(cart, priceOf));
      return turnOn();
    }
    haptic.medium();
    Alert.alert(
      `${what} لا يُجمع مع خصم آخر`,
      `في السلة خصم ${formatLyd(discount.total)} (سعر أقل من سعر القطعة). أرجع الأسعار الأصلية لاستخدامه؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'رجوع للسعر الأصلي واستخدامه',
          onPress: () => {
            setLines(listPrices(cart, priceOf));
            turnOn();
          },
        },
      ],
    );
  }
  /** One reward a purchase: turning one on turns the others off. */
  function only(which: 'reward' | 'birthday' | 'friend' | 'offer') {
    setUseReward(which === 'reward');
    setUseBirthday(which === 'birthday');
    setFriendChosen(which === 'friend');
    setOfferChosen(which === 'offer');
  }
  function turnOnReward() {
    withListPrices('مكافأة الزيارة', () => only('reward'));
  }
  function turnOnBirthday() {
    withListPrices('خصم عيد الميلاد', () => only('birthday'));
  }
  const toggleFriend = () => {
    haptic.tap();
    if (friendOnNow) return setFriendChosen(false);
    withListPrices('هدية الصديقة', () => only('friend'));
  };
  const toggleOffer = () => {
    haptic.tap();
    if (offerOnNow) return setOfferChosen(false);
    withListPrices('عرض «نفتقدك»', () => only('offer'));
  };
  const toggleReward = () => {
    haptic.tap();
    if (rewardOn) return setUseReward(false);
    turnOnReward();
  };
  const toggleBirthday = () => {
    haptic.tap();
    if (birthdayOn) return setUseBirthday(false);
    turnOnBirthday();
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
      <FormHeader
        title={
          order
            ? `تسليم ${order.kind === 'hold' ? 'الحجز' : 'الطلب'} رقم ${order.id}`
            : 'إتمام البيع'
        }
        onCancel={onCancel}
        onSave={confirmOnce}
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
          {credit && !use ? (
            <Text variant="caption" tone="warning">
              البيع الآجل يُسجَّل ديناً على الزبون: اكتب اسمه أو رقم هاتفه.
            </Text>
          ) : null}
        </Card>

        {order ? (
          <Card testID="checkout-order">
            <Text variant="subhead" tone="secondary">
              {`${order.kind === 'hold' ? 'الحجز' : 'الطلب'} رقم ${order.id} لـ`}
            </Text>
            {customer ? (
              <CustomerCard ctx={ctx} customer={customer} testID="checkout-known" />
            ) : (
              <Text variant="headline">{shownName(order.customerName, fullPhone)}</Text>
            )}
            {use ? (
              <Text variant="bodyStrong" tone="accent" testID="checkout-credit">
                {`له رصيد ${formatLyd(customerCredit)}${credit ? ` • يُخصم منه ${formatLyd(use.used)}` : ''}`}
              </Text>
            ) : null}
          </Card>
        ) : (
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
            {asksReferrer ? (
              <ReferrerPicker
                ctx={ctx}
                exclude={customerId}
                value={referrer}
                onChange={(c) => {
                  setReferrer(c);
                  if (!c) setFriendChosen(false);
                }}
                fullNames={fullPhone}
              />
            ) : null}
            <GiftMemory value={giftForm} onChange={setGiftForm} />
            <Text variant="caption" tone="secondary">
              يُبحث عن الزبون برقم الهاتف أولاً ثم بالاسم، ويُضاف تلقائياً إن كان جديداً.
            </Text>
          </Card>
        )}

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
          {canBirthday ? (
            <FilterChip
              label={`${birthdayOn ? '✓ ' : ''}🎂 خصم عيد الميلاد ${giftRules.percent}% • ${formatLyd(rewardCart(cart, giftRules).off)}${gift?.needsOwner && !isOwner ? ' • يحتاج موافقة المالك' : ''}`}
              selected={birthdayOn}
              onPress={toggleBirthday}
              testID="checkout-birthday"
            />
          ) : gift && !gift.used ? (
            <Text variant="caption" tone="secondary" testID="checkout-birthday-waits">
              {`خصم عيد الميلاد لشراء من ${formatLyd(giftRules.minSale)} أو أكثر، حتى ${windowEnd(gift)}.`}
            </Text>
          ) : gift?.used ? (
            <Text variant="caption" tone="secondary" testID="checkout-birthday-used">
              استُخدم خصم عيد الميلاد لهذا الزبون هذه السنة.
            </Text>
          ) : null}
          {canFriend ? (
            <FilterChip
              label={`${friendOnNow ? '✓ ' : ''}🤍 هدية الصديقة ${marketing.friendPercent}% • ${formatLyd(rewardCart(cart, friendRules).off)}`}
              selected={friendOnNow}
              onPress={toggleFriend}
              testID="checkout-friend"
            />
          ) : null}
          {offerRules ? (
            <FilterChip
              label={`${offerOnNow ? '✓ ' : ''}عرض «نفتقدك» ${offerRules.percent}% • ${formatLyd(rewardCart(cart, offerRules).off)}`}
              selected={offerOnNow}
              onPress={toggleOffer}
              testID="checkout-offer"
            />
          ) : null}
          {friendOff > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="subhead" tone="accent">
                هدية الصديقة
              </Text>
              <Text variant="subhead" tone="accent" testID="checkout-friend-off">
                {`− ${formatLyd(friendOff)}`}
              </Text>
            </View>
          ) : null}
          {offerOff > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="subhead" tone="accent">
                عرض «نفتقدك»
              </Text>
              <Text variant="subhead" tone="accent" testID="checkout-offer-off">
                {`− ${formatLyd(offerOff)}`}
              </Text>
            </View>
          ) : null}
          {birthdayOff > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="subhead" tone="accent">
                خصم عيد الميلاد
              </Text>
              <Text variant="subhead" tone="accent" testID="checkout-birthday-off">
                {`− ${formatLyd(birthdayOff)}`}
              </Text>
            </View>
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
          {deposit > 0 ? (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="subhead" tone="accent">
                العربون المدفوع
              </Text>
              <Text variant="subhead" tone="accent" testID="checkout-deposit">
                {`− ${formatLyd(deposit)}`}
              </Text>
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
            title={`${order ? 'تأكيد التسليم' : 'تأكيد البيع'} • ${formatLyd(Math.max(0, toPay))}`}
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
