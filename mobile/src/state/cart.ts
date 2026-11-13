/**
 * The open cart of each system and person (not in the database: nothing is sold until checkout).
 * Each system and each person has their own cart, so switching systems or users never mixes
 * them, and nobody sees another person's cart. The cart is also kept in a small file
 * in the app's private folder, so a half-built sale survives iOS closing the app in the background
 * (a phone call, the camera). Checkout checks every line against the stock again.
 */
import { File } from 'expo-file-system';
import { create } from 'zustand';

import type { CartLine } from '@/domain/cart';
import { privateRoot } from '@/lib/storage';
import type { SystemId } from '@/theme';

import { currentActorKey } from './session';

/** The cart of a system for the person signed in: "jewelry:owner", "scarves:emp-<id>". */
const cartKey = (system: SystemId) => `${system}:${currentActorKey()}`;
/** The owner keeps the file name used before employees existed, so an open cart survives. */
const fileName = (key: string) =>
  key.endsWith(':owner') ? `cart-${key.split(':')[0]}.json` : `cart-${key.replace(':', '-')}.json`;
const cartFile = (key: string) => new File(privateRoot(), fileName(key));

/** The cart kept from the last run, or empty (no file, or a file that can't be read). */
export function readSavedCart(key: string): CartLine[] {
  try {
    const f = cartFile(key);
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

function keepCart(key: string, cart: CartLine[]) {
  try {
    const f = cartFile(key);
    if (cart.length === 0) {
      if (f.exists) f.delete();
    } else f.writeSync(JSON.stringify(cart));
  } catch {
    // Only a convenience: the cart in memory is still right.
  }
}

type CartStore = {
  carts: Record<string, CartLine[]>;
  setCart: (system: SystemId, cart: CartLine[]) => void;
};

export const useCartStore = create<CartStore>()((set) => ({
  carts: {},
  setCart: (system, cart) => {
    const key = cartKey(system);
    keepCart(key, cart);
    set((s) => ({ carts: { ...s.carts, [key]: cart } }));
  },
}));

/** Each saved cart, read from its file the first time it is needed (the same array after). */
const saved = new Map<string, CartLine[]>();
function savedCart(key: string): CartLine[] {
  if (!saved.has(key)) saved.set(key, readSavedCart(key));
  return saved.get(key)!;
}

/** The system's cart and a setter; components re-render only when this cart changes. */
export function useCart(system: SystemId) {
  const key = cartKey(system);
  const cart = useCartStore((s) => s.carts[key] ?? savedCart(key));
  const setCart = useCartStore((s) => s.setCart);
  return { cart, setCart: (next: CartLine[]) => setCart(system, next) };
}

/** Outside React (actions after an alert, checkout). */
export const getCart = (system: SystemId) => {
  const key = cartKey(system);
  return useCartStore.getState().carts[key] ?? savedCart(key);
};
export const putCart = (system: SystemId, cart: CartLine[]) =>
  useCartStore.getState().setCart(system, cart);
