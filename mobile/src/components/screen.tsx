import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

/** Height kept clear at the bottom for the floating glass tab bar. */
export const TAB_BAR_CLEARANCE = 96;

/**
 * Page background with safe-area padding and the standard 16 pt edge. Scrolls by default.
 * `maxWidth` keeps text lines readable on a wide iPad.
 */
export function Screen({
  children,
  scroll = true,
  tabBar = false,
  maxWidth = 760,
  contentStyle,
}: {
  children: ReactNode;
  scroll?: boolean;
  /** Leave room for the tab bar at the bottom. */
  tabBar?: boolean;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const inner: ViewStyle = {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
    paddingHorizontal: spacing.md,
    paddingTop: insets.top + spacing.sm,
    paddingBottom: (tabBar ? TAB_BAR_CLEARANCE : 0) + insets.bottom + spacing.lg,
    gap: spacing.ms,
  };

  if (!scroll) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={[inner, { flex: 1 }, contentStyle]}>{children}</View>
      </View>
    );
  }
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[inner, contentStyle]}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="interactive">
      {children}
    </ScrollView>
  );
}
