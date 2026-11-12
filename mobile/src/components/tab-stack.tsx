import { Stack } from 'expo-router';
import type { ReactNode } from 'react';

import { fonts, useTheme } from '@/theme';

/** The look of a tab's own stack: a native header in the app's colours and font. */
export function useTabStackOptions() {
  const { colors } = useTheme();
  return {
    headerShadowVisible: false,
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.accent,
    headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
    headerBackButtonDisplayMode: 'minimal' as const,
    contentStyle: { backgroundColor: colors.background },
  };
}

/** A tab's own stack, for a native header with a search bar and actions (products, sale). */
export function TabStack({ children }: { children?: ReactNode }) {
  return <Stack screenOptions={useTabStackOptions()}>{children}</Stack>;
}
