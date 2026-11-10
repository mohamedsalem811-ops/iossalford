import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, View } from 'react-native';

import { Icon, Text } from '@/components';
import { radius, spacing, useTheme, type SystemId } from '@/theme';

import { BrandBadge } from './brand-badge';
import type { BrandCount, BrandFilter } from './model';

/**
 * The brand filter pinned above the products (and, later, the selling grid). One tap shows only
 * that brand's pieces; tapping it again shows all brands. Each chip shows how many pieces it has.
 */
export function BrandBar({
  system,
  counts,
  images,
  selected,
  onSelect,
}: {
  system: SystemId;
  counts: { brands: BrandCount[]; noBrand: number; total: number };
  /** Brand id → the shop's own photo for that brand. */
  images: Map<number, string | null>;
  selected: BrandFilter;
  onSelect: (filter: BrandFilter) => void;
}) {
  const { colors } = useTheme();
  const choose = (filter: BrandFilter) => {
    Haptics.selectionAsync().catch(() => {});
    onSelect(filter === selected && filter !== 'all' ? 'all' : filter);
  };

  if (counts.brands.length === 0) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: spacing.sm,
          paddingVertical: spacing.xs,
        }}>
        <Icon name="seal" size={14} color={colors.textSecondary} />
        <Text variant="caption" tone="secondary" style={{ flex: 1 }}>
          لتظهر الماركات هنا للفلترة: افتح القطعة واكتب ماركتها
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.xxs }}>
      <Chip
        label="الكل"
        count={counts.total}
        selected={selected === 'all'}
        onPress={() => choose('all')}
        accessibilityLabel={`كل الماركات، ${counts.total} قطعة`}
        leading={
          <Icon
            name="square.grid.2x2"
            size={14}
            color={selected === 'all' ? colors.onAccent : colors.text}
          />
        }
      />
      {counts.brands.map((b) => (
        <Chip
          key={b.id}
          label={b.name}
          count={b.count}
          selected={selected === b.id}
          onPress={() => choose(b.id)}
          accessibilityLabel={`${b.name}، ${b.count} قطعة`}
          leading={
            <BrandBadge name={b.name} imageFile={images.get(b.id)} system={system} size={26} />
          }
          testID={`brand-chip-${b.name}`}
        />
      ))}
      {counts.noBrand > 0 ? (
        <Chip
          label="بدون ماركة"
          count={counts.noBrand}
          selected={selected === 'none'}
          onPress={() => choose('none')}
          accessibilityLabel={`بدون ماركة، ${counts.noBrand} قطعة`}
        />
      ) : null}
    </ScrollView>
  );
}

function Chip({
  label,
  count,
  selected,
  onPress,
  leading,
  accessibilityLabel,
  testID,
}: {
  label: string;
  count: number;
  selected: boolean;
  onPress: () => void;
  leading?: React.ReactNode;
  accessibilityLabel: string;
  testID?: string;
}) {
  const { colors } = useTheme();
  const fg = selected ? colors.onAccent : colors.text;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.xs + 2,
        minHeight: 38,
        paddingStart: leading ? spacing.xs : spacing.ms,
        paddingEnd: spacing.ms,
        borderRadius: radius.full,
        backgroundColor: selected ? colors.accent : colors.surface,
        boxShadow: selected || colors.cardShadow === 'none' ? undefined : colors.cardShadow,
        opacity: pressed ? 0.7 : 1,
      })}>
      {leading}
      <Text variant="subhead" numberOfLines={1} style={{ color: fg }}>
        {label}
      </Text>
      <View
        style={{
          paddingHorizontal: 6,
          borderRadius: radius.full,
          backgroundColor: selected ? colors.onAccentChip : colors.accentSoft,
        }}>
        <Text variant="caption" style={{ color: selected ? colors.onAccent : colors.accent }}>
          {count}
        </Text>
      </View>
    </Pressable>
  );
}
