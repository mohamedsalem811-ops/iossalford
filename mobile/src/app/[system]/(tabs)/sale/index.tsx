import { router, Stack } from 'expo-router';
import { useState } from 'react';

import { SplitView } from '@/components';
import { BelowHeader } from '@/components/below-header';
import { firstOfEachDesign, useProducts } from '@/features/products/use-products';
import { addPiece } from '@/features/sale/actions';
import { CartView } from '@/features/sale/cart-view';
import { DEFAULT_SALE_QUERY, type SaleItem, type SaleQuery } from '@/features/sale/model';
import { SaleGrid } from '@/features/sale/sale-grid';
import { useLayout } from '@/hooks/use-layout';
import { useCart } from '@/state/cart';
import { useCtx } from '@/state/system-db';

/**
 * Selling: search, brand and category, then the products as a grid. Tap adds one piece (a scarf
 * opens its sizes); long-press chooses quantity and price. On a wide iPad the cart stays open
 * beside the products; otherwise the cart bar above the tabs opens it.
 */
export default function SaleRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const [query, setQuery] = useState<SaleQuery>(DEFAULT_SALE_QUERY);
  const data = useProducts(ctx, setQuery, system === 'scarves' ? firstOfEachDesign : undefined);
  const { cart } = useCart(system);
  const { cartBeside } = useLayout();

  const openSizes = (designId: string) =>
    router.push({ pathname: '/[system]/sizes/[id]', params: { system, id: designId } });
  const onTap = (item: SaleItem) =>
    item.kind === 'design' ? openSizes(item.design.id) : addPiece(ctx, item.product);
  const onLongPress = (item: SaleItem) =>
    item.kind === 'design'
      ? openSizes(item.design.id)
      : router.push({
          pathname: '/[system]/add/[id]',
          params: { system, id: String(item.product.id) },
        });
  const checkout = () => router.push({ pathname: '/[system]/checkout', params: { system } });

  const grid = (
    <SaleGrid
      system={system}
      products={data.products}
      brandImages={data.brandImages}
      query={query}
      onQuery={setQuery}
      cart={cart}
      onTap={onTap}
      onLongPress={onLongPress}
    />
  );

  return (
    <>
      <Stack.Title>بيع</Stack.Title>
      <Stack.SearchBar
        placeholder="اسم القطعة أو الكود أو الماركة"
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={(e) => setQuery((q) => ({ ...q, search: e.nativeEvent.text }))}
        onCancelButtonPress={() => setQuery((q) => ({ ...q, search: '' }))}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button
          icon="square.stack.3d.up"
          accessibilityLabel="إضافة طقم"
          onPress={() => router.push({ pathname: '/[system]/sets', params: { system } })}
        />
      </Stack.Toolbar>
      <BelowHeader>
        {cartBeside ? (
          <SplitView list={<CartView ctx={ctx} embedded onCheckout={checkout} />} detail={grid} />
        ) : (
          grid
        )}
      </BelowHeader>
    </>
  );
}
