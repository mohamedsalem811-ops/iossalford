import { Children, useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Card, Text } from '@/components';
import { spacing } from '@/theme';

/** Layout pieces of the home screen: section titles, the card grid, side-by-side cards, tiles. */
export function Title({ children }: { children: string }) {
  return (
    <Text variant="headline" accessibilityRole="header" style={{ marginBottom: spacing.xs }}>
      {children}
    </Text>
  );
}

/** Lays cards out in rows of `columns`, each the same width (one column: full width). */
export function Grid({
  columns,
  children,
  testID,
}: {
  columns: number;
  children: ReactNode;
  testID?: string;
}) {
  const [width, setWidth] = useState(0);
  const items = Children.toArray(children).filter(Boolean);
  const gap = spacing.md;
  const cell = columns > 1 && width > 0 ? (width - gap * (columns - 1)) / columns : undefined;
  return (
    <View
      testID={testID}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: 'stretch' }}>
      {items.map((child, i) => (
        <View key={i} style={cell ? { width: cell } : { width: '100%' }}>
          {child}
        </View>
      ))}
    </View>
  );
}

/**
 * Two cards side by side on iPad, the first `ratio` times as wide and both the same height;
 * stacked on iPhone.
 */
export function Split({
  wide,
  ratio = 1,
  children,
}: {
  wide: boolean;
  ratio?: number;
  children: ReactNode;
}) {
  const [first, second] = Children.toArray(children);
  if (!wide) {
    return (
      <View style={{ gap: spacing.lg }}>
        {first}
        {second}
      </View>
    );
  }
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'stretch' }}>
      <View style={{ flex: ratio }}>{first}</View>
      <View style={{ flex: 1 }}>{second}</View>
    </View>
  );
}

/** One number of the month: label, value, and a smaller line under it. */
export function KpiTile({
  label,
  value,
  sub,
  strong = false,
}: {
  label: string;
  value: string;
  sub?: string;
  strong?: boolean;
}) {
  return (
    // VoiceOver reads a tile as one item: "صافي الربح، 200 د.ل، $28.57".
    <Card
      style={{ flex: 1, gap: spacing.xs }}
      accessible
      accessibilityLabel={[label, value, sub].filter(Boolean).join('، ')}>
      <Text variant="subhead" tone="secondary">
        {label}
      </Text>
      <Text variant="number" tone={strong ? 'accent' : 'primary'}>
        {value}
      </Text>
      {sub ? (
        <Text variant="caption" tone="secondary">
          {sub}
        </Text>
      ) : null}
    </Card>
  );
}
