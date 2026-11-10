import { useHeaderHeight } from 'expo-router/react-navigation';
import type { ReactNode } from 'react';
import { View } from 'react-native';

/**
 * On iOS 26 the header (title, search bar, buttons) floats over the screen. A scroll view as
 * the first child is inset by iOS itself, but this screen starts with the pinned brand bar, so
 * it leaves the header's height free at the top.
 */
export function BelowHeader({ children }: { children: ReactNode }) {
  const headerHeight = useHeaderHeight();
  return <View style={{ flex: 1, paddingTop: headerHeight }}>{children}</View>;
}
