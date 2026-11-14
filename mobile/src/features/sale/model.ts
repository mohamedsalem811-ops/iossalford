/** Pure rules of the sale screen: what the grid shows, cart groups, totals and the forms. */
import { cartTotal, cartPieces, lineTotal, problemMessage, type CartLine } from '@/domain/cart';
import type { PaymentMethod } from '@/domain/checkout';
import { hasIdentity } from '@/domain/customers';
import type { Product } from '@/domain/products';
import type { ScarfDesign } from '@/domain/scarves';
import { latinDigits, parseInteger, parseThousandths } from '@/lib/digits';
import { lydToUsd, formatDinars } from '@/lib/money';
import { applyQuery, DEFAULT_QUERY, type BrandFilter } from '@/features/products/model';
import { applyDesignQuery, DEFAULT_DESIGN_QUERY } from '@/features/scarves/model';
import type { SystemId } from '@/theme';

export type SaleQuery = { search: string; brand: BrandFilter; category: string };
export const DEFAULT_SALE_QUERY: SaleQuery = { search: '', brand: 'all', category: '' };

/** A tile of the grid: a jewelry piece, or a scarf design that opens its size picker. */
export type SaleItem =
  | { kind: 'piece'; key: string; product: Product }
  | { kind: 'design'; key: string; design: ScarfDesign };

/** The tiles for a search and filters, by name. Pieces that are out of stock still show. */
export function saleItems(system: SystemId, products: Product[], q: SaleQuery): SaleItem[] {
  if (system === 'scarves') {
    return applyDesignQuery(products, { ...DEFAULT_DESIGN_QUERY, ...q }).map((design) => ({
      kind: 'design',
      key: design.id,
      design,
    }));
  }
  return applyQuery(products, { ...DEFAULT_QUERY, ...q }).map((product) => ({
    kind: 'piece',
    key: String(product.id),
    product,
  }));
}

/** Stock still free to add: the stock minus what the cart already holds. */
export function freeStock(stock: number, cart: CartLine[], productId: number): number {
  const held = cart.filter((l) => l.productId === productId).reduce((s, l) => s + l.quantity, 0);
  return Math.max(0, stock - held);
}

/** The cart as shown: single lines, and each set as one group that is removed as a whole. */
export type CartGroup =
  | { kind: 'line'; key: string; line: CartLine }
  | { kind: 'set'; key: string; name: string; lines: CartLine[]; total: number };

export function cartGroups(cart: CartLine[]): CartGroup[] {
  const groups: CartGroup[] = [];
  for (const line of cart) {
    if (!line.bundleGroup) {
      groups.push({ kind: 'line', key: line.key, line });
      continue;
    }
    const found = groups.find((g) => g.kind === 'set' && g.key === line.bundleGroup);
    if (found && found.kind === 'set') {
      found.lines.push(line);
      found.total += lineTotal(line);
    } else {
      groups.push({
        kind: 'set',
        key: line.bundleGroup,
        name: line.setName ?? 'طقم',
        lines: [line],
        total: lineTotal(line),
      });
    }
  }
  return groups;
}

export type CartTotals = { total: number; usd: number; pieces: number };

/** Total in dirhams, in US cents at today's rate, and the number of pieces. */
export function cartTotals(cart: CartLine[], rate: number): CartTotals {
  const total = cartTotal(cart);
  return { total, usd: lydToUsd(total, rate), pieces: cartPieces(cart) };
}

/**
 * Stock problems of the cart against the current stock (it may change while the cart is open),
 * as one message per product id.
 */
export function stockWarnings(
  cart: CartLine[],
  current: (productId: number) => Product | undefined,
): Map<number, string> {
  const warnings = new Map<number, string>();
  for (const id of new Set(cart.map((l) => l.productId))) {
    const lines = cart.filter((l) => l.productId === id);
    const name = lines[0].name;
    const p = current(id);
    if (!p || p.archived) {
      warnings.set(id, problemMessage({ kind: 'missing', name }));
      continue;
    }
    const requested = lines.reduce((s, l) => s + l.quantity, 0);
    if (requested > p.stock)
      warnings.set(id, problemMessage({ kind: 'stock', name, requested, available: p.stock }));
  }
  return warnings;
}

/** The long-press sheet: quantity and price typed, checked against the free stock. */
export function checkAddForm(
  quantityText: string,
  priceText: string,
  free: number,
): { ok: true; quantity: number; unitPrice: number } | { ok: false; message: string } {
  const quantity = parseInteger(quantityText);
  if (quantity === null || quantity < 1)
    return { ok: false, message: 'الكمية يجب أن تكون 1 على الأقل' };
  if (quantity > free)
    return {
      ok: false,
      message: free === 0 ? 'لا يوجد مخزون متاح لهذه القطعة' : `المتوفر ${free} فقط`,
    };
  const unitPrice = parseThousandths(priceText);
  if (unitPrice === null) return { ok: false, message: 'اكتب سعر القطعة' };
  return { ok: true, quantity, unitPrice };
}

export type CheckoutForm = {
  method: PaymentMethod;
  name: string;
  phone: string;
  area: string;
  note: string;
};

export const emptyCheckoutForm = (): CheckoutForm => ({
  method: 'cash',
  name: '',
  phone: '',
  area: '',
  note: '',
});

/** Why the checkout can't go ahead yet, or null. */
export function checkoutProblem(f: CheckoutForm, cart: CartLine[]): string | null {
  if (cart.length === 0) return 'السلة فارغة';
  if (f.method === 'credit' && !hasIdentity(f.name, f.phone))
    return 'البيع الآجل يحتاج اسم الزبون أو رقم هاتفه لتسجيل الدين عليه';
  return null;
}

/**
 * What a sale on credit does to a customer the shop owes (له رصيد): the credit pays for it, and
 * either some credit is left or the rest becomes a debt. Null when the customer has no credit.
 */
export function creditUse(
  credit: number,
  total: number,
): { used: number; left: number; owed: number } | null {
  if (credit <= 0) return null;
  const used = Math.min(credit, total);
  return { used, left: credit - used, owed: total - used };
}

/**
 * A gentle note when a piece is priced below what it cost (a typo, or a deliberate loss), or null.
 * A free piece (price 0) and a piece with no known cost get no note.
 */
export function belowCostNote(unitPrice: number, cost: number): string | null {
  if (cost <= 0 || unitPrice <= 0 || unitPrice >= cost) return null;
  return `أقل من التكلفة (${formatDinars(cost)} د.ل)`;
}

/** Points for a share of the sale ("20%" of what is left to pay), never more than allowed. */
export const pointsForShare = (total: number, percent: number, pointValue: number, most: number) =>
  Math.min(most, Math.floor((total * percent) / 100 / pointValue));

/** The points typed at checkout, as a whole number from 0 to the most allowed. */
export function typedPoints(text: string, most: number): number {
  const n = Number(latinDigits(text).trim());
  return Number.isInteger(n) && n > 0 ? Math.min(n, most) : 0;
}
