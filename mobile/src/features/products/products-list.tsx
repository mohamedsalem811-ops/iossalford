import { FlashList } from '@shopify/flash-list';
import type { Href } from 'expo-router';
import { View } from 'react-native';

import { ChipRow, EmptyState, TAB_BAR_CLEARANCE, Text } from '@/components';
import { CATEGORIES, type Product } from '@/domain/products';
import { spacing, useTheme, type SystemId } from '@/theme';

import { BrandBar } from './brand-bar';
import { applyQuery, brandCounts, summaryText, type ListQuery } from './model';
import { ProductRow, type ProductActions } from './product-row';

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
}) {
  const { colors } = useTheme();
  const counts = brandCounts(products);
  const shown = applyQuery(products, query);
  const categories = [
    { value: '', label: 'الكل' },
    ...CATEGORIES[system].map((c) => ({ value: c, label: c })),
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
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
        data={shown}
        keyExtractor={(p) => String(p.id)}
        extraData={selectedId}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + spacing.lg }}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, marginStart: 88, backgroundColor: colors.separator }} />
        )}
        ListHeaderComponent={
          <View
            style={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
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
        renderItem={({ item }) => (
          <ProductRow
            system={system}
            product={item}
            editHref={editHref(item)}
            brandImage={item.brandId !== null ? (brandImages.get(item.brandId) ?? null) : null}
            actions={actions}
            onOpen={onOpen ? () => onOpen(item) : undefined}
            selected={item.id === selectedId}
          />
        )}
      />
    </View>
  );
}
