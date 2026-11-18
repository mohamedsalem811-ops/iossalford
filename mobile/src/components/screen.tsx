import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useReadable } from '@/hooks/use-readable';
import { spacing, useTheme } from '@/theme';

import { KEYBOARD_GAP } from './keyboard-bar';

/** Height kept clear at the bottom for the floating glass tab bar. */
export const TAB_BAR_CLEARANCE = 96;

/**
 * Page background with safe-area padding and the standard 16 pt edge. Scrolls by default.
 * `maxWidth` keeps text lines readable on a wide iPad. With `keyboard`, a field typed in scrolls
 * clear of the keyboard.
 */
export function Screen({
  children,
  scroll = true,
  tabBar = false,
  maxWidth = 760,
  contentStyle,
  keyboard = false,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Leave room for the tab bar at the bottom. */
  tabBar?: boolean;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const readable = useReadable(maxWidth);
  const inner: ViewStyle = {
    ...readable.padding,
    paddingTop: insets.top + spacing.sm,
    paddingBottom: (tabBar ? TAB_BAR_CLEARANCE : 0) + insets.bottom + spacing.lg,
    gap: spacing.ms,
  };

  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }} onLayout={readable.onLayout}>
        <View style={[inner, { flex: 1 }, contentStyle]}>{children}</View>
      </View>
    );
  }
  const Scroll = keyboard ? KeyboardAwareScrollView : ScrollView;
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Scroll
        {...(keyboard
          ? { bottomOffset: KEYBOARD_GAP, keyboardShouldPersistTaps: 'handled' as const }
          : {})}
        style={{ flex: 1 }}
        onLayout={readable.onLayout}
        contentContainerStyle={[inner, contentStyle]}
        contentInsetAdjustmentBehavior="never"
        keyboardDismissMode="interactive">
        {children}
      </Scroll>
      {/* Content scrolls under the clock and battery: a band of the page colour keeps them readable. */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top,
          backgroundColor: colors.background,
          opacity: 0.94,
        }}
      />
    </View>
  );
}
