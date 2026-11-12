import { FlashList } from '@shopify/flash-list';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ChipRow, EmptyState, TAB_BAR_CLEARANCE, Text } from '@/components';
import { CATEGORIES, type Product } from '@/domain/products';
import { groupDesigns, sizeSortKey, type ScarfDesign } from '@/domain/scarves';
import { BrandBar } from '@/features/products/brand-bar';
import { brandCounts } from '@/features/products/model';
import { gridColumns } from '@/hooks/use-layout';
import { spacing, useTheme, type SystemId } from '@/theme';

import { DesignRow } from './design-row';
import { applyDesignQuery, designSummary, type DesignQuery } from './model';

/** Space between the cards of the iPad grid. */
const GAP = spacing.ms;

/** The scarves products tab: designs with all their sizes, filtered by brand, material and size. */
export function DesignsList({
  system,
  products,
  brandImages,
  query,
  onQuery,
  href,
  onDelete,
  onAdjust,
  onAdd,
  grid = false,
}: {
  system: SystemId;
  products: Product[];
  brandImages: Map<number, string | null>;
  query: DesignQuery;
  onQuery: (q: DesignQuery) => void;
  href: (d: ScarfDesign) => Href;
  onDelete: (d: ScarfDesign) => void;
  onAdjust: (productId: number) => void;
  onAdd: () => void;
  /** iPad: photo cards filling the width instead of rows (tapping opens the form as a window). */
  grid?: boolean;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const columns = grid && width > 0 ? gridColumns(width, 220, GAP) : 1;
  const card = columns > 1 ? (width - spacing.md * 2 - GAP * (columns - 1)) / columns : undefined;
  // The brand bar counts designs, not sizes.
  const counts = brandCounts(groupDesigns(products).map((d) => d.sizes[0]));
  const shown = applyDesignQuery(products, query);
  const sizes = [...new Set(products.map((p) => p.size).filter((s): s is string => !!s))].sort(
    (a, b) => sizeSortKey(a) - sizeSortKey(b),
  );
  const all = { value: '', label: 'الكل' };

  return (
    <View
      style={{ flex: 1, backgroundColor: colors.background }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
        <BrandBar
          system={system}
          counts={counts}
          images={brandImages}
          selected={query.brand}
          onSelect={(brand) => onQuery({ ...query, brand })}
        />
      </View>
      <FlashList
        key={columns}
        numColumns={columns}
        data={shown}
        keyExtractor={(d) => d.id}
        keyboardDismissMode="on-drag"
        // The space under the header is left by the route (BelowHeader); iOS adds nothing more.
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={{
          paddingBottom: TAB_BAR_CLEARANCE + spacing.lg,
          paddingHorizontal: card ? spacing.md - GAP / 2 : 0,
        }}
        ItemSeparatorComponent={
          card
            ? undefined
            : () => (
                <View style={{ height: 1, marginStart: 92, backgroundColor: colors.separator }} />
              )
        }
        ListHeaderComponent={
          <View
            style={{
              gap: spacing.sm,
              // In the grid the list itself is already padded at the sides.
              paddingHorizontal: card ? GAP / 2 : spacing.md,
              paddingBottom: spacing.sm,
            }}>
            <ChipRow
              options={[all, ...CATEGORIES.scarves.map((c) => ({ value: c, label: c }))]}
              value={query.category}
              onChange={(category) => onQuery({ ...query, category })}
            />
            {sizes.length > 0 ? (
              <ChipRow
                options={[all, ...sizes.map((s) => ({ value: s, label: s }))]}
                value={query.size}
                onChange={(size) => onQuery({ ...query, size })}
              />
            ) : null}
            <Text variant="caption" tone="secondary" testID="designs-summary">
              {designSummary(shown)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          products.length === 0 ? (
            <EmptyState
              icon="wind"
              title="لا توجد أوشحة بعد"
              message="أضف أول تصميم بمقاساته وأسعاره."
              action="تصميم جديد"
              onAction={onAdd}
            />
          ) : (
            <EmptyState
              icon="magnifyingglass"
              title="لا توجد نتائج"
              message="غيّر البحث أو الفلاتر."
            />
          )
        }
        renderItem={({ item }) => {
          const row = (
            <DesignRow
              system={system}
              design={item}
              href={href(item)}
              brandImage={
                item.sizes[0].brandId !== null
                  ? (brandImages.get(item.sizes[0].brandId) ?? null)
                  : null
              }
              onDelete={onDelete}
              onAdjust={onAdjust}
              card={card}
            />
          );
          return card ? (
            <View style={{ paddingHorizontal: GAP / 2, paddingBottom: GAP }}>{row}</View>
          ) : (
            row
          );
        }}
      />
    </View>
  );
}
