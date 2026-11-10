import { useFocusEffect } from 'expo-router';
import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

import { listBrands } from '@/domain/brands';
import type { Ctx } from '@/domain/context';
import { groupDesigns, listProducts, type Product } from '@/domain/products';
import { useOnDataChanged } from '@/state/data-events';

import { brandCounts, keepBrandFilter, type BrandFilter } from './model';

const everyProduct = (products: Product[]) => products;

/** The brand bar counts scarf designs: one product per design. */
export const firstOfEachDesign = (products: Product[]) =>
  groupDesigns(products).map((d) => d.sizes[0]);

/**
 * The system's products, read again whenever the tab comes back into view or data changes. A
 * chosen brand whose last piece was removed goes back to all brands.
 */
export function useProducts<Q extends { brand: BrandFilter }>(
  ctx: Ctx,
  setQuery: Dispatch<SetStateAction<Q>>,
  /** Must be a stable function (module level): it is part of the refresh's dependencies. */
  countBy: (products: Product[]) => Product[] = everyProduct,
) {
  const read = useCallback(
    () => ({
      products: listProducts(ctx),
      brandImages: new Map(listBrands(ctx).map((b) => [b.id, b.imageFile])),
    }),
    [ctx],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => {
    const next = read();
    setData(next);
    setQuery((q) => ({
      ...q,
      brand: keepBrandFilter(q.brand, brandCounts(countBy(next.products))),
    }));
  }, [read, setQuery, countBy]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return data;
}
