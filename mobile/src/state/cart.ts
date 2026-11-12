/**
 * The open cart of each system (not in the database: nothing is sold until checkout). Each system
 * has its own cart, so switching systems never mixes them. The cart is also kept in a small file
 * in the app's private folder, so a half-built sale survives iOS closing the app in the background
 * (a phone call, the camera). Checkout checks every line against the stock again.
 */
import { File } from 'expo-file-system';
import { create } from 'zustand';

import type { CartLine } from '@/domain/cart';
import { privateRoot } from '@/lib/storage';
import type { SystemId } from '@/theme';

const cartFile = (system: SystemId) => new File(privateRoot(), `cart-${system}.json`);

/** The cart kept from the last run, or empty (no file, or a file that can't be read). */
export function readSavedCart(system: SystemId): CartLine[] {
  try {
    const f = cartFile(system);
    if (!f.exists) return [];
    const lines = JSON.parse(f.textSync()) as unknown;
    return Array.isArray(lines)
      ? lines.filter(
          (l): l is CartLine =>
            !!l &&
            typeof l === 'object' &&
            typeof (l as CartLine).key === 'string' &&
            typeof (l as CartLine).productId === 'number' &&
            typeof (l as CartLine).quantity === 'number' &&
            typeof (l as CartLine).unitPrice === 'number',
        )
      : [];
  } catch {
    return [];
  }
}

function keepCart(system: SystemId, cart: CartLine[]) {
  try {
    const f = cartFile(system);
    if (cart.length === 0) {
      if (f.exists) f.delete();
    } else f.writeSync(JSON.stringify(cart));
  } catch {
    // Only a convenience: the cart in memory is still right.
  }
}

type CartStore = {
  carts: Record<SystemId, CartLine[]>;
  setCart: (system: SystemId, cart: CartLine[]) => void;
};

export const useCartStore = create<CartStore>()((set) => ({
  carts: { jewelry: readSavedCart('jewelry'), scarves: readSavedCart('scarves') },
  setCart: (system, cart) => {
    keepCart(system, cart);
    set((s) => ({ carts: { ...s.carts, [system]: cart } }));
  },
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
