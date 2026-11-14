import { useState } from 'react';
import { Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  FormHeader,
  KEYBOARD_GAP,
  NumberField,
  Text,
  TextField,
  useSheetBottomSpace,
} from '@/components';
import type { Ctx } from '@/domain/context';
import { getCustomer, maskPhone, saveCustomer } from '@/domain/customers';
import { useCan } from '@/staff/use-can';
import { showError } from '@/features/products/actions';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { customerFormFrom, customerFormToInput, type CustomerForm } from './model';
import { haptic } from '@/lib/haptics';
import { useSaveOnce } from '@/hooks/use-save-once';

/** Adds or edits a customer. A phone number already used by another customer is refused. */
export function CustomerFormView({
  ctx,
  customerId,
  onDone,
}: {
  ctx: Ctx;
  customerId?: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const once = useSaveOnce();
  const saveOnce = () => once(save);
  const bottomSpace = useSheetBottomSpace();
  const [form, setForm] = useState<CustomerForm>(() =>
    customerFormFrom(customerId ? getCustomer(ctx, customerId) : undefined),
  );
  const fullPhone = useCan('customers.phones');
  /** An employee who may not see this customer's number keeps it as it is (feature 26). */
  const [hiddenPhone] = useState(() => (!fullPhone && form.phone ? maskPhone(form.phone) : null));
  const set = (k: keyof CustomerForm, v: string) => setForm((f) => ({ ...f, [k]: v }));
  const save = () => {
    if (!form.name.trim()) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'يرجى إدخال اسم الزبون');
      return;
    }
    try {
      saveCustomer(ctx, customerFormToInput(form, customerId));
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
      <FormHeader
        title={customerId ? 'تعديل الزبون' : 'زبون جديد'}
        onCancel={onDone}
        onSave={saveOnce}
      />
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <TextField
            label="الاسم"
            value={form.name}
            onChangeText={(t) => set('name', t)}
            testID="customer-name"
          />
          {hiddenPhone ? (
            <Text variant="subhead" tone="secondary" testID="customer-phone-masked">
              {`رقم الهاتف: ${hiddenPhone} (يغيّره المالك)`}
            </Text>
          ) : (
            <NumberField
              label="رقم الهاتف"
              kind="phone"
              value={form.phone}
              onChangeText={(t) => set('phone', t)}
              placeholder="09XXXXXXXX"
              testID="customer-phone"
            />
          )}
          <TextField
            label="المنطقة"
            value={form.area}
            onChangeText={(t) => set('area', t)}
            placeholder="اختياري"
          />
          <TextField
            label="ملاحظات"
            value={form.notes}
            onChangeText={(t) => set('notes', t)}
            placeholder="اختياري"
          />
          <Button
            title="حفظ"
            icon="checkmark.circle.fill"
            fullWidth
            onPress={saveOnce}
            testID="customer-save"
          />
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
