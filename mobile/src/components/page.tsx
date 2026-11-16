import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { useReadable } from '@/hooks/use-readable';
import { spacing, useTheme } from '@/theme';

import { KEYBOARD_GAP } from './keyboard-bar';

/**
 * A screen under a native header (pushed management screens, sheets): iOS keeps the content clear
 * of the header itself. The standard 16 pt edge, and a readable width on iPad. With `keyboard`, a
 * field typed in scrolls clear of the keyboard.
 */
export function Page({
  children,
  maxWidth = 760,
  contentStyle,
  keyboard = false,
}: {
  children: ReactNode;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const { colors } = useTheme();
  const readable = useReadable(maxWidth);
  const Scroll = keyboard ? KeyboardAwareScrollView : ScrollView;
  return (
    <Scroll
      {...(keyboard ? { bottomOffset: KEYBOARD_GAP } : {})}
      style={{ flex: 1, backgroundColor: colors.background }}
      onLayout={readable.onLayout}
      contentContainerStyle={[
        {
          ...readable.padding,
          paddingTop: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        },
        contentStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled">
      {children}
    </Scroll>
  );
}
