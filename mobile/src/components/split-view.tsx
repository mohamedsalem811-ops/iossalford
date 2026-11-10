import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTheme } from '@/theme';

/** Width of the list pane beside a detail pane on iPad. */
export const LIST_PANE_WIDTH = 400;

/**
 * iPad: a list and its detail side by side. The list is on the leading side (the right, in
 * Arabic), as in the iOS apps when they are set to Arabic.
 */
export function SplitView({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <View
        style={{
          width: LIST_PANE_WIDTH,
          borderEndWidth: 1,
          borderEndColor: colors.separator,
        }}>
        {list}
      </View>
      <View style={{ flex: 1 }}>{detail}</View>
    </View>
  );
}
