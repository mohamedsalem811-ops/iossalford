import { router, Stack } from 'expo-router';
import { useState, type Dispatch, type SetStateAction } from 'react';

import { BelowHeader } from '@/components/below-header';
import type { Ctx } from '@/domain/context';
import type { Product } from '@/domain/products';
import type { ScarfDesign } from '@/domain/scarves';
import { confirmDelete, stepStock } from '@/features/products/actions';
import { DEFAULT_QUERY, SORTS, STOCK_FILTERS, type ListQuery } from '@/features/products/model';
import { ProductsList } from '@/features/products/products-list';
import { firstOfEachDesign, useProducts } from '@/features/products/use-products';
import { confirmDeleteDesign } from '@/features/scarves/actions';
import { DesignsList } from '@/features/scarves/designs-list';
import { DEFAULT_DESIGN_QUERY, type DesignQuery } from '@/features/scarves/model';
import { useLayout } from '@/hooks/use-layout';
import { useCtx } from '@/state/system-db';
import type { SystemId } from '@/theme';
import { errorBoundary } from '@/components/error-screen';
import { useSearchShortcut, useShortcut } from '@/lib/key-commands';
import { useCan } from '@/staff/use-can';

/** Jewelry lists pieces; scarves list designs with all their sizes. */
export default function ProductsRoute() {
  const ctx = useCtx();
  return ctx.system === 'scarves' ? <ScarvesProducts ctx={ctx} /> : <JewelryProducts ctx={ctx} />;
}

type Filters = Pick<ListQuery, 'search' | 'brand' | 'sort' | 'stock'>;

const adjustSheet = (system: SystemId, id: number) =>
  router.push({ pathname: '/[system]/stock/[id]', params: { system, id: String(id) } });

/** The native header: title, search bar, sort and stock menu, add button. */
function Header<Q extends Filters>({
  title,
  placeholder,
  addLabel,
  query,
  setQuery,
  onAdd,
  searchRef,
}: {
  title: string;
  placeholder: string;
  addLabel: string;
  query: Q;
  setQuery: Dispatch<SetStateAction<Q>>;
  /** Absent for someone who may not add pieces (no + button). */
  onAdd?: () => void;
  searchRef: ReturnType<typeof useSearchShortcut>;
}) {
  return (
    <>
      <Stack.Title>{title}</Stack.Title>
      <Stack.SearchBar
        ref={searchRef}
        placeholder={placeholder}
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={(e) => setQuery((q) => ({ ...q, search: e.nativeEvent.text }))}
        onCancelButtonPress={() => setQuery((q) => ({ ...q, search: '' }))}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            query.stock !== 'all'
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
        {onAdd ? (
          <Stack.Toolbar.Button icon="plus" accessibilityLabel={addLabel} onPress={onAdd} />
        ) : null}
      </Stack.Toolbar>
    </>
  );
}

function JewelryProducts({ ctx }: { ctx: Ctx }) {
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const data = useProducts(ctx, setQuery);
  // iPad: photo cards filling the width; a piece opens as a window (sheet) over them.
  const { split } = useLayout();
  const system = ctx.system;
  const editHref = (p: Product) =>
    ({ pathname: '/[system]/product/[id]', params: { system, id: String(p.id) } }) as const;
  const mayAdd = useCan('products.edit');
  const add = mayAdd
    ? () => router.push({ pathname: '/[system]/product/[id]', params: { system, id: 'new' } })
    : undefined;
  const searchRef = useSearchShortcut();
  useShortcut('new', () => add?.());

  return (
    <>
      <Header
        title="المنتجات"
        placeholder="اسم القطعة أو الكود أو الماركة"
        addLabel="إضافة قطعة"
        query={query}
        setQuery={setQuery}
        onAdd={add}
        searchRef={searchRef}
      />
      <BelowHeader>
        <ProductsList
          system={system}
          products={data.products}
          brandImages={data.brandImages}
          query={query}
          onQuery={setQuery}
          editHref={editHref}
          onAdd={add}
          grid={split}
          actions={{
            onPhoto: (p) =>
              router.push(
                p.imageFile
                  ? { pathname: '/[system]/photo/[id]', params: { system, id: String(p.id) } }
                  : editHref(p),
              ),
            onStep: (p, delta) => stepStock(ctx, p, delta),
            onAdjust: (p) => adjustSheet(system, p.id),
            onDelete: (p) => confirmDelete(ctx, p),
          }}
        />
      </BelowHeader>
    </>
  );
}

function ScarvesProducts({ ctx }: { ctx: Ctx }) {
  const [query, setQuery] = useState<DesignQuery>(DEFAULT_DESIGN_QUERY);
  const data = useProducts(ctx, setQuery, firstOfEachDesign);
  // iPad: design cards filling the width; a design opens as a window (sheet) over them.
  const { split } = useLayout();
  const system = ctx.system;
  const href = (d: ScarfDesign) =>
    ({ pathname: '/[system]/design/[id]', params: { system, id: d.id } }) as const;
  const mayAdd = useCan('products.edit');
  const add = mayAdd
    ? () => router.push({ pathname: '/[system]/design/[id]', params: { system, id: 'new' } })
    : undefined;
  const searchRef = useSearchShortcut();
  useShortcut('new', () => add?.());

  return (
    <>
      <Header
        title="الأوشحة"
        placeholder="التصميم أو الماركة أو اللون أو الكود"
        addLabel="تصميم جديد"
        query={query}
        setQuery={setQuery}
        onAdd={add}
        searchRef={searchRef}
      />
      <BelowHeader>
        <DesignsList
          system={system}
          products={data.products}
          brandImages={data.brandImages}
          query={query}
          onQuery={setQuery}
          href={href}
          onDelete={(d) => confirmDeleteDesign(ctx, d)}
          onAdjust={(id) => adjustSheet(system, id)}
          onAdd={add}
          grid={split}
        />
      </BelowHeader>
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('products');
