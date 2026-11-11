import type { ComponentProps } from 'react';
import { TouchableOpacity } from 'react-native';
import { KeyboardToolbar } from 'react-native-keyboard-controller';

import { palettes, useTheme } from '@/theme';

/**
 * The bar above the keyboard with a "تم" (Done) button. Number pads have no return key, so this is
 * how every field is closed. Rendered once per screen tree, not per field; colours follow the
 * active system in light and dark mode.
 */
export function KeyboardBar() {
  const { system } = useTheme();
  const p = palettes[system ?? 'jewelry'];
  return (
    <KeyboardToolbar
      showArrows={false}
      theme={{
        light: {
          primary: p.light.accent,
          disabled: p.light.chevron,
          background: p.light.surface,
          ripple: p.light.accentSoft,
        },
        dark: {
          primary: p.dark.accent,
          disabled: p.dark.chevron,
          background: p.dark.surface,
          ripple: p.dark.accentSoft,
        },
      }}>
      <KeyboardToolbar.Done text="تم" button={ArabicButton} />
    </KeyboardToolbar>
  );
}

type ToolbarButton = NonNullable<ComponentProps<typeof KeyboardToolbar.Done>['button']>;

/**
 * The library labels its button "Done" in English for VoiceOver (and the tap-through tests find
 * it by that label), whatever text it shows. This one says "تم", like the text on the button.
 */
export const ArabicButton: ToolbarButton = ({ children, onPress, disabled, testID, style }) => (
  <TouchableOpacity
    accessibilityRole="button"
    accessibilityLabel="تم"
    accessibilityHint="يغلق لوحة المفاتيح"
    accessibilityState={{ disabled }}
    disabled={disabled}
    onPress={onPress}
    style={style}
    testID={testID}>
    {children}
  </TouchableOpacity>
);

/**
 * Space kept between a focused field and the keyboard, so the "تم" bar above the keyboard
 * never covers it: forms scroll the field being typed in above both.
 */
export const KEYBOARD_GAP = 72;
