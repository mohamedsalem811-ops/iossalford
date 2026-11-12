import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components';
import { monthTitle, type MonthKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { radius, spacing, useTheme } from '@/theme';

import { chartBars } from './model';

const HEIGHT = 140;

/**
 * Sales per day of a month, drawn by the app: one bar per day, day 1 on the leading side (the
 * right, in Arabic), digits 0-9 and the app's font. Tap a day to see its total; tap again to go
 * back to the month's total.
 */
export function DailyChart({
  month,
  days,
}: {
  month: MonthKey;
  days: { day: number; total: number }[];
}) {
  const { colors } = useTheme();
  const { bars, best, total } = chartBars(days);
  const [picked, setPicked] = useState<number | null>(null);
  const shown = picked === null ? null : bars.find((b) => b.day === picked);
  const [, mm] = month.split('-');
  return (
    <View style={{ gap: spacing.sm }} testID="daily-chart">
      <View
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <Text variant="subhead" tone="secondary" testID="daily-chart-label">
          {shown ? `${shown.day}/${Number(mm)}` : monthTitle(month)}
        </Text>
        <Text variant="headline" testID="daily-chart-value">
          {formatLyd(shown ? shown.total : total)}
        </Text>
      </View>
      <View
        style={{ height: HEIGHT, flexDirection: 'row', alignItems: 'flex-end', gap: 2 }}
        accessibilityLabel={`المبيعات اليومية لشهر ${monthTitle(month)}`}>
        {bars.map((b) => {
          const on = picked === b.day;
          return (
            <Pressable
              key={b.day}
              style={{ flex: 1, height: '100%', justifyContent: 'flex-end' }}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setPicked(on ? null : b.day);
              }}
              accessibilityRole="button"
              accessibilityLabel={`يوم ${b.day}: ${formatLyd(b.total)}`}
              testID={`day-${b.day}`}>
              <View
                style={{
                  height: b.total > 0 ? Math.max(3, Math.round(b.share * HEIGHT)) : 2,
                  borderRadius: radius.sm / 2,
                  backgroundColor:
                    b.total === 0
                      ? colors.separator
                      : on || (picked === null && b.day === best)
                        ? colors.accent
                        : colors.accentSoft,
                }}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        {[1, 10, 20, bars.length].map((d) => (
          <Text key={d} variant="caption" tone="secondary">
            {String(d)}
          </Text>
        ))}
      </View>
    </View>
  );
}
