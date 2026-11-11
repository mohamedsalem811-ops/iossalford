import { router, Stack } from 'expo-router';
import { useState, type Dispatch, type SetStateAction } from 'react';

import { EmptyState, SplitView } from '@/components';
import { BelowHeader } from '@/components/below-header';
import type { Ctx } from '@/domain/context';
import { groupDesigns, type Product, type ScarfDesign } from '@/domain/products';
import { confirmDelete, stepStock } from '@/features/products/actions';
import { DEFAULT_QUERY, SORTS, STOCK_FILTERS, type ListQuery } from '@/features/products/model';
import { ProductFormView } from '@/features/products/product-form';
import { ProductsList } from '@/features/products/products-list';
import { firstOfEachDesign, useProducts } from '@/features/products/use-products';
import { confirmDeleteDesign } from '@/features/scarves/actions';
import { DesignFormView } from '@/features/scarves/design-form';
import { DesignsList } from '@/features/scarves/designs-list';
import { DEFAULT_DESIGN_QUERY, type DesignQuery } from '@/features/scarves/model';
import { useLayout } from '@/hooks/use-layout';
import { useCtx } from '@/state/system-db';
import type { SystemId } from '@/theme';
import { errorBoundary } from '@/components/error-screen';

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
}: {
  title: string;
  placeholder: string;
  addLabel: string;
  query: Q;
  setQuery: Dispatch<SetStateAction<Q>>;
  onAdd: () => void;
}) {
  return (
    <>
      <Stack.Title>{title}</Stack.Title>
      <Stack.SearchBar
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
        <Stack.Toolbar.Button icon="plus" accessibilityLabel={addLabel} onPress={onAdd} />
      </Stack.Toolbar>
    </>
  );
}

function JewelryProducts({ ctx }: { ctx: Ctx }) {
  const [query, setQuery] = useState<ListQuery>(DEFAULT_QUERY);
  const data = useProducts(ctx, setQuery);
  const { split } = useLayout();
  // iPad: the piece open beside the list ('new' for a new one).
  const [open, setOpen] = useState<number | 'new' | null>(null);
  const system = ctx.system;
  const editHref = (p: Product) =>
    ({ pathname: '/[system]/product/[id]', params: { system, id: String(p.id) } }) as const;
  const add = () =>
    split
      ? setOpen('new')
      : router.push({ pathname: '/[system]/product/[id]', params: { system, id: 'new' } });
  // A piece deleted while open closes its form.
  const shown = open === 'new' || data.products.some((p) => p.id === open) ? open : null;

  const list = (
    <ProductsList
      system={system}
      products={data.products}
      brandImages={data.brandImages}
      query={query}
      onQuery={setQuery}
      editHref={editHref}
      onAdd={add}
      onOpen={split ? (p) => setOpen(p.id) : undefined}
      selectedId={typeof shown === 'number' ? shown : undefined}
      actions={{
        onPhoto: (p) =>
          p.imageFile
            ? router.push({
                pathname: '/[system]/photo/[id]',
                params: { system, id: String(p.id) },
              })
            : split
              ? setOpen(p.id)
              : router.push(editHref(p)),
        onStep: (p, delta) => stepStock(ctx, p, delta),
        onAdjust: (p) => adjustSheet(system, p.id),
        onDelete: (p) => confirmDelete(ctx, p),
      }}
    />
  );

  return (
    <>
      <Header
        title="المنتجات"
        placeholder="اسم القطعة أو الكود أو الماركة"
        addLabel="إضافة قطعة"
        query={query}
        setQuery={setQuery}
        onAdd={add}
      />
      <BelowHeader>
        {split ? (
          <SplitView
            list={list}
            detail={
              shown === null ? (
                <EmptyState
                  icon="shippingbox"
                  title="اختر قطعة من القائمة"
                  message="تظهر هنا لتعديلها، أو أضف قطعة جديدة."
                  action="إضافة قطعة"
                  onAction={add}
                />
              ) : (
                <ProductFormView
                  key={String(shown)}
                  ctx={ctx}
                  productId={shown === 'new' ? undefined : shown}
                  embedded
                  onDone={() => setOpen(null)}
                />
              )
            }
          />
        ) : (
          list
        )}
      </BelowHeader>
    </>
  );
}

function ScarvesProducts({ ctx }: { ctx: Ctx }) {
  const [query, setQuery] = useState<DesignQuery>(DEFAULT_DESIGN_QUERY);
  const data = useProducts(ctx, setQuery, firstOfEachDesign);
  const { split } = useLayout();
  // iPad: the design open beside the list ('new' for a new one).
  const [open, setOpen] = useState<string | null>(null);
  const system = ctx.system;
  const href = (d: ScarfDesign) =>
    ({ pathname: '/[system]/design/[id]', params: { system, id: d.id } }) as const;
  const add = () =>
    split
      ? setOpen('new')
      : router.push({ pathname: '/[system]/design/[id]', params: { system, id: 'new' } });
  // A design deleted while open closes its form.
  const shown =
    open === 'new' || groupDesigns(data.products).some((d) => d.id === open) ? open : null;

  const list = (
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
      onOpen={split ? (d) => setOpen(d.id) : undefined}
      selectedId={shown ?? undefined}
    />
  );

  return (
    <>
      <Header
        title="الأوشحة"
        placeholder="التصميم أو الماركة أو اللون أو الكود"
        addLabel="تصميم جديد"
        query={query}
        setQuery={setQuery}
        onAdd={add}
      />
      <BelowHeader>
        {split ? (
          <SplitView
            list={list}
            detail={
              shown === null ? (
                <EmptyState
                  icon="wind"
                  title="اختر تصميماً من القائمة"
                  message="يظهر هنا بكل مقاساته لتعديله، أو أضف تصميماً جديداً."
                  action="تصميم جديد"
                  onAction={add}
                />
              ) : (
                <DesignFormView
                  key={shown}
                  ctx={ctx}
                  designId={shown === 'new' ? undefined : shown}
                  embedded
                  onDone={() => setOpen(null)}
                />
              )
            }
          />
        ) : (
          list
        )}
      </BelowHeader>
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('products');
