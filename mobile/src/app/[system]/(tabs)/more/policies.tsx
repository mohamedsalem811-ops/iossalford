import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, Card, FilterChip, KEYBOARD_GAP, NumberField, Text, TextField } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { ALERT_LIMITS, getPolicies, setPolicies, type Policies } from '@/domain/policies';
import { showError } from '@/features/products/actions';
import { useReadable } from '@/hooks/use-readable';
import { useSaveOnce } from '@/hooks/use-save-once';
import { latinDigits, parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, useTheme } from '@/theme';

/** A list of short texts: each one removable, a field to add more. */
function TextList({
  items,
  onChange,
  placeholder,
  testID,
}: {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder: string;
  testID: string;
}) {
  const [draft, setDraft] = useState('');
  const add = () => {
    const t = draft.trim();
    if (!t) return;
    onChange([...items.filter((i) => i !== t), t]);
    setDraft('');
  };
  return (
    <View style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {items.map((i) => (
          <FilterChip
            key={i}
            label={`${i}  ✕`}
            selected
            onPress={() => onChange(items.filter((x) => x !== i))}
          />
        ))}
      </View>
      <TextField
        value={draft}
        onChangeText={setDraft}
        placeholder={placeholder}
        returnKeyType="done"
        onSubmitEditing={add}
        testID={`${testID}-new`}
      />
      <Button title="إضافة" variant="secondary" onPress={add} testID={`${testID}-add`} />
    </View>
  );
}

/**
 * Management → Rules for selling and returns (phase S4, the owner): how much an employee may take
 * off a piece and a sale without approval, how long returns are accepted, the conditions checked
 * on every return, and the ready-made reasons for a discount. Per system; every change is logged.
 */
function PoliciesScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const once = useSaveOnce(true);
  const [saved, setSaved] = useState<Policies>(() => getPolicies(ctx));
  const [piece, setPiece] = useState(editableDinars(saved.discountPerPiece));
  const [sale, setSale] = useState(editableDinars(saved.discountPerSale));
  const [hours, setHours] = useState(String(saved.returnHours));
  const [conditions, setConditions] = useState(saved.returnConditions);
  const [reasons, setReasons] = useState(saved.discountReasons);
  type AlertLimit = (typeof ALERT_LIMITS)[number];
  const alertDraft = (p: Policies) =>
    Object.fromEntries(
      ALERT_LIMITS.map((k) => [k, k === 'alertShortage' ? editableDinars(p[k]) : String(p[k])]),
    ) as Record<AlertLimit, string>;
  const [alerts, setAlerts] = useState(() => alertDraft(saved));
  const setAlert = (k: AlertLimit) => (v: string) => setAlerts((a) => ({ ...a, [k]: v }));

  const save = () => {
    const perPiece = piece.trim() ? parseThousandths(piece) : 0;
    const perSale = sale.trim() ? parseThousandths(sale) : 0;
    const h = Number(latinDigits(hours).trim());
    if (perPiece === null || perSale === null) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'اكتب حد الخصم بالدينار.');
      return;
    }
    const limits: Partial<Record<AlertLimit, number>> = {};
    for (const k of ALERT_LIMITS) {
      const text = latinDigits(alerts[k]).trim() || '0';
      const v = k === 'alertShortage' ? parseThousandths(text) : Number(text);
      if (v === null || !Number.isInteger(v)) {
        haptic.error();
        Alert.alert('لم يتم الحفظ', 'اكتب حدود التنبيهات أرقاماً صحيحة.');
        return;
      }
      limits[k] = v;
    }
    try {
      const next = setPolicies(ctx, {
        discountPerPiece: perPiece,
        discountPerSale: perSale,
        returnHours: h,
        returnConditions: conditions,
        discountReasons: reasons,
        ...limits,
      });
      setSaved(next);
      setAlerts(alertDraft(next));
      setConditions(next.returnConditions);
      setReasons(next.discountReasons);
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    Alert.alert('تم الحفظ', 'تُطبَّق القواعد الجديدة من الآن.');
    return true;
  };

  return (
    <>
      <Stack.Title>قواعد البيع والمرتجعات</Stack.Title>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="headline">الخصم بدون موافقتك</Text>
          <NumberField
            label="على القطعة الواحدة"
            value={piece}
            onChangeText={setPiece}
            suffix="د.ل"
            hint="صفر: أي خصم يحتاج موافقتك"
            testID="policy-piece"
          />
          <NumberField
            label="على البيعة كاملة"
            value={sale}
            onChangeText={setSale}
            suffix="د.ل"
            testID="policy-sale"
          />
          <Text variant="subhead" tone="secondary">
            أسباب الخصم الجاهزة
          </Text>
          <TextList
            items={reasons}
            onChange={setReasons}
            placeholder="سبب جديد"
            testID="policy-reason"
          />
        </Card>
        <Card>
          <Text variant="headline">المرتجعات</Text>
          <NumberField
            label="تُقبل خلال"
            value={hours}
            onChangeText={setHours}
            suffix="ساعة"
            kind="integer"
            testID="policy-hours"
          />
          <Text variant="subhead" tone="secondary">
            الشروط (يجيب الموظف بنعم على كل شرط)
          </Text>
          <TextList
            items={conditions}
            onChange={setConditions}
            placeholder="شرط جديد"
            testID="policy-condition"
          />
        </Card>
        <Card>
          <Text variant="headline">التنبيهات</Text>
          <Text variant="caption" tone="secondary">
            تظهر لك في «يحتاج انتباهك» على الشاشة الرئيسية. صفر يوقف التنبيه.
          </Text>
          <NumberField
            label="مبيعات بخصم لموظف في يوم"
            value={alerts.alertDiscounts}
            onChangeText={setAlert('alertDiscounts')}
            kind="integer"
            testID="policy-alert-discounts"
          />
          <NumberField
            label="موافقات منك لموظف في يوم"
            value={alerts.alertApprovals}
            onChangeText={setAlert('alertApprovals')}
            kind="integer"
            testID="policy-alert-approvals"
          />
          <NumberField
            label="مرتجع بعد البيع بأقل من"
            value={alerts.alertReturnMinutes}
            onChangeText={setAlert('alertReturnMinutes')}
            suffix="دقيقة"
            kind="integer"
            testID="policy-alert-return"
          />
          <NumberField
            label="محاولات رمز خطأ في يوم"
            value={alerts.alertWrongPins}
            onChangeText={setAlert('alertWrongPins')}
            kind="integer"
            testID="policy-alert-pins"
          />
          <NumberField
            label="عجز الوردية من"
            value={alerts.alertShortage}
            onChangeText={setAlert('alertShortage')}
            suffix="د.ل"
            hint="صفر: أي عجز"
            testID="policy-alert-shortage"
          />
          <NumberField
            label="التنبيهات عن آخر"
            value={alerts.alertDays}
            onChangeText={setAlert('alertDays')}
            suffix="يوم"
            kind="integer"
            testID="policy-alert-days"
          />
        </Card>
        <Button
          title="حفظ القواعد"
          icon="checkmark.circle.fill"
          size="lg"
          fullWidth
          onPress={() => once(save)}
          testID="policy-save"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

/** The owner only (`settings.edit`). */
export default function PoliciesRoute() {
  return (
    <Allowed permission="settings.edit" title="قواعد البيع والمرتجعات">
      <PoliciesScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/policies');
