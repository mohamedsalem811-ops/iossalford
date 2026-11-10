/**
 * The open cart of each system, kept in memory while the app runs (not in the database: nothing
 * is sold until checkout). Each system has its own cart, so switching systems never mixes them.
 */
import { create } from 'zustand';

import type { CartLine } from '@/domain/cart';
import type { SystemId } from '@/theme';

type CartStore = {
  carts: Record<SystemId, CartLine[]>;
  setCart: (system: SystemId, cart: CartLine[]) => void;
};

export const useCartStore = create<CartStore>()((set) => ({
  carts: { jewelry: [], scarves: [] },
  setCart: (system, cart) => set((s) => ({ carts: { ...s.carts, [system]: cart } })),
}));

/** The system's cart and a setter; components re-render only when this system's cart changes. */
export function useCart(system: SystemId) {
  const cart = useCartStore((s) => s.carts[system]);
  const setCart = useCartStore((s) => s.setCart);
  return { cart, setCart: (next: CartLine[]) => setCart(system, next) };
}

/** Outside React (actions after an alert, checkout). */
export const getCart = (system: SystemId) => useCartStore.getState().carts[system];
export const putCart = (system: SystemId, cart: CartLine[]) =>
  useCartStore.getState().setCart(system, cart);
