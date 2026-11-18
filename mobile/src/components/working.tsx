import { ActivityIndicator, Modal, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { Text } from './text';

/**
 * "Please wait" over the whole screen while long work runs (J1: restoring a large backup takes
 * seconds, and taps during it did nothing with no sign why). Nothing behind it can be tapped.
 * `message` null hides it.
 */
export function Working({ message }: { message: string | null }) {
  const { colors } = useTheme();
  return (
    <Modal visible={message !== null} transparent animationType="fade" statusBarTranslucent>
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'rgba(0,0,0,0.35)',
          padding: spacing.lg,
        }}>
        <View
          testID="working"
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={message ?? undefined}
          style={{
            backgroundColor: colors.surface,
            borderRadius: radius.card,
            borderCurve: 'continuous',
            padding: spacing.lg,
            gap: spacing.ms,
            alignItems: 'center',
            maxWidth: 360,
          }}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text variant="bodyStrong" style={{ textAlign: 'center' }}>
            {message ?? ''}
          </Text>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Lets the screen draw (the "please wait" card) before work that holds the JS thread starts:
 * restoring and saving a backup run mostly without yielding.
 */
export const letScreenDraw = () => new Promise<void>((resolve) => setTimeout(resolve, 60));
