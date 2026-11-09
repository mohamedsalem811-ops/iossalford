import { Pressable, View } from 'react-native';

import { radius, spacing, ThemeProvider, useTheme, type SystemId } from '@/theme';

import { Badge } from './chips';
import { Logo } from './logo';
import { Text } from './text';

const NAMES: Record<SystemId, { title: string; unlock: string }> = {
  jewelry: { title: 'نظام المجوهرات', unlock: 'Face ID' },
  scarves: { title: 'نظام الأوشحة', unlock: 'رمز PIN' },
};

/**
 * One of the two big choices on the start screen. Each card is drawn in its own system's colours,
 * with a highlighted edge so it reads as a button; `selected` (the last system used) gets a
 * stronger edge.
 */
export function SystemCard({
  system,
  onPress,
  selected = false,
  logoWidth = 170,
}: {
  system: SystemId;
  onPress: () => void;
  selected?: boolean;
  logoWidth?: number;
}) {
  return (
    <ThemeProvider system={system}>
      <SystemCardBody system={system} onPress={onPress} selected={selected} logoWidth={logoWidth} />
    </ThemeProvider>
  );
}

function SystemCardBody({
  system,
  onPress,
  selected,
  logoWidth,
}: {
  system: SystemId;
  onPress: () => void;
  selected: boolean;
  logoWidth: number;
}) {
  const { colors } = useTheme();
  const name = NAMES[system];
  return (
    <Pressable
      testID={`system-${system}`}
      accessibilityRole="button"
      accessibilityLabel={name.title}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        borderRadius: radius.hero,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        borderWidth: selected ? 2 : 1.5,
        borderColor: colors.accent,
        // A soft ring in the system colour around the edge, plus the card shadow in light mode.
        boxShadow: [
          `0 0 0 ${selected ? 5 : 3}px ${colors.accentSoft}`,
          colors.cardShadow === 'none' ? null : colors.cardShadow,
        ]
          .filter(Boolean)
          .join(', '),
        overflow: 'hidden',
        transform: [{ scale: pressed ? 0.98 : 1 }],
        opacity: pressed ? 0.9 : 1,
      })}>
      <View style={{ alignItems: 'center', paddingTop: spacing.lg, paddingBottom: spacing.md }}>
        <Logo system={system} width={logoWidth} backdrop={colors.surface} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: spacing.md,
          paddingVertical: spacing.ms,
          borderTopWidth: 1,
          borderTopColor: colors.separator,
        }}>
        <Text variant="headline">{name.title}</Text>
        <Badge label={name.unlock} />
      </View>
    </Pressable>
  );
}
