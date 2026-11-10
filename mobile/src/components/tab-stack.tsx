import { Stack } from 'expo-router';

import { fonts, useTheme } from '@/theme';

/** A tab's own stack, for a native header with a search bar and actions (products, sale). */
export function TabStack() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShadowVisible: false,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.accent,
        headerTitleStyle: { fontFamily: fonts.semibold, color: colors.text },
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
