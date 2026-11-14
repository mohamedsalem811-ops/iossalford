import { View } from 'react-native';

import { FilterChip, NumberField, Text, TextField } from '@/components';
import { HEARD, HEARD_LABELS, METALS } from '@/domain/customers';
import { haptic } from '@/lib/haptics';
import { spacing } from '@/theme';
import type { SystemId } from '@/theme/palette';

import { monthHint, type DetailsForm } from './model';

/**
 * The optional details a customer gives (G1), the same at checkout and on the customer form:
 * the birthday (day and month, never the year), how they heard about the shop (buttons), the
 * shop's own details (ring size and metal for jewelry, colours for scarves) and offer messages.
 */
export function DetailsFields({
  system,
  value: f,
  onChange,
  testID = 'details',
}: {
  system: SystemId;
  value: DetailsForm;
  onChange: (f: DetailsForm) => void;
  testID?: string;
}) {
  const set = <K extends keyof DetailsForm>(k: K, v: DetailsForm[K]) => onChange({ ...f, [k]: v });
  const toggle = <K extends 'heard' | 'metal'>(k: K, v: NonNullable<DetailsForm[K]>) => {
    haptic.tap();
    set(k, (f[k] === v ? null : v) as DetailsForm[K]);
  };
  return (
    <View style={{ gap: spacing.ms }}>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <View style={{ flex: 1 }}>
          <NumberField
            label="يوم الميلاد"
            kind="integer"
            value={f.birthDay}
            onChangeText={(t) => set('birthDay', t.slice(0, 2))}
            placeholder="1-31"
            testID={`${testID}-birth-day`}
          />
        </View>
        <View style={{ flex: 1 }}>
          <NumberField
            label="الشهر"
            kind="integer"
            value={f.birthMonth}
            onChangeText={(t) => set('birthMonth', t.slice(0, 2))}
            placeholder="1-12"
            hint={monthHint(f.birthMonth)}
            testID={`${testID}-birth-month`}
          />
        </View>
      </View>
      <Text variant="subhead" tone="secondary">
        كيف عرفنا؟
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {HEARD.map((h) => (
          <FilterChip
            key={h}
            label={HEARD_LABELS[h]}
            selected={f.heard === h}
            onPress={() => toggle('heard', h)}
            testID={`${testID}-heard-${h}`}
          />
        ))}
      </View>
      {system === 'jewelry' ? (
        <>
          <TextField
            label="مقاس الخاتم"
            value={f.ringSize}
            onChangeText={(t) => set('ringSize', t)}
            placeholder="اختياري"
            maxLength={10}
            testID={`${testID}-ring`}
          />
          <Text variant="subhead" tone="secondary">
            المعدن المفضل
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {METALS.map((m) => (
              <FilterChip
                key={m}
                label={m}
                selected={f.metal === m}
                onPress={() => toggle('metal', m)}
                testID={`${testID}-metal-${m}`}
              />
            ))}
          </View>
        </>
      ) : (
        <TextField
          label="الألوان المفضلة"
          value={f.colours}
          onChangeText={(t) => set('colours', t)}
          placeholder="مثلاً: بيج، كحلي"
          maxLength={100}
          testID={`${testID}-colours`}
        />
      )}
      <FilterChip
        label={`${f.offers ? '✓ ' : ''}يقبل رسائل العروض`}
        selected={f.offers}
        onPress={() => {
          haptic.tap();
          set('offers', !f.offers);
        }}
        testID={`${testID}-offers`}
      />
    </View>
  );
}
