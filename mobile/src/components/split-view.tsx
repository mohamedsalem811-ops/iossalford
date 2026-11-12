import type { ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useTheme } from '@/theme';

/** Width of the list pane beside a detail pane on iPad, at most. */
export const LIST_PANE_WIDTH = 400;

/**
 * The list pane's width for a window: about a third of it, between 300 and 400 pt, so a narrow
 * Split View or Stage Manager window still leaves the detail most of the room.
 */
export function listPaneWidth(windowWidth: number): number {
  return Math.round(Math.min(LIST_PANE_WIDTH, Math.max(300, windowWidth * 0.36)));
}

export function useListPaneWidth(): number {
  return listPaneWidth(useWindowDimensions().width);
}

/**
 * iPad: a list and its detail side by side. The list is on the leading side (the right, in
 * Arabic), as in the iOS apps when they are set to Arabic.
 */
export function SplitView({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  const { colors } = useTheme();
  const width = useListPaneWidth();
  return (
    <View style={{ flex: 1, flexDirection: 'row', backgroundColor: colors.background }}>
      <View
        style={{
          width,
          borderEndWidth: 1,
          borderEndColor: colors.separator,
        }}>
        {list}
      </View>
      <View style={{ flex: 1 }}>{detail}</View>
    </View>
  );
}
