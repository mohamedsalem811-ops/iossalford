import { formatDinars } from '@/lib/money';

import { inCart, type CartLine, type SetForCart } from './cart';
import { clean, nowStamp, RuleError, type Ctx } from './context';
import { displayName, getProduct } from './products';

export type SetItem = { productId: number; quantity: number };
export type ProductSet = {
  id: number;
  name: string;
  description: string | null;
  discount: number;
  items: SetItem[];
  createdAt: string;
};

export function listSets(ctx: Ctx): ProductSet[] {
  const sets = ctx.db.all<{
    id: number;
    name: string;
    description: string | null;
    discount: number;
    created_at: string;
  }>('SELECT * FROM sets ORDER BY id DESC');
  const items = ctx.db.all<{ set_id: number; product_id: number; quantity: number }>(
    'SELECT * FROM set_items',
  );
  return sets.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    discount: s.discount,
    createdAt: s.created_at,
    items: items
      .filter((i) => i.set_id === s.id)
      .map((i) => ({ productId: i.product_id, quantity: i.quantity })),
  }));
}

export function getSet(ctx: Ctx, id: number): ProductSet | undefined {
  return listSets(ctx).find((s) => s.id === id);
}

/** Sum of the current prices of the set's pieces. */
export function listPrice(ctx: Ctx, items: SetItem[]): number {
  return items.reduce((t, i) => t + (getProduct(ctx, i.productId)?.price ?? 0) * i.quantity, 0);
}

/** What the customer pays for the set. */
export const setPrice = (ctx: Ctx, set: ProductSet) =>
  Math.max(0, listPrice(ctx, set.items) - set.discount);

/** How many complete sets can still be sold with current stock, minus what is in the cart. */
export function availableSets(ctx: Ctx, set: ProductSet, cart: CartLine[] = []): number {
  if (set.items.length === 0) return 0;
  let n = Number.MAX_SAFE_INTEGER;
  for (const i of set.items) {
    const p = getProduct(ctx, i.productId);
    if (!p || p.archived) return 0;
    n = Math.min(n, Math.floor(Math.max(0, p.stock - inCart(cart, p.id)) / i.quantity));
  }
  return n;
}

/** The set with its current products, ready for addSet() in the cart. */
export function setForCart(ctx: Ctx, set: ProductSet): SetForCart {
  return {
    id: set.id,
    name: set.name,
    discount: set.discount,
    items: set.items.map((i) => {
      const product = getProduct(ctx, i.productId);
      return { product, name: product ? displayName(ctx, product) : '', quantity: i.quantity };
    }),
  };
}

export type SetInput = {
  id?: number;
  name: string;
  description?: string;
  discount: number;
  items: SetItem[];
};

/** Creates or updates a set. The discount must be below the sum of its pieces' prices. */
export function saveSet(ctx: Ctx, input: SetInput): number {
  const name = clean(input.name);
  if (!name) throw new RuleError('يرجى إدخال اسم الطقم');
  const items = input.items.filter((i) => i.quantity > 0);
  if (items.length === 0) throw new RuleError('اختر قطعة واحدة على الأقل للطقم');
  if (!Number.isInteger(input.discount) || input.discount < 0)
    throw new RuleError('الخصم غير صحيح');
  const list = listPrice(ctx, items);
  if (input.discount >= list) {
    throw new RuleError(`الخصم يجب أن يكون أقل من مجموع أسعار القطع (${formatDinars(list)} د.ل)`);
  }
  return ctx.db.transaction(() => {
    let id = input.id;
    if (id) {
      ctx.db.run('UPDATE sets SET name = ?, description = ?, discount = ? WHERE id = ?', [
        name,
        clean(input.description),
        input.discount,
        id,
      ]);
      ctx.db.run('DELETE FROM set_items WHERE set_id = ?', [id]);
    } else {
      id = ctx.db.run(
        'INSERT INTO sets (name, description, discount, created_at) VALUES (?, ?, ?, ?)',
        [name, clean(input.description), input.discount, nowStamp(ctx)],
      ).lastInsertRowId;
    }
    for (const i of items) {
      ctx.db.run('INSERT INTO set_items (set_id, product_id, quantity) VALUES (?, ?, ?)', [
        id,
        i.productId,
        i.quantity,
      ]);
    }
    return id;
  });
}

export function deleteSet(ctx: Ctx, id: number) {
  ctx.db.run('DELETE FROM sets WHERE id = ?', [id]);
}
