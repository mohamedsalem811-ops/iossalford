import { ActionSheetIOS, Pressable, View } from 'react-native';

import { Icon, Text } from '@/components';
import { monthTitle, type MonthKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { radius, spacing, useTheme } from '@/theme';

import { Grid } from './layout';
import type { DashboardData } from './model';
import { monthTiles, TREND_WORDS, type MonthTile } from './month-tiles';

const ICONS: Record<
  MonthTile['key'],
  'banknote' | 'chart.line.uptrend.xyaxis' | 'arrow.down.right.circle.fill' | 'crown.fill'
> = {
  'net-sales': 'banknote',
  profit: 'chart.line.uptrend.xyaxis',
  out: 'arrow.down.right.circle.fill',
  'net-profit': 'crown.fill',
};

/** A colour at `alpha` over `base` (both "#rrggbb"), as "#rrggbb". */
function mix(color: string, base: string, alpha: number): string {
  const c = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) => Math.round(c(color, i) * alpha + c(base, i) * (1 - alpha)))
    .map((v) => v.toString(16).padStart(2, '0'))
    .join('')}`;
}

/**
 * "ملخص الشهر": the month (a calendar chip that lists the months) and four tiles: net sales, sales
 * profit, expenses and refunds, net profit. Each tile's dot compares with the month before.
 */
export function MonthSummary({
  data,
  piece,
  wide,
  onMonth,
}: {
  data: DashboardData;
  piece: string;
  wide: boolean;
  onMonth: (month: MonthKey) => void;
}) {
  const { colors } = useTheme();
  const pickMonth = () => {
    const months = data.months;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'الشهر',
        options: [...months.map(monthTitle), 'إلغاء'],
        cancelButtonIndex: months.length,
      },
      (i) => months[i] && onMonth(months[i]),
    );
  };
  return (
    <View style={{ gap: spacing.ms }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text variant="title">ملخص الشهر</Text>
        <Pressable
          onPress={pickMonth}
          accessibilityRole="button"
          accessibilityLabel={`الشهر: ${monthTitle(data.month)}، تغيير`}
          hitSlop={8}
          testID="month-picker"
          style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
          <Text variant="headline" style={{ color: colors.gold }} testID="month-title">
            {monthTitle(data.month)}
          </Text>
          <Icon name="calendar" size={20} color={colors.gold} />
        </Pressable>
      </View>
      <Grid columns={wide ? 4 : 2} testID="month-summary">
        {monthTiles(data.summary, data.previous, piece).map((t) => (
          <Tile key={t.key} tile={t} />
        ))}
      </Grid>
    </View>
  );
}

function Tile({ tile: t }: { tile: MonthTile }) {
  const { colors } = useTheme();
  const tone = { accent: colors.accent, positive: colors.positive, negative: colors.negative }[
    t.tone
  ];
  const dot = { better: colors.positive, worse: colors.negative, same: colors.chevron }[t.trend];
  return (
    <View
      accessible
      accessibilityLabel={`${t.label}، ${formatLyd(t.value)}، ${t.sub}، ${TREND_WORDS[t.trend]}`}
      testID={`tile-${t.key}`}
      style={{
        flex: 1,
        gap: spacing.xs,
        padding: spacing.md,
        borderRadius: radius.card,
        borderCurve: 'continuous',
        borderWidth: 1.5,
        borderColor: mix(tone, colors.surface, 0.35),
        backgroundColor: mix(tone, colors.surface, 0.07),
      }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon name={ICONS[t.key]} size={26} color={tone} />
        <View
          testID={`trend-${t.key}-${t.trend}`}
          style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: dot }}
        />
      </View>
      <Text variant="title" style={{ color: tone }} numberOfLines={1} adjustsFontSizeToFit>
        {formatLyd(t.value)}
      </Text>
      <Text variant="subhead" style={{ color: colors.gold }} numberOfLines={2}>
        {t.sub}
      </Text>
      <Text variant="subhead" tone="secondary">
        {t.label}
      </Text>
    </View>
  );
}
