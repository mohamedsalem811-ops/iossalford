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
  useSheetBottomSpace,
} from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import { addOrderPayment, getOrder, OPEN_STATUSES, type DepositMethod } from '@/domain/orders';
import { PAYMENT_WAYS } from '@/features/customers/model';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars, formatLyd } from '@/lib/money';
import { useSaveOnce } from '@/hooks/use-save-once';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

/** Another payment towards an order before delivery; it has its own deposit receipt. */
export function OrderPayView({
  ctx,
  orderId,
  onCancel,
  onDone,
}: {
  ctx: Ctx;
  orderId: number;
  onCancel: () => void;
  onDone: (receiptId: number) => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const bottomSpace = useSheetBottomSpace();
  const [order] = useState(() => getOrder(ctx, orderId));
  const [amount, setAmount] = useState(() =>
    order && order.remaining > 0 ? editableDinars(order.remaining) : '',
  );
  const [method, setMethod] = useState<DepositMethod>('cash');
  if (!order || !OPEN_STATUSES.includes(order.status))
    return <EmptyState icon="shippingbox" title="الطلب مُغلق" />;
  if (order.remaining <= 0) return <EmptyState icon="checkmark.seal" title="مدفوع بالكامل" />;

  const save = () => {
    const value = parseThousandths(amount);
    if (!value || value <= 0) {
      haptic.error();
      Alert.alert('لم تُحفظ الدفعة', 'اكتب مبلغ الدفعة');
      return;
    }
    try {
      const receipt = addOrderPayment(ctx, orderId, { amount: value, method });
      haptic.success();
      notifyDataChanged();
      onDone(receipt.id);
      return true;
    } catch (error) {
      haptic.error();
      Alert.alert(
        'لم تُحفظ الدفعة',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ شيء.',
      );
    }
  };
  const saveOnce = () => once(save);

  return (
    <>
      <FormHeader title="دفعة على الطلب" onCancel={onCancel} onSave={saveOnce} />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="headline">{order.description}</Text>
          <Text variant="subhead" tone="secondary">
            {`مدفوع ${formatLyd(order.paid)} من ${formatLyd(order.price)} • الباقي ${formatLyd(order.remaining)}`}
          </Text>
          <NumberField
            label="المبلغ"
            value={amount}
            onChangeText={setAmount}
            suffix="د.ل"
            testID="order-pay-amount"
          />
          <Segmented
            options={PAYMENT_WAYS.map((w) => ({ value: w.value, label: w.label }))}
            value={method}
            onChange={setMethod}
            testID="order-pay-method"
          />
          <Button
            title="حفظ الدفعة"
            icon="checkmark.circle.fill"
            fullWidth
            onPress={saveOnce}
            testID="order-pay-save"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
