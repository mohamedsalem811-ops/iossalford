import { useState } from 'react';
import { Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  EmptyState,
  FormHeader,
  KEYBOARD_GAP,
  NumberField,
  Segmented,
  Text,
  TextField,
  useSheetBottomSpace,
} from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import { getOrder, markPurchased, setEta } from '@/domain/orders';
import { getRate } from '@/domain/settings';
import { parseHundredths, parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { formatLyd, formatRate, usdToLyd } from '@/lib/money';
import { useSaveOnce } from '@/hooks/use-save-once';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

/** "2026-12-01" a week from today, as a starting point for the date. */
const inAWeek = (now: Date) => {
  const d = new Date(now);
  d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/**
 * The owner's step (I2): "تم الشراء من المورد" with the cost (dinars or dollars at today's rate)
 * and the expected arrival date; or, once bought, a new expected date only.
 */
export function OrderBuyView({
  ctx,
  orderId,
  onCancel,
  onDone,
}: {
  ctx: Ctx;
  orderId: number;
  onCancel: () => void;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const bottomSpace = useSheetBottomSpace();
  const [order] = useState(() => getOrder(ctx, orderId));
  const rate = getRate(ctx);
  const [currency, setCurrency] = useState<'usd' | 'lyd'>('usd');
  const [cost, setCost] = useState('');
  const [eta, setEtaText] = useState(() => order?.eta ?? inAWeek(ctx.now()));
  if (!order) return <EmptyState icon="shippingbox" title="الطلب غير موجود" />;
  const dateOnly = order.status === 'purchased';
  if (!dateOnly && order.status !== 'waiting')
    return <EmptyState icon="shippingbox" title="هذا الطلب ليس بانتظار الشراء" />;

  const usd = currency === 'usd' ? parseHundredths(cost) : null;
  const lyd =
    currency === 'lyd' ? parseThousandths(cost) : usd !== null ? usdToLyd(usd, rate) : null;

  const save = () => {
    try {
      if (dateOnly) setEta(ctx, orderId, eta);
      else {
        if (lyd === null) {
          haptic.error();
          Alert.alert('لم يُحفظ', 'اكتب تكلفة القطعة');
          return;
        }
        markPurchased(
          ctx,
          orderId,
          currency === 'usd' ? { costUsd: usd, eta } : { cost: lyd, eta },
        );
      }
      haptic.success();
      notifyDataChanged();
      onDone();
      return true;
    } catch (error) {
      haptic.error();
      Alert.alert(
        'لم يُحفظ',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ شيء.',
      );
    }
  };
  const saveOnce = () => once(save);

  return (
    <>
      <FormHeader
        title={dateOnly ? 'موعد الوصول' : 'تم الشراء من المورد'}
        onCancel={onCancel}
        onSave={saveOnce}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="headline">{order.description}</Text>
          <Text variant="subhead" tone="secondary">
            {`${order.customerName} • ${formatLyd(order.price)}`}
          </Text>
          {dateOnly ? null : (
            <>
              <Segmented<'usd' | 'lyd'>
                options={[
                  { value: 'usd', label: 'بالدولار' },
                  { value: 'lyd', label: 'بالدينار' },
                ]}
                value={currency}
                onChange={setCurrency}
                testID="order-buy-currency"
              />
              <NumberField
                label="تكلفة القطعة كلها"
                value={cost}
                onChangeText={setCost}
                suffix={currency === 'usd' ? '$' : 'د.ل'}
                testID="order-buy-cost"
              />
              {currency === 'usd' && lyd !== null ? (
                <Text variant="caption" tone="secondary">
                  {`≈ ${formatLyd(lyd)} بسعر ${formatRate(rate)}`}
                </Text>
              ) : null}
            </>
          )}
          <TextField
            label="تاريخ الوصول المتوقع"
            value={eta}
            onChangeText={setEtaText}
            placeholder="2026-12-01"
            keyboardType="numbers-and-punctuation"
            testID="order-buy-eta"
          />
          <Text variant="caption" tone="secondary">
            {dateOnly
              ? 'يراه الموظفون في صفحة الطلب، ويمكن إرساله للزبون برسالة واتساب.'
              : 'بعد الشراء لا يُسترد العربون. يراه الموظفون، ويمكن إرسال الموعد للزبون برسالة واتساب.'}
          </Text>
          <Button
            title={dateOnly ? 'حفظ الموعد' : 'تم الشراء'}
            icon="checkmark.circle.fill"
            fullWidth
            onPress={saveOnce}
            testID="order-buy-save"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
