import * as Haptics from 'expo-haptics';
import { ActivityIndicator, Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, touchTarget, useTheme } from '@/theme';

import { Icon } from './icon';
import { Text } from './text';
import type { SymbolViewProps } from 'expo-symbols';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

const sizes = {
  sm: { height: 36, paddingHorizontal: spacing.ms, variant: 'subhead' as const },
  md: { height: touchTarget + 4, paddingHorizontal: spacing.md, variant: 'headline' as const },
  lg: { height: 56, paddingHorizontal: spacing.lg, variant: 'headline' as const },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  fullWidth = false,
  style,
  testID,
}: {
  title: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: SymbolViewProps['name'];
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const { colors } = useTheme();
  const look = {
    primary: { bg: colors.accent, fg: colors.onAccent },
    secondary: { bg: colors.accentSoft, fg: colors.accent },
    ghost: { bg: 'transparent', fg: colors.accent },
    destructive: { bg: colors.surface, fg: colors.warning },
  }[variant];
  const s = sizes[size];
  const inactive = disabled || loading;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress?.();
      }}
      style={({ pressed }) => [
        {
          height: Math.max(s.height, size === 'sm' ? 36 : touchTarget),
          paddingHorizontal: s.paddingHorizontal,
          borderRadius: radius.full,
          backgroundColor: look.bg,
          alignItems: 'center',
          justifyContent: 'center',
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          opacity: disabled ? 0.4 : pressed ? 0.75 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={look.fg} />
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          {icon ? <Icon name={icon} size={17} color={look.fg} /> : null}
          <Text variant={s.variant} style={{ color: look.fg }}>
            {title}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
