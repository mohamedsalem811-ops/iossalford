import { FlashList } from '@shopify/flash-list';
import type { Href } from 'expo-router';
import { View } from 'react-native';

import { ChipRow, EmptyState, TAB_BAR_CLEARANCE, Text } from '@/components';
import {
  CATEGORIES,
  groupDesigns,
  sizeSortKey,
  type Product,
  type ScarfDesign,
} from '@/domain/products';
import { BrandBar } from '@/features/products/brand-bar';
import { brandCounts } from '@/features/products/model';
import { spacing, useTheme, type SystemId } from '@/theme';

import { DesignRow } from './design-row';
import { applyDesignQuery, designSummary, type DesignQuery } from './model';

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
}) {
  const { colors } = useTheme();
  // The brand bar counts designs, not sizes.
  const counts = brandCounts(groupDesigns(products).map((d) => d.sizes[0]));
  const shown = applyDesignQuery(products, query);
  const sizes = [...new Set(products.map((p) => p.size).filter((s): s is string => !!s))].sort(
    (a, b) => sizeSortKey(a) - sizeSortKey(b),
  );
  const all = { value: '', label: 'الكل' };

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
        keyExtractor={(d) => d.id}
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ paddingBottom: TAB_BAR_CLEARANCE + spacing.lg }}
        ItemSeparatorComponent={() => (
          <View style={{ height: 1, marginStart: 92, backgroundColor: colors.separator }} />
        )}
        ListHeaderComponent={
          <View
            style={{ gap: spacing.sm, paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
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
        renderItem={({ item }) => (
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
          />
        )}
      />
    </View>
  );
}
