import { View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { Text } from './text';

/**
 * A horizontal bar for a share (0 to 1) with its value beside it: the monthly comparison and the
 * dashboard's ranked lists. It grows from the leading side (the right, in Arabic).
 */
export function Meter({
  share,
  value,
  color,
  height = 10,
}: {
  share: number;
  value?: string;
  color?: string;
  height?: number;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
      <View
        style={{
          flex: 1,
          height,
          borderRadius: radius.full,
          backgroundColor: colors.accentSoft,
          overflow: 'hidden',
        }}>
        <View
          style={{
            width: `${Math.max(0, Math.min(100, Math.round(share * 100)))}%`,
            height: '100%',
            borderRadius: radius.full,
            backgroundColor: color ?? colors.accent,
          }}
        />
      </View>
      {value ? (
        <Text variant="caption" style={{ minWidth: 84, textAlign: 'left' }}>
          {value}
        </Text>
      ) : null}
    </View>
  );
}
