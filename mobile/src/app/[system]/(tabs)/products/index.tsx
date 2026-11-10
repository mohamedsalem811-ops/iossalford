import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listBrands } from '@/domain/brands';
import { listProducts, type Product } from '@/domain/products';
import { confirmDelete, stepStock } from '@/features/products/actions';
import {
  brandCounts,
  DEFAULT_QUERY,
  keepBrandFilter,
  SORTS,
  STOCK_FILTERS,
  type ListQuery,
} from '@/features/products/model';
import { ProductsList } from '@/features/products/products-list';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';

export default function ProductsRoute() {
  const ctx = useCtx();
  const read = useCallback(
    () => ({
      products: listProducts(ctx),
      brandImages: new Map(listBrands(ctx).map((b) => [b.id, b.imageFile])),
    }),
    [ctx],
  );
  const [data, setData] = useState(read);
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);

  const refresh = useCallback(() => {
    const next = read();
    setData(next);
    // A chosen brand whose last piece was removed goes back to all brands.
    setQuery((q) => ({ ...q, brand: keepBrandFilter(q.brand, brandCounts(next.products)) }));
  }, [read]);
  // Fresh each time the tab comes back into view (after the form, a sale, a return...).
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  const system = ctx.system;
  const editHref = (p: Product) =>
    ({ pathname: '/[system]/product/[id]', params: { system, id: String(p.id) } }) as const;
  const add = () =>
    router.push({ pathname: '/[system]/product/[id]', params: { system, id: 'new' } });
  const filtered = query.stock !== 'all';

  return (
    <>
      <Stack.Title>المنتجات</Stack.Title>
      <Stack.SearchBar
        placeholder="اسم القطعة أو الكود أو الماركة"
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={(e) => setQuery((q) => ({ ...q, search: e.nativeEvent.text }))}
        onCancelButtonPress={() => setQuery((q) => ({ ...q, search: '' }))}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            filtered
              ? 'line.3.horizontal.decrease.circle.fill'
              : 'line.3.horizontal.decrease.circle'
          }
          title="ترتيب وفلترة"
          accessibilityLabel="ترتيب وفلترة">
          <Stack.Toolbar.Menu inline title="الترتيب">
            {SORTS.map((s) => (
              <Stack.Toolbar.MenuAction
                key={s.value}
                isOn={query.sort === s.value}
                onPress={() => setQuery((q) => ({ ...q, sort: s.value }))}>
                {s.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu inline title="المخزون">
            {STOCK_FILTERS.map((f) => (
              <Stack.Toolbar.MenuAction
                key={f.value}
                isOn={query.stock === f.value}
                onPress={() => setQuery((q) => ({ ...q, stock: f.value }))}>
                {f.label}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button icon="plus" accessibilityLabel="إضافة قطعة" onPress={add} />
      </Stack.Toolbar>
      <ProductsList
        system={system}
        products={data.products}
        brandImages={data.brandImages}
        query={query}
        onQuery={setQuery}
        editHref={editHref}
        onAdd={add}
        actions={{
          onPhoto: (p) =>
            p.imageFile
              ? router.push({
                  pathname: '/[system]/photo/[id]',
                  params: { system, id: String(p.id) },
                })
              : router.push(editHref(p)),
          onStep: (p, delta) => stepStock(ctx, p, delta),
          onDelete: (p) => confirmDelete(ctx, p),
        }}
      />
    </>
  );
}
