import { FlashList } from '@shopify/flash-list';
import type { Href } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { ChipRow, EmptyState, TAB_BAR_CLEARANCE, Text } from '@/components';
import { CATEGORIES, type Product } from '@/domain/products';
import { gridColumns } from '@/hooks/use-layout';
import { spacing, useTheme, type SystemId } from '@/theme';

import { BrandBar } from './brand-bar';
import { applyQuery, brandCounts, summaryText, type ListQuery } from './model';
import { ProductRow, type ProductActions } from './product-row';

/** Space between the cards of the iPad grid. */
const GAP = spacing.ms;

/**
 * The products tab: the brand filter pinned at the top, then categories, a summary and the rows.
 * The search, sort and stock filter live in the native header (see the route).
 */
export function ProductsList({
  system,
  products,
  brandImages,
  query,
  onQuery,
  editHref,
  actions,
  onAdd,
  onOpen,
  selectedId,
  grid = false,
}: {
  system: SystemId;
  /** All of the system's (not archived) products. */
  products: Product[];
  brandImages: Map<number, string | null>;
  query: ListQuery;
  onQuery: (q: ListQuery) => void;
  editHref: (p: Product) => Href;
  actions: ProductActions;
  onAdd: () => void;
  /** iPad split view: tapping a row opens it beside the list. */
  onOpen?: (p: Product) => void;
  selectedId?: number;
  /** iPad: photo cards filling the width instead of rows (tapping opens the form as a window). */
  grid?: boolean;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const columns = grid && width > 0 ? gridColumns(width, 220, GAP) : 1;
  const card = columns > 1 ? (width - spacing.md * 2 - GAP * (columns - 1)) / columns : undefined;
  const counts = brandCounts(products);
  const shown = applyQuery(products, query);
  const categories = [
    { value: '', label: 'الكل' },
    ...CATEGORIES[system].map((c) => ({ value: c, label: c })),
  ];

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
        keyExtractor={(p) => String(p.id)}
        extraData={selectedId}
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
                <View style={{ height: 1, marginStart: 88, backgroundColor: colors.separator }} />
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
              options={categories}
              value={query.category}
              onChange={(category) => onQuery({ ...query, category })}
            />
            <Text variant="caption" tone="secondary" testID="products-summary">
              {summaryText(shown)}
            </Text>
          </View>
        }
        ListEmptyComponent={
          products.length === 0 ? (
            <EmptyState
              icon="sparkles"
              title="لا توجد قطع بعد"
              message="أضف أول قطعة مع صورتها وسعرها."
              action="إضافة قطعة"
              onAction={onAdd}
            />
          ) : (
            <EmptyState
              icon="magnifyingglass"
              title="لا توجد نتائج"
              message="غيّر البحث أو الماركة أو الفئة أو الفلتر."
            />
          )
        }
        renderItem={({ item }) => {
          const row = (
            <ProductRow
              system={system}
              product={item}
              editHref={editHref(item)}
              brandImage={item.brandId !== null ? (brandImages.get(item.brandId) ?? null) : null}
              actions={actions}
              onOpen={onOpen ? () => onOpen(item) : undefined}
              selected={item.id === selectedId}
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
