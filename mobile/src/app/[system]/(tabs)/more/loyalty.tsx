import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { Button, Card, FilterChip, KEYBOARD_GAP, NumberField, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { getLoyalty, setLoyalty, type LoyaltyRules } from '@/domain/loyalty';
import { showError } from '@/features/products/actions';
import { useReadable } from '@/hooks/use-readable';
import { useSaveOnce } from '@/hooks/use-save-once';
import { latinDigits, parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars, formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, useTheme } from '@/theme';

/**
 * Settings → نقاط الولاء (feature 34, the owner): on or off, how much a customer pays for one
 * point, what a point pays, the fewest points that can be used, and the largest share of a sale
 * points may pay. Off until the owner turns it on; every change is logged.
 */
function LoyaltyScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const once = useSaveOnce(true);
  const [saved, setSaved] = useState<LoyaltyRules>(() => getLoyalty(ctx));
  const [enabled, setEnabled] = useState(saved.enabled);
  const [spend, setSpend] = useState(editableDinars(saved.spendPerPoint));
  const [value, setValue] = useState(editableDinars(saved.pointValue));
  const [min, setMin] = useState(String(saved.minRedeem));
  const [share, setShare] = useState(String(saved.maxShare));

  const save = () => {
    const spendPerPoint = parseThousandths(spend);
    const pointValue = parseThousandths(value);
    const minRedeem = Number(latinDigits(min).trim());
    const maxShare = Number(latinDigits(share).trim());
    if (spendPerPoint === null || pointValue === null) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'اكتب المبالغ بالدينار.');
      return;
    }
    try {
      const next = setLoyalty(ctx, { enabled, spendPerPoint, pointValue, minRedeem, maxShare });
      setSaved(next);
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    Alert.alert('تم الحفظ', enabled ? 'تعمل نقاط الولاء من الآن.' : 'نقاط الولاء متوقفة.');
    return true;
  };

  const example = parseThousandths(spend);
  const worth = parseThousandths(value);
  return (
    <>
      <Stack.Title>نقاط الولاء</Stack.Title>
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
          <FilterChip
            label={enabled ? '✓ نقاط الولاء تعمل' : 'نقاط الولاء متوقفة: اضغط للتشغيل'}
            selected={enabled}
            onPress={() => setEnabled((e) => !e)}
            testID="loyalty-enabled"
          />
          <Text variant="caption" tone="secondary">
            يكسب الزبون المسجل نقاطاً على ما يدفعه، ويدفع بها جزءاً من بيعة نقدية أو ببطاقة لاحقاً.
            في البيع الآجل تُكتسب النقاط عند سداد الدين، والمرتجع يسترجع حصته منها.
          </Text>
        </Card>
        <Card>
          <NumberField
            label="نقطة واحدة لكل"
            value={spend}
            onChangeText={setSpend}
            suffix="د.ل"
            testID="loyalty-spend"
          />
          <NumberField
            label="قيمة النقطة الواحدة"
            value={value}
            onChangeText={setValue}
            suffix="د.ل"
            testID="loyalty-value"
          />
          {example && worth ? (
            <Text variant="caption" tone="secondary">
              {`مثال: بيعة 1000 د.ل تكسب ${Math.floor(1_000_000 / example)} نقطة، قيمتها ${formatLyd(Math.floor(1_000_000 / example) * worth)}.`}
            </Text>
          ) : null}
          <NumberField
            label="أقل عدد نقاط للاستخدام"
            value={min}
            onChangeText={setMin}
            suffix="نقطة"
            kind="integer"
            testID="loyalty-min"
          />
          <NumberField
            label="أكبر نسبة من البيعة تُدفع بالنقاط"
            value={share}
            onChangeText={setShare}
            suffix="%"
            kind="integer"
            testID="loyalty-share"
          />
        </Card>
        <Button
          title="حفظ"
          icon="checkmark.circle.fill"
          size="lg"
          fullWidth
          onPress={() => once(save)}
          testID="loyalty-save"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

/** The owner only (`settings.edit`). */
export default function LoyaltyRoute() {
  return (
    <Allowed permission="settings.edit" title="نقاط الولاء">
      <LoyaltyScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/loyalty');
