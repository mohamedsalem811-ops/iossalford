/**
 * The app as an employee (phase S2), on the real route files and a real (in-memory) database:
 * their own home screen, Management showing only what they may open, owner screens refusing
 * even when opened by link, a sale's details without cost, profit, delete or return, and
 * products with their price and stock only. The owner, the same screens: everything as before.
 */
import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import Home from '@/app/[system]/(tabs)/index';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import More from '@/app/[system]/(tabs)/more/index';
import ExpensesRoute from '@/app/[system]/(tabs)/more/expenses';
import ReturnsRoute from '@/app/[system]/(tabs)/more/returns';
import SaleRoute from '@/app/[system]/(tabs)/more/sale/[id]';
import StaffRoute from '@/app/[system]/(tabs)/more/staff';
import ProductsStack from '@/app/[system]/(tabs)/products/_layout';
import Products from '@/app/[system]/(tabs)/products/index';
import ProductRoute from '@/app/[system]/product/[id]';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { getProduct, saveProduct } from '@/domain/products';
import { OWNER, type Actor } from '@/staff/model';
import { useStaffStore } from '@/staff/store';
import { setActor } from '@/state/session';
import { routeStubs } from '@/testing/route-stubs';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('@expo/ui/swift-ui', () => ({ Host: () => null, Chart: () => null }));
jest.mock('expo-router/native-tabs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  const { Slot } = require('expo-router');
  const Trigger = Object.assign(() => null, {
    Label: () => null,
    Icon: () => null,
    Badge: () => null,
  });
  const BottomAccessory = Object.assign(() => null, { usePlacement: () => 'regular' });
  return { NativeTabs: Object.assign(() => <Slot />, { Trigger, BottomAccessory }) };
});
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({
    children,
    renderLeftActions,
    renderRightActions,
  }: {
    children: React.ReactNode;
    renderLeftActions?: () => React.ReactNode;
    renderRightActions?: () => React.ReactNode;
  }) => (
    <>
      {renderRightActions?.()}
      {children}
      {renderLeftActions?.()}
    </>
  ),
}));
jest.mock('@/hooks/use-layout', () => ({
  ...jest.requireActual('@/hooks/use-layout'),
  useLayout: () => ({ split: false, cartBeside: false, dashboardColumns: 1 }),
}));
jest.mock('@/state/lock', () => ({
  LockProvider: ({ children }: { children: React.ReactNode }) => children,
  useLock: () => ({ unlocked: 'jewelry', unlock: () => {}, lock: () => {}, active: true }),
}));
jest.mock('@/db/manager', () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports */
  const { openMemoryDb } = require('@/db/testing/node-db');
  const { migrate } = require('@/db/migrate');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const dbs = new Map();
  const open = (system: string) => {
    if (!dbs.has(system)) {
      const db = openMemoryDb();
      migrate(db);
      dbs.set(system, db);
    }
    return { status: 'ok', db: dbs.get(system) };
  };
  return { openSystemDb: open, setAsideUnreadable: jest.fn() };
});

const SARA: Actor = { kind: 'employee', id: 's1', name: 'سارة' };

const ctxAs = (actor: Actor): Ctx => ({
  db: jest.requireMock('@/db/manager').openSystemDb('jewelry').db,
  system: 'jewelry',
  now: () => new Date(),
  actor,
});

const routes = {
  ...routeStubs,
  _layout: RootLayout,
  index: () => null,
  '[system]/_layout': SystemLayout,
  '[system]/(tabs)/_layout': TabsLayout,
  '[system]/(tabs)/index': Home,
  '[system]/(tabs)/more/_layout': ManagementLayout,
  '[system]/(tabs)/more/index': More,
  '[system]/(tabs)/more/sale/[id]': SaleRoute,
  '[system]/(tabs)/more/returns': ReturnsRoute,
  '[system]/(tabs)/more/expenses': ExpensesRoute,
  '[system]/(tabs)/more/staff': StaffRoute,
  '[system]/(tabs)/products/_layout': ProductsStack,
  '[system]/(tabs)/products/index': Products,
  '[system]/product/[id]': ProductRoute,
};

function sell(actor: Actor, productId: number, qty = 1) {
  const p = getProduct(ctxAs(actor), productId)!;
  const cart = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  return checkout(ctxAs(actor), { cart, paymentMethod: 'cash' }).saleId;
}

let ownerSale = 0;
let herSale = 0;
beforeAll(() => {
  useStaffStore.setState((s) => ({
    staff: {
      ...s.staff,
      employees: [{ id: 's1', name: 'سارة', active: true, createdAt: '', mustChangePin: false }],
    },
  }));
  const ring = saveProduct(ctxAs(OWNER), {
    name: 'Ring',
    sku: 'R-1',
    category: 'خواتم',
    price: 350_000,
    cost: 200_000,
    stock: 9,
  });
  ownerSale = sell(OWNER, ring, 2);
  herSale = sell(SARA, ring);
});

describe('as an employee', () => {
  beforeEach(() => setActor(SARA));

  it('shows her own sales on the home screen, and no shop totals', async () => {
    await renderRouter(routes, { initialUrl: '/jewelry' });
    expect(await screen.findByText('أهلاً، سارة')).toBeOnTheScreen();
    expect(screen.getByTestId('my-today-total')).toHaveTextContent(/350/);
    expect(screen.getByTestId(`latest-${herSale}`)).toBeOnTheScreen();
    expect(screen.queryByTestId(`latest-${ownerSale}`)).toBeNull();
    // No profit, no month summary, no "new piece" shortcut.
    expect(screen.queryByText('الربح')).toBeNull();
    expect(screen.queryByTestId('today-total')).toBeNull();
    expect(screen.queryByTestId('quick-product')).toBeNull();
    expect(screen.getByTestId('quick-sale')).toBeOnTheScreen();
  });

  it('lists in Management only what she may open', async () => {
    await renderRouter(routes, { initialUrl: '/jewelry/more' });
    expect(await screen.findByTestId('manage-sales')).toBeOnTheScreen();
    for (const shown of ['customers', 'debts', 'settings'])
      expect(screen.getByTestId(`manage-${shown}`)).toBeOnTheScreen();
    for (const hidden of [
      'returns',
      'expenses',
      'closing',
      'comparison',
      'brands',
      'sets',
      'archived',
      'backup',
      'staff',
    ])
      expect(screen.queryByTestId(`manage-${hidden}`)).toBeNull();
  });

  it.each([
    ['/jewelry/more/expenses'],
    ['/jewelry/more/returns'],
    ['/jewelry/more/staff'],
    ['/jewelry/product/new'],
  ])('refuses %s even when opened by link', async (url) => {
    await renderRouter(routes, { initialUrl: url });
    expect(await screen.findByTestId('owner-only')).toBeOnTheScreen();
    expect(screen.getByText('للمالك فقط')).toBeOnTheScreen();
  });

  it('shows her sale without cost, profit, delete or return, and not the owner’s sale', async () => {
    await renderRouter(routes, { initialUrl: `/jewelry/more/sale/${herSale}` });
    expect(await screen.findByText('Ring × 1')).toBeOnTheScreen();
    expect(screen.queryByText('التكلفة')).toBeNull();
    expect(screen.queryByText('الربح')).toBeNull();
    expect(screen.queryByTestId('sale-delete')).toBeNull();
    expect(screen.queryByText('إرجاع')).toBeNull();
  });

  it('cannot open the owner’s sale', async () => {
    await renderRouter(routes, { initialUrl: `/jewelry/more/sale/${ownerSale}` });
    expect(await screen.findByText('البيعة غير موجودة')).toBeOnTheScreen();
  });

  it('shows products with their price and stock only', async () => {
    await renderRouter(routes, { initialUrl: '/jewelry/products' });
    expect(await screen.findByTestId('product-R-1')).toBeOnTheScreen();
    expect(screen.queryByText(/تكلفة/)).toBeNull();
    // No stock or edit swipe buttons.
    expect(screen.queryByText('مخزون')).toBeNull();
    expect(screen.queryByText('حذف')).toBeNull();
  });
});

describe('as the owner', () => {
  beforeEach(() => setActor(OWNER));

  it('sees everything as before', async () => {
    await renderRouter(routes, { initialUrl: `/jewelry/more/sale/${herSale}` });
    expect(await screen.findByText('الربح')).toBeOnTheScreen();
    expect(screen.getByTestId('sale-delete')).toBeOnTheScreen();
    expect(screen.getByTestId('sale-seller')).toHaveTextContent('البائع: سارة');
  });

  it('opens owner screens and lists every section', async () => {
    await renderRouter(routes, { initialUrl: '/jewelry/more' });
    expect(await screen.findByTestId('manage-staff')).toBeOnTheScreen();
    expect(screen.getByTestId('manage-expenses')).toBeOnTheScreen();
    expect(screen.getByTestId('manage-backup')).toBeOnTheScreen();
  });

  it('shows the product cost', async () => {
    await renderRouter(routes, { initialUrl: '/jewelry/products' });
    expect(await screen.findAllByText(/تكلفة/)).not.toHaveLength(0);
  });
});
