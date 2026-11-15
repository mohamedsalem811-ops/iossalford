import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { FilterChip, NumberField, Text, TextField } from '@/components';
import type { Ctx } from '@/domain/context';
import { customerSuggestions, shownName, type Customer } from '@/domain/customers';
import type { GiftInput } from '@/domain/marketing';
import { haptic } from '@/lib/haptics';
import { latinDigits } from '@/lib/digits';
import { spacing } from '@/theme';

/**
 * "من أرسلك؟" (bring a friend, I4): for a new customer, who sent her, picked by name. The
 * friend's gift is then offered on this first purchase.
 */
export function ReferrerPicker({
  ctx,
  exclude,
  value,
  onChange,
  fullNames,
}: {
  ctx: Ctx;
  /** The customer herself, never her own sender. */
  exclude?: number;
  value: Customer | null;
  onChange: (c: Customer | null) => void;
  fullNames: boolean;
}) {
  const [text, setText] = useState('');
  const found = text.trim()
    ? customerSuggestions(ctx, text, 4, fullNames).filter((c) => c.id !== exclude)
    : [];
  if (value)
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <FilterChip
          label={`أرسلتها: ${shownName(value.name, fullNames)}  ✕`}
          selected
          onPress={() => {
            haptic.tap();
            onChange(null);
          }}
          testID="checkout-referrer"
        />
      </View>
    );
  return (
    <View style={{ gap: spacing.sm }}>
      <TextField
        label="من أرسلك؟ (زبونة جديدة)"
        value={text}
        onChangeText={setText}
        placeholder="اسم الزبونة التي أرسلتها، اختياري"
        testID="checkout-referrer-search"
      />
      {found.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {found.map((c) => (
            <FilterChip
              key={c.id}
              label={shownName(c.name, fullNames)}
              selected={false}
              onPress={() => {
                haptic.tap();
                setText('');
                onChange(c);
              }}
              testID={`checkout-referrer-${c.id}`}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export type GiftForm = {
  open: boolean;
  forWhom: string;
  occasion: string;
  day: string;
  month: string;
};
export const emptyGiftForm: GiftForm = {
  open: false,
  forWhom: '',
  occasion: '',
  day: '',
  month: '',
};

/** The gift to remember from the form, or null (not a gift, or not to remind). */
export function giftFromForm(f: GiftForm): GiftInput | null {
  if (!f.open) return null;
  return {
    forWhom: f.forWhom,
    occasion: f.occasion || undefined,
    month: Number(latinDigits(f.month)) || 0,
    day: Number(latinDigits(f.day)) || 0,
  };
}

/**
 * Gift memory (I4): who the gift is for and the occasion's date, and "نذكّرك السنة القادمة؟":
 * a week before next year a row on the home screen offers her a message.
 */
export function GiftMemory({
  value,
  onChange,
}: {
  value: GiftForm;
  onChange: (f: GiftForm) => void;
}) {
  const set = <K extends keyof GiftForm>(k: K, v: GiftForm[K]) => onChange({ ...value, [k]: v });
  return (
    <View style={{ gap: spacing.sm }} testID="checkout-gift">
      <Pressable
        accessibilityRole="switch"
        accessibilityState={{ checked: value.open }}
        hitSlop={8}
        onPress={() => {
          haptic.tap();
          set('open', !value.open);
        }}
        testID="checkout-gift-toggle">
        <Text variant="subhead" tone="accent">
          {value.open ? '✓ هدية: نذكّرها السنة القادمة' : '🎁 هدية لشخص آخر؟ نذكّرها السنة القادمة'}
        </Text>
      </Pressable>
      {value.open ? (
        <>
          <TextField
            label="لمن الهدية؟"
            value={value.forWhom}
            onChangeText={(t) => set('forWhom', t)}
            placeholder="مثلاً: أمها، زوجها"
            testID="checkout-gift-for"
          />
          <TextField
            label="المناسبة"
            value={value.occasion}
            onChangeText={(t) => set('occasion', t)}
            placeholder="مثلاً: عيد ميلاد، ذكرى زواج"
            testID="checkout-gift-occasion"
          />
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <NumberField
                label="اليوم"
                kind="integer"
                value={value.day}
                onChangeText={(t) => set('day', t)}
                testID="checkout-gift-day"
              />
            </View>
            <View style={{ flex: 1 }}>
              <NumberField
                label="الشهر"
                kind="integer"
                value={value.month}
                onChangeText={(t) => set('month', t)}
                testID="checkout-gift-month"
              />
            </View>
          </View>
          <Text variant="caption" tone="secondary">
            قبل المناسبة بأسبوع في السنة القادمة يظهر تذكير في الشاشة الرئيسية مع رسالة لها.
          </Text>
        </>
      ) : null}
    </View>
  );
}
