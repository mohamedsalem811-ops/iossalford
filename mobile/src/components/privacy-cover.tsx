import { StyleSheet, View } from 'react-native';

import { useLock } from '@/state/lock';
import { spacing, useTheme } from '@/theme';

import { Logo } from './logo';

/**
 * Covers the app while it is not active, so sales figures never show in the app switcher.
 * The cover shows both logos, not the open system's data.
 */
export function PrivacyCover() {
  const { active } = useLock();
  const { colors } = useTheme();
  if (active) return null;
  return (
    <View
      testID="privacy-cover"
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: colors.background,
          alignItems: 'center',
          justifyContent: 'center',
          gap: spacing.xl,
        },
      ]}>
      <Logo system="jewelry" width={130} />
      <Logo system="scarves" width={130} />
    </View>
  );
}
