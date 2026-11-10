import type { ReactNode } from 'react';
import { ScrollView, type StyleProp, type ViewStyle } from 'react-native';

import { spacing, useTheme } from '@/theme';

/**
 * A screen under a native header (pushed management screens, sheets): iOS keeps the content clear
 * of the header itself. The standard 16 pt edge, and a readable width on iPad.
 */
export function Page({
  children,
  maxWidth = 760,
  contentStyle,
}: {
  children: ReactNode;
  maxWidth?: number;
  contentStyle?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        {
          width: '100%',
          maxWidth,
          alignSelf: 'center',
          padding: spacing.md,
          paddingBottom: spacing.xxl,
          gap: spacing.md,
        },
        contentStyle,
      ]}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}
