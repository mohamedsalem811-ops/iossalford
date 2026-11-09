import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

/** A soft rounded surface: white with a light shadow in light mode, flat grey in dark mode. */
export function Card({
  children,
  padded = true,
  style,
}: {
  children: ReactNode;
  /** Set false for cards that hold list rows with their own padding. */
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          boxShadow: colors.cardShadow === 'none' ? undefined : colors.cardShadow,
          padding: padded ? spacing.md : 0,
          gap: spacing.ms,
        },
        style,
      ]}>
      {children}
    </View>
  );
}

/** The one coloured card per screen that carries its most important number. */
export function HeroCard({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: colors.accent,
          borderRadius: radius.hero,
          borderCurve: 'continuous',
          padding: spacing.ml,
          gap: spacing.ms,
        },
        style,
      ]}>
      {children}
    </View>
  );
}
