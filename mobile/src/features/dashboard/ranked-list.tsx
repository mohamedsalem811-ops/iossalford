import { View } from 'react-native';

import { Meter, Text } from '@/components';
import { formatLyd } from '@/lib/money';
import { spacing } from '@/theme';

import type { RankedRow } from './model';

/** A breakdown as ranked rows, each with a bar for its share (easier to read than a pie). */
export function RankedList({
  rows,
  unit,
  extra,
  empty = 'لا مبيعات في هذا الشهر',
  testID,
}: {
  rows: (RankedRow & { stock?: number })[];
  /** "قطعة", "وشاح": after the quantity. */
  unit: string;
  /** More text after the quantity (stock per size). */
  extra?: (row: RankedRow & { stock?: number }) => string | null;
  empty?: string;
  testID?: string;
}) {
  if (rows.length === 0)
    return (
      <Text variant="subhead" tone="secondary" testID={testID}>
        {empty}
      </Text>
    );
  return (
    <View style={{ gap: spacing.ms }} testID={testID}>
      {rows.map((r) => (
        <View
          key={r.key}
          style={{ gap: spacing.xxs }}
          accessible
          accessibilityLabel={`${r.key}: ${formatLyd(r.total)}، ${r.quantity} ${unit}`}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
            <Text variant="subhead" numberOfLines={1} style={{ flex: 1 }}>
              {r.key}
            </Text>
            <Text variant="caption" tone="secondary">
              {[`${r.quantity} ${unit}`, extra?.(r)].filter(Boolean).join(' • ')}
            </Text>
          </View>
          <Meter share={r.share} value={formatLyd(r.total)} />
        </View>
      ))}
    </View>
  );
}
