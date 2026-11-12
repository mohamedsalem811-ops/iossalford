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
import type { Ctx } from '@/domain/context';
import { getCustomer } from '@/domain/customers';
import { balance, recordPayment } from '@/domain/debts';
import { showError } from '@/features/products/actions';
import { editableDinars, formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { checkPayment, PAYMENT_WAYS, type PaymentWay } from './model';
import { haptic } from '@/lib/haptics';
import { useSaveOnce } from '@/hooks/use-save-once';

/** Money received from a customer towards what they owe; it starts at the whole balance. */
export function PaymentForm({
  ctx,
  customerId,
  onDone,
}: {
  ctx: Ctx;
  customerId: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const saveOnce = () => once(save);
  const bottomSpace = useSheetBottomSpace();
  const [customer] = useState(() => getCustomer(ctx, customerId));
  const [owed] = useState(() => balance(ctx, customerId));
  const [amount, setAmount] = useState(() => (owed > 0 ? editableDinars(owed) : ''));
  const [way, setWay] = useState<PaymentWay>('cash');
  const [note, setNote] = useState('');

  if (!customer) return <EmptyState icon="person" title="الزبون غير موجود" />;
  if (owed <= 0) return <EmptyState icon="checkmark.seal" title="لا يوجد مبلغ مستحق" />;

  const save = () => {
    const check = checkPayment(amount, owed);
    if (!check.ok) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', check.message);
      return;
    }
    try {
      recordPayment(ctx, { customerId, amount: check.amount, method: way, note });
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    onDone();
    return true;
  };

  return (
    <>
      <FormHeader title="تسجيل دفعة" onCancel={onDone} onSave={saveOnce} />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="headline">{customer.name}</Text>
          <Text variant="subhead" tone="warning">{`عليه ${formatLyd(owed)}`}</Text>
          <NumberField
            label="المبلغ المستلم"
            value={amount}
            onChangeText={setAmount}
            suffix="د.ل"
            testID="payment-amount"
          />
          <Segmented
            options={PAYMENT_WAYS.map((w) => ({ value: w.value, label: w.label }))}
            value={way}
            onChange={setWay}
            testID="payment-way"
          />
          <TextField label="ملاحظة" value={note} onChangeText={setNote} placeholder="اختياري" />
          <Button
            title="حفظ الدفعة"
            icon="checkmark.circle.fill"
            fullWidth
            onPress={saveOnce}
            testID="payment-save"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
