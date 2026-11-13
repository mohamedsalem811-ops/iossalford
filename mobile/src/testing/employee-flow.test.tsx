/**
 * The app as an employee (phase S2), on the real route files and a real (in-memory) database:
 * their own home screen, Management showing only what they may open, owner screens refusing
 * even when opened by link, a sale's details without cost, profit, delete or return, and
 * products with their price and stock only. The owner, the same screens: everything as before.
 */
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { ActionSheetIOS, Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import Home from '@/app/[system]/(tabs)/index';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import More from '@/app/[system]/(tabs)/more/index';
import ExpensesRoute from '@/app/[system]/(tabs)/more/expenses';
import LogRoute from '@/app/[system]/(tabs)/more/log';
import ReturnFindRoute from '@/app/[system]/(tabs)/more/return-find';
import ShiftRoute from '@/app/[system]/(tabs)/more/shift';
import ShiftReportRoute from '@/app/[system]/(tabs)/more/shift-report/[id]';
import ShiftsRoute from '@/app/[system]/(tabs)/more/shifts';
import CheckoutRoute from '@/app/[system]/checkout';
import ReturnRoute from '@/app/[system]/return/[id]';
import ReturnsRoute from '@/app/[system]/(tabs)/more/returns';
import SaleRoute from '@/app/[system]/(tabs)/more/sale/[id]';
import StaffRoute from '@/app/[system]/(tabs)/more/staff';
import ProductsStack from '@/app/[system]/(tabs)/products/_layout';
import Products from '@/app/[system]/(tabs)/products/index';
import ProductRoute from '@/app/[system]/product/[id]';
import { listActivity } from '@/domain/activity';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { getProduct, saveProduct } from '@/domain/products';
import { getSale } from '@/domain/sales';
import { setPolicies } from '@/domain/policies';
import { openShift, openShiftOf, shiftTotals } from '@/domain/shifts';
import { employeeStatement } from '@/domain/staff-ledger';
import * as device from '@/security/device';
import { putCart } from '@/state/cart';
import { clockGuard } from '@/staff/guards';
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
  '[system]/(tabs)/more/log': LogRoute,
  '[system]/(tabs)/more/return-find': ReturnFindRoute,
  '[system]/(tabs)/more/shift': ShiftRoute,
  '[system]/(tabs)/more/shifts': ShiftsRoute,
  '[system]/(tabs)/more/shift-report/[id]': ShiftReportRoute,
  '[system]/checkout': CheckoutRoute,
  '[system]/return/[id]': ReturnRoute,
  '[system]/(tabs)/products/_layout': ProductsStack,
  '[system]/(tabs)/products/index': Products,
  '[system]/product/[id]': ProductRoute,
};

function sell(actor: Actor, productId: number, qty = 1) {
  const p = getProduct(ctxAs(actor), productId)!;
  const cart = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  return checkout(ctxAs(actor), { cart, paymentMethod: 'cash' }).saleId;
}

let ring = 0;
let ownerSale = 0;
let herSale = 0;
beforeAll(() => {
  useStaffStore.setState((s) => ({
    staff: {
      ...s.staff,
      employees: [{ id: 's1', name: 'سارة', active: true, createdAt: '', mustChangePin: false }],
    },
  }));
  ring = saveProduct(ctxAs(OWNER), {
    name: 'Ring',
    sku: 'R-1',
    category: 'خواتم',
    price: 350_000,
    cost: 200_000,
    stock: 9,
  });
  ownerSale = sell(OWNER, ring, 2);
  openShift(ctxAs(SARA), 0);
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
    expect(screen.getByTestId('manage-returnFind')).toBeOnTheScreen();
    for (const shown of ['shift', 'customers', 'debts', 'settings'])
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
      'log',
      'policies',
      'shifts',
    ])
      expect(screen.queryByTestId(`manage-${hidden}`)).toBeNull();
  });

  it.each([
    ['/jewelry/more/expenses'],
    ['/jewelry/more/returns'],
    ['/jewelry/more/staff'],
    ['/jewelry/more/log'],
    ['/jewelry/more/shifts'],
    ['/jewelry/product/new'],
  ])('refuses %s even when opened by link', async (url) => {
    await renderRouter(routes, { initialUrl: url });
    expect(await screen.findByTestId('owner-only')).toBeOnTheScreen();
    expect(screen.getByText('للمالك فقط')).toBeOnTheScreen();
  });

  it('shows her sale without cost, profit or delete, and not the owner’s sale', async () => {
    await renderRouter(routes, { initialUrl: `/jewelry/more/sale/${herSale}` });
    expect(await screen.findByText('Ring × 1')).toBeOnTheScreen();
    expect(screen.queryByText('التكلفة')).toBeNull();
    expect(screen.queryByText('الربح')).toBeNull();
    expect(screen.queryByTestId('sale-delete')).toBeNull();
    // She may take a return within the rules (phase S4).
    expect(screen.getByText('إرجاع')).toBeOnTheScreen();
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

describe('as an employee, the S4 rules', () => {
  beforeEach(() => setActor(SARA));

  it('asks for a reason and the owner’s PIN for a discount over the limit, then sells', async () => {
    const owner = ctxAs(OWNER);
    setPolicies(owner, { discountPerPiece: 10_000, discountPerSale: 10_000 });
    const p = getProduct(owner, ring)!;
    const cart = (addToCart([], p, p.name, 1, 300_000) as { cart: CartLine[] }).cart;
    putCart('jewelry', cart);
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((o, pick) => pick(o.options.indexOf('زبون دائم')));
    jest.spyOn(device, 'faceIdStatus').mockResolvedValue('none');
    const verify = jest.spyOn(device.pinVault, 'verify').mockResolvedValue({ ok: true });
    const prompt = jest.spyOn(Alert, 'prompt').mockImplementation((_t, _m, buttons) => {
      if (Array.isArray(buttons)) buttons.find((b) => b.text === 'موافقة')?.onPress?.('19283746');
    });
    await renderRouter(routes, { initialUrl: '/jewelry/checkout' });
    expect(await screen.findByTestId('checkout-discount')).toHaveTextContent(
      '50 د.ل • يحتاج موافقة المالك',
    );
    await fireEvent.press(screen.getByTestId('checkout-confirm'));
    await waitFor(() => expect(verify).toHaveBeenCalledWith('jewelry', '19283746'));
    const sale = await waitFor(() => {
      const s = ctxAs(OWNER).db.get<{
        discount: number;
        discount_reason: string;
        approved_by: string;
      }>('SELECT discount, discount_reason, approved_by FROM sales ORDER BY id DESC LIMIT 1');
      expect(s?.discount).toBe(50_000);
      return s;
    });
    expect(sale).toMatchObject({ discount_reason: 'زبون دائم', approved_by: 'owner' });
    for (const m of [sheet, verify, prompt]) m.mockRestore();
  });

  it('finds the owner’s sale by its number for a return, with the refund fixed', async () => {
    await renderRouter(routes, { initialUrl: '/jewelry/more/return-find' });
    await fireEvent.changeText(await screen.findByTestId('return-find-text'), String(ownerSale));
    await fireEvent.press(screen.getByTestId('return-find'));
    const line = getSale(ctxAs(OWNER), ownerSale)!.lines[0];
    await fireEvent.press(await screen.findByTestId(`return-line-${line.id}`));
    expect(await screen.findByTestId('return-refund-fixed')).toHaveTextContent(
      'يُعاد للزبون 350 د.ل: ما دفعه',
    );
    expect(screen.queryByTestId('return-refund')).toBeNull();
    expect(screen.getByTestId('return-conditions')).toBeOnTheScreen();
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

  it('reads the activity log: who did what, by person', async () => {
    await renderRouter(routes, { initialUrl: '/jewelry/more/log' });
    expect(
      await screen.findByText(`بيعة رقم ${herSale}: 1 قطعة بـ 350 د.ل (كاش)`),
    ).toBeOnTheScreen();
    expect(screen.getByText(`بيعة رقم ${ownerSale}: 2 قطعة بـ 700 د.ل (كاش)`)).toBeOnTheScreen();
    // Her shift opening and her two sales (one with the owner's approval).
    expect(screen.getAllByText(/^سارة • /)).toHaveLength(3);
  });

  it('is told when the device clock went back, and can accept the device time', async () => {
    // The app once saw a time a day ahead of the device clock.
    clockGuard.accept(new Date(Date.now() + 24 * 3600_000));
    const alert = jest.spyOn(Alert, 'alert');
    await renderRouter(routes, { initialUrl: '/jewelry/more' });
    expect(await screen.findByTestId('manage-clock-behind')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('manage-accept-clock'));
    const buttons = alert.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
    await act(async () => buttons.find((b) => b.text === 'الوقت صحيح')?.onPress?.());
    await waitFor(() => expect(screen.queryByTestId('manage-clock-behind')).toBeNull());
    alert.mockRestore();
    expect(listActivity(ctxAs(OWNER), {}, { limit: 1 })[0]).toMatchObject({
      action: 'clock.accept',
      actorName: 'المالك',
    });
  });
});

/**
 * Presses a button of the last Alert.alert by its text. An async act: a sync one here leaves the
 * next test's render empty.
 */
async function pressAlert(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.calls.at(-1)?.[2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)?.onPress?.());
}

describe('the S5 shift', () => {
  it('lets her move cash and close with a blind count: 5 د.ل short', async () => {
    setActor(SARA);
    const before = openShiftOf(ctxAs(OWNER), 'emp-s1')!;
    await renderRouter(routes, { initialUrl: '/jewelry/more/shift' });
    expect(await screen.findByTestId('shift-open-card')).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId('shift-move-amount'), '20');
    await fireEvent.changeText(screen.getByTestId('shift-move-reason'), 'فكة');
    await fireEvent.press(screen.getByTestId('shift-cash-out'));
    expect(await screen.findByText('فكة')).toBeOnTheScreen();
    const { expected } = shiftTotals(ctxAs(OWNER), before);
    // Blind: the expected cash is not on the screen before the count.
    expect(screen.queryByTestId('shift-expected')).toBeNull();
    await fireEvent.changeText(
      screen.getByTestId('shift-counted'),
      String((expected - 5_000) / 1000),
    );
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByTestId('shift-close'));
    await pressAlert(alert, 'إغلاق');
    alert.mockRestore();
    expect(await screen.findByTestId('shift-difference')).toHaveTextContent(/عجز 5/);
    expect(screen.getByTestId('shift-open')).toBeOnTheScreen();
  });

  it('shows her the open-shift banner on the home screen', async () => {
    setActor(SARA);
    await renderRouter(routes, { initialUrl: '/jewelry' });
    expect(await screen.findByTestId('open-shift')).toBeOnTheScreen();
  });

  it('lets the owner read the report and put the shortage on her account', async () => {
    setActor(OWNER);
    const shift = ctxAs(OWNER).db.get<{ id: number }>(
      "SELECT id FROM shifts WHERE person = 'emp-s1' ORDER BY id DESC LIMIT 1",
    )!;
    await renderRouter(routes, { initialUrl: '/jewelry/more/shifts' });
    expect(await screen.findByTestId(`shift-${shift.id}-status`)).toHaveTextContent(/عجز 5/);
    await renderRouter(routes, { initialUrl: `/jewelry/more/shift-report/${shift.id}` });
    expect(await screen.findByTestId('report-person')).toHaveTextContent('سارة');
    const owed = employeeStatement(ctxAs(OWNER), 'emp-s1').balance;
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByTestId('report-charge'));
    await pressAlert(alert, 'تحميل');
    alert.mockRestore();
    expect(await screen.findByTestId('report-charged')).toBeOnTheScreen();
    expect(employeeStatement(ctxAs(OWNER), 'emp-s1').balance).toBe(owed + 5_000);
  });

  it('lets her open a new shift with the cash in the drawer', async () => {
    setActor(SARA);
    await renderRouter(routes, { initialUrl: '/jewelry/more/shift' });
    await fireEvent.changeText(await screen.findByTestId('shift-opening'), '100');
    await fireEvent.press(screen.getByTestId('shift-open'));
    expect(await screen.findByTestId('shift-open-card')).toBeOnTheScreen();
    expect(openShiftOf(ctxAs(OWNER), 'emp-s1')?.openingCash).toBe(100_000);
  });
});
