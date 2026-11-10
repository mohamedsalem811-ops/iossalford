import { FlashList } from '@shopify/flash-list';
import { useState } from 'react';
import { View } from 'react-native';

import { ChipRow, EmptyState, TAB_BAR_CLEARANCE } from '@/components';
import type { CartLine } from '@/domain/cart';
import { CATEGORIES, groupDesigns, type Product } from '@/domain/products';
import { BrandBar } from '@/features/products/brand-bar';
import { brandCounts } from '@/features/products/model';
import { gridColumns } from '@/hooks/use-layout';
import { spacing, useTheme, type SystemId } from '@/theme';

import { freeStock, saleItems, type SaleItem, type SaleQuery } from './model';
import { SaleTile } from './sale-tile';

const GAP = spacing.ms;
const PADDING = spacing.md;

/** Pieces of a tile in the cart, and how many are still free to add. */
function tileStock(item: SaleItem, cart: CartLine[]) {
  const sizes = item.kind === 'piece' ? [item.product] : item.design.sizes;
  let free = 0;
  let held = 0;
  for (const p of sizes) {
    free += freeStock(p.stock, cart, p.id);
    held += cart.filter((l) => l.productId === p.id).reduce((s, l) => s + l.quantity, 0);
  }
  return { free, held };
}

/**
 * The products to sell: the pinned brand bar, the categories, then a grid of tiles (2 columns
 * on iPhone, 4 or more on iPad, following the window width).
 */
export function SaleGrid({
  system,
  products,
  brandImages,
  query,
  onQuery,
  cart,
  onTap,
  onLongPress,
}: {
  system: SystemId;
  products: Product[];
  brandImages: Map<number, string | null>;
  query: SaleQuery;
  onQuery: (q: SaleQuery) => void;
  cart: CartLine[];
  onTap: (item: SaleItem) => void;
  onLongPress: (item: SaleItem) => void;
}) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const counts = brandCounts(
    system === 'scarves' ? groupDesigns(products).map((d) => d.sizes[0]) : products,
  );
  const items = saleItems(system, products, query);
  // 2 on iPhone, up to 5 on iPad.
  const columns = Math.min(5, gridColumns(width || 390, 150, GAP, PADDING));
  const cell = width ? (width - PADDING * 2 + GAP) / columns : 0;
  const categories = [
    { value: '', label: 'الكل' },
    ...CATEGORIES[system].map((c) => ({ value: c, label: c })),
  ];

  return (
    <View
      testID="sale-grid"
      style={{ flex: 1, backgroundColor: colors.background }}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ paddingHorizontal: PADDING, paddingBottom: spacing.sm }}>
        <BrandBar
          system={system}
          counts={counts}
          images={brandImages}
          selected={query.brand}
          onSelect={(brand) => onQuery({ ...query, brand })}
        />
      </View>
      {width > 0 ? (
        <FlashList
          key={columns}
          data={items}
          numColumns={columns}
          keyExtractor={(i) => i.key}
          extraData={cart}
          keyboardDismissMode="on-drag"
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            paddingHorizontal: PADDING - GAP / 2,
            paddingBottom: TAB_BAR_CLEARANCE + spacing.xxl,
          }}
          ListHeaderComponent={
            <View style={{ paddingHorizontal: GAP / 2, paddingBottom: spacing.sm }}>
              <ChipRow
                options={categories}
                value={query.category}
                onChange={(category) => onQuery({ ...query, category })}
              />
            </View>
          }
          ListEmptyComponent={
            products.length === 0 ? (
              <EmptyState
                icon={system === 'scarves' ? 'wind' : 'sparkles'}
                title="لا توجد منتجات للبيع بعد"
                message="أضف المنتجات من تبويب المنتجات."
              />
            ) : (
              <EmptyState
                icon="magnifyingglass"
                title="لا توجد نتائج"
                message="غيّر البحث أو الماركة أو الفئة."
              />
            )
          }
          renderItem={({ item }) => {
            const { free, held } = tileStock(item, cart);
            return (
              <View style={{ paddingHorizontal: GAP / 2, paddingBottom: GAP }}>
                <SaleTile
                  system={system}
                  width={cell - GAP}
                  item={item}
                  free={free}
                  inCart={held}
                  onPress={() => onTap(item)}
                  onLongPress={() => onLongPress(item)}
                />
              </View>
            );
          }}
        />
      ) : null}
    </View>
  );
}
