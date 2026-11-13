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
import { cartTotal } from '@/domain/cart';
import {
  ApprovalNeeded,
  discountMessage,
  PAYMENT_LABELS,
  type PaymentMethod,
} from '@/domain/checkout';
import { differenceText, exchange } from '@/domain/exchange';
import { getPolicies } from '@/domain/policies';
import {
  addReturn,
  addReturnWithoutSale,
  getSaleLine,
  hoursSince,
  soldAtOfLine,
  maxRefund,
  ReturnRefused,
  type ReturnInput,
} from '@/domain/sales';
import { PhotoPicker } from '@/features/products/photo-picker';
import { putCart, useCart } from '@/state/cart';
import { askOwner, chooseReason } from '@/staff/approvals';
import { useActor } from '@/staff/use-can';
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
  const [photo, setPhoto] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, boolean>>({});
  const [swap, setSwap] = useState(false);
  const [swapMethod, setSwapMethod] = useState<PaymentMethod>('cash');
  const [policies] = useState(() => getPolicies(ctx));
  const [soldAt] = useState(() => (saleLineId ? soldAtOfLine(ctx, saleLineId) : undefined));
  const owner = useActor()?.kind === 'owner';
  const { cart } = useCart(ctx.system);
  const swapTotal = cartTotal(cart);

  if (saleLineId && !line) return <EmptyState icon="cart" title="البيعة غير موجودة" />;
  const left = line ? returnable(line) : Number.MAX_SAFE_INTEGER;
  if (line && left === 0)
    return <EmptyState icon="arrow.uturn.backward" title="كل قطع هذه البيعة مُرتجعة بالفعل" />;

  /** Saves the return (or the exchange); on a refusal by the rules, asks the owner. */
  const commit = (
    override?: ReturnInput['override'],
    discount?: { discountReason: string; approval: string },
  ) => {
    const check = checkReturn(line ?? null, quantity, owner ? refund : '');
    if (!check.ok) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', check.message);
      return;
    }
    try {
      if (line) {
        const input: ReturnInput = {
          saleLineId: line.id,
          quantity,
          refund: check.refund,
          reason,
          photo: photo ?? undefined,
          answers,
          override,
        };
        if (swap && cart.length) {
          const r = exchange(ctx, {
            ret: input,
            sale: { cart, paymentMethod: swapMethod, ...discount },
          });
          putCart(ctx.system, []);
          Alert.alert('تم الاستبدال', differenceText(r.difference));
        } else addReturn(ctx, input);
      } else
        addReturnWithoutSale(ctx, {
          productId: product!.id,
          quantity,
          refund: check.refund!,
          reason,
          photo: photo ?? undefined,
        });
    } catch (error) {
      if (error instanceof ReturnRefused && !override) {
        haptic.error();
        askToOverride(error);
        return;
      }
      // The new piece of an exchange has a discount over the limits: the owner, on the spot.
      if (error instanceof ApprovalNeeded && !discount) {
        askForDiscount(error, override);
        return;
      }
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    onDone();
    return true;
  };

  /** Past the rules: the owner allows it with a reason (signed in, or on the spot). */
  const askToOverride = (e: ReturnRefused) =>
    Alert.alert('المرتجع مرفوض', e.problems.join('\n'), [
      { text: 'إغلاق', style: 'cancel' },
      {
        text: owner ? 'السماح به' : 'موافقة المالك',
        onPress: async () => {
          const why = await chooseReason('سبب السماح بالمرتجع', [
            'زبون دائم',
            'عيب من المصنع',
            'خطأ في البيع',
          ]);
          if (!why) return;
          if (owner) return commit({ reason: why });
          const approval = await askOwner(
            ctx.system,
            'return',
            `مرتجع «${line?.name ?? ''}»: ${e.problems.join(' ')}\nالسبب: ${why}`,
          );
          if (approval) commit({ reason: why, approval });
        },
      },
    ]);

  const askForDiscount = async (e: ApprovalNeeded, override?: ReturnInput['override']) => {
    const why = await chooseReason(
      `سبب الخصم (${formatLyd(e.discount.total)})`,
      policies.discountReasons,
    );
    if (!why) return;
    const approval = await askOwner(
      ctx.system,
      'discount',
      `${discountMessage(e.discount, policies)}\nالسبب: ${why}`,
    );
    if (approval) commit(override, { discountReason: why, approval });
  };

  const save = () => {
    if (!line && !product) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'اختر القطعة المرتجعة');
      return;
    }
    if (!photo) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'صوّر القطعة المرتجعة قبل الحفظ.');
      return;
    }
    return commit();
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
          {owner || !line ? (
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
          ) : (
            <Text variant="headline" testID="return-refund-fixed">
              {`يُعاد للزبون ${formatLyd(maxRefund(line, quantity))}: ما دفعه`}
            </Text>
          )}
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
        </Card>

        {line ? (
          <Card testID="return-conditions">
            <Text variant="subhead" tone="secondary">
              {soldAt
                ? `الشروط • بيعت قبل ${Math.max(0, Math.floor(hoursSince(soldAt, ctx.now())))} ساعة، المدة ${policies.returnHours} ساعة`
                : 'الشروط'}
            </Text>
            {policies.returnConditions.map((c, i) => (
              <View key={c} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="body" style={{ flex: 1 }}>
                  {c}
                </Text>
                <FilterChip
                  label="نعم"
                  selected={answers[c] === true}
                  onPress={() => setAnswers((a) => ({ ...a, [c]: true }))}
                  testID={`cond-yes-${i}`}
                />
                <FilterChip
                  label="لا"
                  selected={answers[c] === false}
                  onPress={() => setAnswers((a) => ({ ...a, [c]: false }))}
                  testID={`cond-no-${i}`}
                />
              </View>
            ))}
          </Card>
        ) : null}

        <Card testID="return-photo">
          <Text variant="subhead" tone="secondary">
            صورة القطعة المرتجعة (مطلوبة)
          </Text>
          <PhotoPicker
            ctx={ctx}
            imageFile={photo}
            onPicked={setPhoto}
            onRemove={() => setPhoto(null)}
            placeholder="صوّر القطعة كما أعادها الزبون"
          />
        </Card>

        {line && cart.length ? (
          <Card testID="return-exchange">
            <FilterChip
              label={`استبدال بما في السلة: ${cart.length} قطعة بـ ${formatLyd(swapTotal)}`}
              selected={swap}
              onPress={() => setSwap((v) => !v)}
              testID="return-swap"
            />
            {swap ? (
              <>
                <Text variant="subhead" testID="return-difference">
                  {differenceText(swapTotal - maxRefund(line, quantity))}
                </Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  {(['cash', 'card', 'transfer'] as const).map((m) => (
                    <FilterChip
                      key={m}
                      label={PAYMENT_LABELS[m]}
                      selected={swapMethod === m}
                      onPress={() => setSwapMethod(m)}
                    />
                  ))}
                </View>
              </>
            ) : null}
          </Card>
        ) : null}

        <Card>
          <Text variant="caption" tone="secondary">
            تعود القطع إلى المخزون عند الحفظ.
          </Text>
          <Button
            title={swap && cart.length ? 'حفظ الاستبدال' : 'حفظ المرتجع'}
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
