import * as Haptics from 'expo-haptics';
import { Pressable, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';

/** − quantity +, for whole numbers between min and max. */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = Number.MAX_SAFE_INTEGER,
  label = 'الكمية',
  testID,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label?: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const step = (delta: number) => {
    const next = value + delta;
    if (next < min || next > max) return;
    Haptics.selectionAsync().catch(() => {});
    onChange(next);
  };
  const button = (delta: number, icon: 'plus' | 'minus', name: string, enabled: boolean) => (
    <Pressable
      onPress={() => step(delta)}
      disabled={!enabled}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityLabel={`${name} ${label}`}
      accessibilityState={{ disabled: !enabled }}
      testID={testID ? `${testID}-${icon}` : undefined}
      style={({ pressed }) => ({
        width: 36,
        height: 36,
        borderRadius: radius.full,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.accentSoft,
        opacity: !enabled ? 0.35 : pressed ? 0.6 : 1,
      })}>
      <Icon name={icon} size={16} color={colors.accent} weight="semibold" />
    </Pressable>
  );
  return (
    <View
      style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}
      accessibilityLabel={`${label} ${value}`}>
      {button(1, 'plus', 'زيادة', value < max)}
      <Text variant="number" style={{ minWidth: 32, textAlign: 'center' }} testID={testID}>
        {String(value)}
      </Text>
      {button(-1, 'minus', 'إنقاص', value > min)}
    </View>
  );
}
