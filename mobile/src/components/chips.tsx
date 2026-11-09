import { Pressable, ScrollView, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

/** One selectable filter pill (brand, category, size). */
export function FilterChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        minHeight: 34,
        paddingHorizontal: spacing.ms,
        borderRadius: radius.full,
        justifyContent: 'center',
        backgroundColor: selected ? colors.accent : colors.surface,
        boxShadow: selected || colors.cardShadow === 'none' ? undefined : colors.cardShadow,
        opacity: pressed ? 0.7 : 1,
      })}>
      <Text variant="subhead" style={{ color: selected ? colors.onAccent : colors.text }}>
        {label}
      </Text>
    </Pressable>
  );
}

/** A horizontal, scrollable row of filter chips with one selected value. */
export function ChipRow<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xxs }}>
      {options.map((o) => (
        <FilterChip
          key={o.value}
          label={o.label}
          selected={o.value === value}
          onPress={() => onChange(o.value)}
        />
      ))}
    </ScrollView>
  );
}

/** A small value + label pair, used in rows of three under a hero number. */
export function Stat({
  value,
  label,
  onAccent = false,
}: {
  value: string;
  label: string;
  onAccent?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingVertical: spacing.sm,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: onAccent ? colors.onAccentChip : colors.surface,
      }}>
      <Text variant="number" center tone={onAccent ? 'onAccent' : 'primary'}>
        {value}
      </Text>
      <Text variant="caption" center tone={onAccent ? 'onAccent' : 'secondary'}>
        {label}
      </Text>
    </View>
  );
}

/** A badge: a short label in a soft accent (or warning) capsule. */
export function Badge({
  label,
  tone = 'accent',
}: {
  label: string;
  tone?: 'accent' | 'warning' | 'onAccent';
}) {
  const { colors } = useTheme();
  const look = {
    accent: { bg: colors.accentSoft, fg: colors.accent },
    warning: { bg: colors.accentSoft, fg: colors.warning },
    onAccent: { bg: colors.onAccentChip, fg: colors.onAccent },
  }[tone];
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: spacing.sm,
        paddingVertical: spacing.xxs,
        borderRadius: radius.full,
        backgroundColor: look.bg,
      }}>
      <Text
        variant="caption"
        style={{ color: look.fg, fontFamily: 'IBMPlexSansArabic_600SemiBold' }}>
        {label}
      </Text>
    </View>
  );
}
