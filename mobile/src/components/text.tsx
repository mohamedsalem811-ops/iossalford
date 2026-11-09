import { Text as RNText, type TextProps as RNTextProps } from 'react-native';

import { type, useTheme, type TypeVariant } from '@/theme';

export type TextTone = 'primary' | 'secondary' | 'accent' | 'onAccent' | 'warning';

export type TextProps = RNTextProps & {
  variant?: TypeVariant;
  tone?: TextTone;
  /** Centre the text instead of aligning it to the start (the right, in Arabic). */
  center?: boolean;
};

/**
 * The only text component screens use. It sets the font from the type scale, the colour from the
 * theme, and aligns to the start of the line: in a right-to-left app `textAlign: 'left'` means
 * the right edge, while an unset value would mean the physical left.
 */
export function Text({ variant = 'body', tone = 'primary', center, style, ...props }: TextProps) {
  const { colors } = useTheme();
  const color = {
    primary: colors.text,
    secondary: colors.textSecondary,
    accent: colors.accent,
    onAccent: colors.onAccent,
    warning: colors.warning,
  }[tone];
  return (
    <RNText
      maxFontSizeMultiplier={1.6}
      style={[type[variant], { color, textAlign: center ? 'center' : 'left' }, style]}
      {...props}
    />
  );
}
