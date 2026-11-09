import { BottomSheet, Host, RNHostView } from '@expo/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { spacing, useTheme } from '@/theme';

/** The native iOS sheet (with drag indicator), holding ordinary app views. */
export function Sheet({
  visible,
  onClose,
  children,
  size = 'auto',
  testID,
}: {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** "auto" fits the content; "half" and "full" give fixed heights the user can drag between. */
  size?: 'auto' | 'half' | 'full';
  testID?: string;
}) {
  const { colors } = useTheme();
  return (
    <Host style={{ position: 'absolute', width: 0, height: 0 }}>
      <BottomSheet
        testID={testID}
        isPresented={visible}
        onDismiss={onClose}
        showDragIndicator
        snapPoints={size === 'auto' ? undefined : size === 'half' ? ['half', 'full'] : ['full']}>
        <RNHostView matchContents={size === 'auto'}>
          <View
            style={{ backgroundColor: colors.background, padding: spacing.md, gap: spacing.ms }}>
            {children}
          </View>
        </RNHostView>
      </BottomSheet>
    </Host>
  );
}
