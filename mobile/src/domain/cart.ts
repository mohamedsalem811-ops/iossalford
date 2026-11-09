/**
 * The cart is plain data held on screen (not in the database) until checkout. Every function
 * returns a new cart or a problem; a problem means nothing changed.
 */
import { divRound, split } from '@/lib/money';

import type { Product } from './products';

export type CartLine = {
  key: string;
  productId: number;
  /** Display name (scarves include the size). */
  name: string;
  quantity: number;
  /** Price per piece the customer pays, in dirhams. */
  unitPrice: number;
  /** Bundle lines carry the exact line total from the discount split, so totals add up to the dirham. */
  lineTotal?: number;
  setId?: number;
  setName?: string;
  bundleGroup?: string;
};

export type CartProblem =
  | { kind: 'empty' }
  | { kind: 'missing'; name: string }
  | { kind: 'stock'; name: string; requested: number; available: number }
  | { kind: 'quantity'; name: string }
  | { kind: 'credit-needs-customer' };

export function problemMessage(p: CartProblem): string {
  switch (p.kind) {
    case 'empty':
      return 'السلة فارغة';
    case 'missing':
      return `القطعة «${p.name}» لم تعد موجودة في المخزون (ربما حُذفت)`;
    case 'stock':
      return `«${p.name}»: المطلوب ${p.requested} والمتوفر ${p.available} فقط`;
    case 'quantity':
      return `«${p.name}»: الكمية يجب أن تكون 1 على الأقل`;
    case 'credit-needs-customer':
      return 'البيع الآجل يحتاج اسم الزبون أو رقم هاتفه لتسجيل الدين عليه';
  }
}

export type Result = { cart: CartLine[] } | { problem: CartProblem };

let seq = 0;
const newKey = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export const lineTotal = (l: CartLine) => l.lineTotal ?? l.unitPrice * l.quantity;
export const cartTotal = (cart: CartLine[]) => cart.reduce((s, l) => s + lineTotal(l), 0);
export const cartPieces = (cart: CartLine[]) => cart.reduce((s, l) => s + l.quantity, 0);

/** Pieces of a product already in the cart (all its lines). */
export const inCart = (cart: CartLine[], productId: number) =>
  cart.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);

/**
 * Adds a piece if stock covers what is already in the cart plus this quantity. The same piece at
 * the same price (outside a bundle) merges into one line.
 */
export function addToCart(
  cart: CartLine[],
  product: Product,
  name: string,
  quantity: number,
  unitPrice = product.price,
): Result {
  if (!Number.isInteger(quantity) || quantity < 1) return { problem: { kind: 'quantity', name } };
  if (product.archived) return { problem: { kind: 'missing', name } };
  const requested = inCart(cart, product.id) + quantity;
  if (requested > product.stock)
    return { problem: { kind: 'stock', name, requested, available: product.stock } };
  const same = cart.find(
    (l) => l.productId === product.id && l.unitPrice === unitPrice && !l.bundleGroup,
  );
  if (same)
    return { cart: cart.map((l) => (l === same ? { ...l, quantity: l.quantity + quantity } : l)) };
  return { cart: [...cart, { key: newKey(), productId: product.id, name, quantity, unitPrice }] };
}

/** Changes a line's quantity, checking stock across the whole cart. Bundle lines can't change. */
export function setQuantity(
  cart: CartLine[],
  key: string,
  quantity: number,
  stock: number,
): Result {
  const line = cart.find((l) => l.key === key);
  if (!line || line.bundleGroup) return { cart };
  if (!Number.isInteger(quantity) || quantity < 1)
    return { problem: { kind: 'quantity', name: line.name } };
  const requested = inCart(cart, line.productId) - line.quantity + quantity;
  if (requested > stock)
    return { problem: { kind: 'stock', name: line.name, requested, available: stock } };
  return { cart: cart.map((l) => (l.key === key ? { ...l, quantity } : l)) };
}

/** Changes the price the customer pays per piece (a negotiated price). Bundle lines can't change. */
export function setUnitPrice(cart: CartLine[], key: string, unitPrice: number): CartLine[] {
  if (!Number.isInteger(unitPrice) || unitPrice < 0) return cart;
  return cart.map((l) => (l.key === key && !l.bundleGroup ? { ...l, unitPrice } : l));
}

/** Removes a line; a line of a bundle removes the whole bundle. */
export function removeLine(cart: CartLine[], key: string): CartLine[] {
  const line = cart.find((l) => l.key === key);
  if (!line) return cart;
  return line.bundleGroup
    ? cart.filter((l) => l.bundleGroup !== line.bundleGroup)
    : cart.filter((l) => l.key !== key);
}

export type SetForCart = {
  id: number;
  name: string;
  discount: number;
  /** product is undefined when a piece of the set no longer exists. */
  items: { product: Product | undefined; name: string; quantity: number }[];
};

/**
 * Adds one complete set. The discount is spread over its pieces in proportion to their prices,
 * so every line (and the receipt) carries the real price paid and the lines add up exactly to
 * the set price.
 */
export function addSet(cart: CartLine[], set: SetForCart): Result {
  const items = set.items.filter((i) => i.quantity > 0);
  if (items.length === 0) return { problem: { kind: 'empty' } };
  const pieces: { product: Product; name: string; quantity: number }[] = [];
  for (const i of items) {
    if (!i.product || i.product.archived) {
      return { problem: { kind: 'missing', name: `قطعة من طقم «${set.name}»` } };
    }
    const requested = inCart(cart, i.product.id) + i.quantity;
    if (requested > i.product.stock) {
      return { problem: { kind: 'stock', name: i.name, requested, available: i.product.stock } };
    }
    pieces.push({ product: i.product, name: i.name, quantity: i.quantity });
  }
  const lists = pieces.map((i) => i.product.price * i.quantity);
  const list = lists.reduce((a, b) => a + b, 0);
  const discount = Math.min(Math.max(0, set.discount), list);
  const totals = split(list - discount, lists);
  const group = newKey();
  return {
    cart: [
      ...cart,
      ...pieces.map((i, n) => ({
        key: newKey(),
        productId: i.product.id,
        name: i.name,
        quantity: i.quantity,
        unitPrice: divRound(totals[n], i.quantity),
        lineTotal: totals[n],
        setId: set.id,
        setName: set.name,
        bundleGroup: group,
      })),
    ],
  };
}

/**
 * Checks every line against the CURRENT stock (it may have changed since the piece was added).
 * Lines of the same product are added together.
 */
export function cartProblems(
  cart: CartLine[],
  current: (productId: number) => Product | undefined,
): CartProblem[] {
  if (cart.length === 0) return [{ kind: 'empty' }];
  const problems: CartProblem[] = [];
  for (const id of new Set(cart.map((l) => l.productId))) {
    const lines = cart.filter((l) => l.productId === id);
    const p = current(id);
    if (!p || p.archived) {
      problems.push({ kind: 'missing', name: lines[0].name });
      continue;
    }
    if (lines.some((l) => !Number.isInteger(l.quantity) || l.quantity < 1)) {
      problems.push({ kind: 'quantity', name: lines[0].name });
      continue;
    }
    const requested = inCart(cart, id);
    if (requested > p.stock)
      problems.push({ kind: 'stock', name: lines[0].name, requested, available: p.stock });
  }
  return problems;
}
