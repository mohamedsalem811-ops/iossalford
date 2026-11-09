import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

const ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', 'del'],
] as const;

/**
 * An 8-dot PIN entry with its own 0-9 keypad (never the system keyboard, so Arabic digits can't
 * appear). The keypad keeps the phone order 1-2-3 left to right even though the app is
 * right-to-left. `onComplete` fires when the last digit is entered.
 */
export function PinPad({
  length = 8,
  value,
  onChange,
  onComplete,
  disabled = false,
  error = false,
}: {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  /** Shows the dots in the warning colour (wrong PIN, PINs don't match). */
  error?: boolean;
}) {
  const { colors } = useTheme();

  const press = (key: string) => {
    if (disabled) return;
    if (key === 'del') {
      if (value.length) {
        Haptics.selectionAsync().catch(() => {});
        onChange(value.slice(0, -1));
      }
      return;
    }
    if (value.length >= length) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const next = value + key;
    onChange(next);
    if (next.length === length) onComplete?.(next);
  };

  return (
    <View style={{ alignItems: 'center', gap: spacing.xl }}>
      <View
        accessible
        accessibilityLabel={`تم إدخال ${value.length} من ${length}`}
        style={{ flexDirection: 'row', direction: 'ltr', gap: spacing.ms }}>
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            style={{
              width: 14,
              height: 14,
              borderRadius: 7,
              borderWidth: 1.5,
              borderColor: error ? colors.warning : colors.accent,
              backgroundColor:
                i < value.length ? (error ? colors.warning : colors.accent) : 'transparent',
            }}
          />
        ))}
      </View>
      <View style={{ gap: spacing.ms, direction: 'ltr', opacity: disabled ? 0.4 : 1 }}>
        {ROWS.map((row, r) => (
          <View key={r} style={{ flexDirection: 'row', gap: spacing.lg }}>
            {row.map((key, c) =>
              key === '' ? (
                <View key={c} style={{ width: 76, height: 76 }} />
              ) : (
                <Pressable
                  key={c}
                  testID={`pin-key-${key}`}
                  accessibilityRole="button"
                  accessibilityLabel={key === 'del' ? 'حذف' : key}
                  accessibilityState={{ disabled }}
                  disabled={disabled}
                  onPress={() => press(key)}
                  style={({ pressed }) => ({
                    width: 76,
                    height: 76,
                    borderRadius: radius.full,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor:
                      key === 'del' ? 'transparent' : pressed ? colors.accentSoft : colors.surface,
                    boxShadow:
                      key === 'del' || colors.cardShadow === 'none' ? undefined : colors.cardShadow,
                  })}>
                  {key === 'del' ? (
                    <Icon name="delete.left" size={24} color={colors.text} />
                  ) : (
                    <Text variant="title" center style={{ fontSize: 30, lineHeight: 36 }}>
                      {key}
                    </Text>
                  )}
                </Pressable>
              ),
            )}
          </View>
        ))}
      </View>
    </View>
  );
}
