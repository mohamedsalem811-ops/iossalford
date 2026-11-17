import { Pressable, View } from 'react-native';

import { Badge, Text } from '@/components';
import { shownName } from '@/domain/customers';
import { WORK_LABELS, type Repair } from '@/domain/repairs';
import { radius, spacing, useTheme } from '@/theme';

import { moneyLine, needsAttention, statusLine } from './model';

/** One repair in a list: the piece and its ticket, for whom, its stage and its money. */
export function RepairRow({
  repair,
  today,
  phones,
  onPress,
}: {
  repair: Repair;
  today: string;
  /** May this person see the customers' numbers (and so their full names, feature 26). */
  phones: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const warn = needsAttention(repair, today);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={`repair-${repair.id}`}
      style={({ pressed }) => ({
        marginBottom: spacing.sm,
        padding: spacing.md,
        gap: spacing.xxs,
        borderRadius: radius.lg,
        borderCurve: 'continuous',
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="headline" style={{ flex: 1 }} numberOfLines={1}>
          {repair.description}
        </Text>
        <Text variant="subhead" tone="secondary">
          {repair.ticketNo}
        </Text>
      </View>
      <Text variant="subhead" tone="secondary" numberOfLines={1}>
        {`${shownName(repair.customerName, phones)} • ${WORK_LABELS[repair.work]}`}
      </Text>
      <Text variant="caption" tone="secondary">
        {moneyLine(repair)}
      </Text>
      <View style={{ flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xxs }}>
        <Badge label={statusLine(repair, today)} tone={warn ? 'warning' : 'accent'} />
      </View>
    </Pressable>
  );
}
