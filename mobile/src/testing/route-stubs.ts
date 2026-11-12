/**
 * Every screen of a system as an empty stand-in, for flow tests that open only a few of them
 * (the system's stack names all its screens, and warns about any it can't find).
 */
const NAMES = [
  '(tabs)/more/index',
  '(tabs)/more/brands',
  '(tabs)/more/manage-sets',
  '(tabs)/more/settings',
  'change-pin',
  '(tabs)/more/sales',
  '(tabs)/more/sale/[id]',
  '(tabs)/more/returns',
  '(tabs)/more/customers',
  '(tabs)/more/customer/[id]',
  '(tabs)/more/debts',
  'customer-form/[id]',
  'payment/[id]',
  '(tabs)/more/expenses',
  '(tabs)/more/closing',
  '(tabs)/more/comparison',
  '(tabs)/more/backup',
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
