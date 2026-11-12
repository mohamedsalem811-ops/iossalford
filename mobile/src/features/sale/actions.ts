import { Alert } from 'react-native';

import { addSet, addToCart, problemMessage, type CartProblem, type Result } from '@/domain/cart';
import type { Ctx } from '@/domain/context';
import { displayName, getProduct, type Product } from '@/domain/products';
import { getSet, setForCart } from '@/domain/sets';
import { getCart, putCart } from '@/state/cart';
import { haptic } from '@/lib/haptics';

/** Says why the cart did not change, with the piece's name (and size for scarves). */
export function showCartProblem(problem: CartProblem) {
  haptic.error();
  Alert.alert('لم تتم الإضافة', problemMessage(problem), [{ text: 'حسناً' }]);
}

function apply(ctx: Ctx, result: Result): boolean {
  if ('problem' in result) {
    showCartProblem(result.problem);
    return false;
  }
  putCart(ctx.system, result.cart);
  haptic.light();
  return true;
}

/**
 * Adds pieces to the system's cart, checked against the stock saved now (not the stock the
 * grid showed when it was drawn). False, with a message, when it can't be added.
 */
export function addPiece(ctx: Ctx, product: Product, quantity = 1, unitPrice?: number): boolean {
  const current = getProduct(ctx, product.id);
  const name = displayName(ctx, current ?? product);
  if (!current) {
    showCartProblem({ kind: 'missing', name });
    return false;
  }
  return apply(ctx, addToCart(getCart(ctx.system), current, name, quantity, unitPrice));
}

/** Adds one whole set, its discount spread over its pieces. */
export function addWholeSet(ctx: Ctx, setId: number): boolean {
  const set = getSet(ctx, setId);
  if (!set) {
    showCartProblem({ kind: 'missing', name: 'الطقم' });
    return false;
  }
  return apply(ctx, addSet(getCart(ctx.system), setForCart(ctx, set)));
}
