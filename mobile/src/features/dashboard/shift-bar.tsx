import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components';
import { formatTime } from '@/lib/dates';
import { radius, spacing, useTheme } from '@/theme';

import type { ShiftBar as ShiftBarData } from './my-sales';

/**
 * The shift bar at the top of an employee's home (I3): closed (selling is locked; tap to open
 * it), open since a time with its sales, or past the owner's hour (time to count and close).
 * Every state opens the shift screen. The closed bar keeps the `open-shift` id of phase S5.
 */
export function ShiftBar({ shift, onOpen }: { shift: ShiftBarData | null; onOpen: () => void }) {
  const { colors } = useTheme();
  const state = !shift ? 'closed' : shift.closeNow ? 'late' : 'open';
  const tint = state === 'open' ? colors.accent : colors.warning;
  const title =
    state === 'closed'
      ? 'الوردية مغلقة: افتحها للبيع'
      : state === 'late'
        ? 'حان وقت إغلاق الوردية'
        : `الوردية مفتوحة منذ ${formatTime(new Date(shift!.openedAt))}`;
  const detail =
    state === 'closed'
      ? 'عدّ النقد في الدرج وافتح الوردية'
      : state === 'late'
        ? 'عدّ النقد في الدرج وأغلق الوردية'
        : `${shift!.sales} ${shift!.sales === 1 ? 'بيعة' : 'بيعات'} في الوردية`;
  return (
    <Pressable
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`${title}، ${detail}`}
      testID={state === 'closed' ? 'open-shift' : 'shift-bar'}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.ms,
        paddingVertical: spacing.sm,
        paddingHorizontal: spacing.md,
        borderRadius: radius.full,
        borderCurve: 'continuous',
        backgroundColor: colors.surface,
        borderWidth: 1,
        borderColor: state === 'open' ? colors.separator : colors.warning,
        opacity: pressed ? 0.8 : 1,
      })}>
      <Icon
        name={
          state === 'open' ? 'clock' : state === 'late' ? 'clock.badge.exclamationmark' : 'lock'
        }
        size={20}
        color={tint}
      />
      <View style={{ flex: 1 }}>
        <Text variant="bodyStrong" style={{ color: state === 'open' ? colors.text : tint }}>
          {title}
        </Text>
        <Text variant="caption" tone="secondary">
          {detail}
        </Text>
      </View>
      <Icon name="chevron.forward" size={13} color={colors.chevron} weight="semibold" />
    </Pressable>
  );
}
