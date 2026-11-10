/** Pure rules of the set form and the set lists. */
import type { CartLine } from '@/domain/cart';
import type { Product } from '@/domain/products';
import type { SetInput, SetItem } from '@/domain/sets';
import { parseThousandths } from '@/lib/digits';
import { editableDinars } from '@/lib/money';

export type SetForm = { name: string; discount: string; items: SetItem[] };

export const emptySetForm = (): SetForm => ({ name: '', discount: '', items: [] });

export function setFormFrom(set: { name: string; discount: number; items: SetItem[] }): SetForm {
  return {
    name: set.name,
    discount: set.discount ? editableDinars(set.discount) : '',
    items: set.items.map((i) => ({ ...i })),
  };
}

/** Adds one more of a piece (a new piece starts at 1). */
export function addItem(items: SetItem[], productId: number): SetItem[] {
  return items.some((i) => i.productId === productId)
    ? items.map((i) => (i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i))
    : [...items, { productId, quantity: 1 }];
}

export function setItemQuantity(items: SetItem[], productId: number, quantity: number) {
  return items.map((i) => (i.productId === productId ? { ...i, quantity } : i));
}

export const removeItem = (items: SetItem[], productId: number) =>
  items.filter((i) => i.productId !== productId);

/** The form as saveSet() input; an empty discount is no discount. */
export function setFormToInput(f: SetForm, id?: number): SetInput {
  return {
    id,
    name: f.name,
    discount: parseThousandths(f.discount) ?? 0,
    items: f.items,
  };
}

/** Sum of the pieces' prices, the discount and what the customer pays. */
export function setPreview(
  items: SetItem[],
  discount: number,
  product: (id: number) => Pick<Product, 'price'> | undefined,
) {
  const list = items.reduce((t, i) => t + (product(i.productId)?.price ?? 0) * i.quantity, 0);
  return { list, discount, price: Math.max(0, list - discount) };
}

/** How many complete sets the stock (minus the cart) still covers. */
export function setsAvailable(
  items: SetItem[],
  product: (id: number) => Pick<Product, 'id' | 'stock' | 'archived'> | undefined,
  cart: CartLine[] = [],
): number {
  if (items.length === 0) return 0;
  let n = Number.MAX_SAFE_INTEGER;
  for (const i of items) {
    const p = product(i.productId);
    if (!p || p.archived) return 0;
    const held = cart.filter((l) => l.productId === p.id).reduce((s, l) => s + l.quantity, 0);
    n = Math.min(n, Math.floor(Math.max(0, p.stock - held) / i.quantity));
  }
  return n;
}

/** "متوفر 3 أطقم", "متوفر طقم واحد", "غير متوفر". */
export function availableText(n: number): string {
  if (n <= 0) return 'غير متوفر حالياً';
  if (n === 1) return 'متوفر طقم واحد';
  if (n === 2) return 'متوفر طقمان';
  return `متوفر ${n} أطقم`;
}
