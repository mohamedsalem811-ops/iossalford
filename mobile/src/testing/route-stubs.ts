/**
 * Every screen of a system as an empty stand-in, for flow tests that open only a few of them
 * (the system's stack names all its screens, and warns about any it can't find).
 */
const NAMES = [
  'brands',
  'manage-sets',
  'settings',
  'change-pin',
  'sales',
  'sale/[id]',
  'returns',
  'return/[id]',
  'set/[id]',
  'sets',
  'cart',
  'checkout',
  'sold/[id]',
  'receipt/[id]',
  'product/[id]',
  'photo/[id]',
  'design/[id]',
  'stock/[id]',
  'add/[id]',
  'sizes/[id]',
];

const Empty = () => null;

export const routeStubs: Record<string, () => null> = Object.fromEntries(
  NAMES.map((n) => [`[system]/${n}`, Empty]),
);
