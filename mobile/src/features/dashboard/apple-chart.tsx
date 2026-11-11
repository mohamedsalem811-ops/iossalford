import { Chart, Host } from '@expo/ui/swift-ui';

import { useTheme } from '@/theme';

/**
 * TEMPORARY, for the owner to compare (plan 8.4): the same daily chart drawn with Apple's own
 * charts (Swift Charts). iOS draws its axis numbers itself. Removed once the owner chooses.
 */
export function AppleDailyChart({ days }: { days: { day: number; total: number }[] }) {
  const { colors } = useTheme();
  return (
    <Host style={{ height: 180 }}>
      <Chart
        type="bar"
        data={days.map((d) => ({ x: String(d.day), y: d.total / 1000, color: colors.accent }))}
        barStyle={{ cornerRadius: 3 }}
        showGrid
        animate
      />
    </Host>
  );
}
