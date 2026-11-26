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
import StockCountRoute from '@/app/[system]/(tabs)/more/stock-count';
import CountRoute from '@/app/[system]/(tabs)/more/count/[id]';
import DeviceGuideRoute from '@/app/[system]/(tabs)/more/device-guide';
import CheckoutRoute from '@/app/[system]/checkout';
import ReturnRoute from '@/app/[system]/return/[id]';
import ReturnsRoute from '@/app/[system]/(tabs)/more/returns';
import SaleRoute from '@/app/[system]/(tabs)/more/sale/[id]';
import StaffRoute from '@/app/[system]/(tabs)/more/staff';
import ProductsStack from '@/app/[system]/(tabs)/products/_layout';
import Products from '@/app/[system]/(tabs)/products/index';
import SaleStack from '@/app/[system]/(tabs)/sale/_layout';
import SaleTab from '@/app/[system]/(tabs)/sale/index';
import OrderBuyRoute from '@/app/[system]/order-buy/[id]';
import ProductRoute from '@/app/[system]/product/[id]';
import ReceiptRoute from '@/app/[system]/receipt/[id]';
import { listActivity, recordWrongPin } from '@/domain/activity';
import { ownerAlerts } from '@/domain/alerts';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { getProduct, saveProduct } from '@/domain/products';
import { receiptForSale } from '@/domain/receipts';
import { getSale } from '@/domain/sales';
import { setPolicies } from '@/domain/policies';
import { openShift, openShiftOf, shiftTotals } from '@/domain/shifts';
import { employeeStatement } from '@/domain/staff-ledger';
import { openCount, startCount } from '@/domain/stock-count';
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
// The native segmented control is replaced by plain buttons so the test can switch it.
jest.mock('@expo/ui/community/segmented-control', () => ({
  __esModule: true,
  default: ({
    values,
    onChange,
    testID,
  }: {
    testID?: string;
    values: string[];
    onChange: (e: { nativeEvent: { selectedSegmentIndex: number; value: string } }) => void;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
    const { Pressable, Text: RNText, View } = require('react-native');
    return (
      <View testID={testID}>
        {values.map((v, i) => (
          <Pressable
            key={v}
            accessibilityRole="button"
            onPress={() => onChange({ nativeEvent: { selectedSegmentIndex: i, value: v } })}>
            <RNText>{v}</RNText>
          </Pressable>
        ))}
      </View>
    );
  },
}));
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
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  openOutside: (url: string) => require('react-native').Linking.openURL(url),
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
  '[system]/(tabs)/more/stock-count': StockCountRoute,
  '[system]/(tabs)/more/count/[id]': CountRoute,
  '[system]/(tabs)/more/device-guide': DeviceGuideRoute,
  '[system]/checkout': CheckoutRoute,
  '[system]/return/[id]': ReturnRoute,
  '[system]/(tabs)/products/_layout': ProductsStack,
  '[system]/(tabs)/products/index': Products,
  '[system]/product/[id]': ProductRoute,
  '[system]/order-buy/[id]': OrderBuyRoute,
  '[system]/receipt/[id]': ReceiptRoute,
  '[system]/(tabs)/sale/_layout': SaleStack,
  '[system]/(tabs)/sale/index': SaleTab,
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
    for (const shown of ['shift', 'stockCount', 'customers', 'debts', 'settings'])
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
      'daySummary',
      'deviceGuide',
    ])
      expect(screen.queryByTestId(`manage-${hidden}`)).toBeNull();
  });

  it.each([
    ['/jewelry/more/expenses'],
    ['/jewelry/more/returns'],
    ['/jewelry/more/staff'],
    ['/jewelry/more/log'],
    ['/jewelry/more/shifts'],
    ['/jewelry/more/device-guide'],
    ['/jewelry/more/count/1'],
    ['/jewelry/product/new'],
    // The full check before 10.0: the supplier purchase (its cost) is the owner's.
    ['/jewelry/order-buy/1'],
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

  it('opens her sale’s receipt with its pieces and customer fixed (audit 11)', async () => {
    const r = receiptForSale(ctxAs(SARA), herSale)!;
    await renderRouter(routes, { initialUrl: `/jewelry/receipt/${r.id}` });
    expect(await screen.findByTestId('studio-items-fixed')).toBeOnTheScreen();
    expect(screen.getByTestId('studio-fixed-0')).toHaveTextContent(/Ring × 1/);
    expect(screen.getByTestId('studio-customer-fixed')).toBeOnTheScreen();
    for (const editable of ['studio-customer', 'studio-name-0', 'studio-price-0', 'studio-add'])
      expect(screen.queryByTestId(editable)).toBeNull();
    // How it looks is still hers to choose.
    expect(screen.getByTestId('studio-type')).toBeOnTheScreen();
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

  it('sells on credit only with the owner’s credit code (rule B)', async () => {
    const owner = ctxAs(OWNER);
    const p = getProduct(owner, ring)!;
    putCart('jewelry', (addToCart([], p, p.name, 1) as { cart: CartLine[] }).cart);
    const has = jest.spyOn(device.pinVault, 'hasPin').mockResolvedValue(true);
    const verify = jest.spyOn(device.pinVault, 'verify').mockResolvedValue({ ok: true });
    const prompt = jest.spyOn(Alert, 'prompt').mockImplementation((_t, _m, buttons) => {
      if (Array.isArray(buttons)) buttons.find((b) => b.text === 'موافقة')?.onPress?.('4071');
    });
    const before = owner.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sales')!.n;
    await renderRouter(routes, { initialUrl: '/jewelry/checkout' });
    await fireEvent.press(await screen.findByText('آجل'));
    await fireEvent.changeText(screen.getByTestId('checkout-name'), 'منى');
    await fireEvent.changeText(screen.getByTestId('checkout-phone'), '0912345678');
    await fireEvent.press(screen.getByTestId('checkout-confirm'));
    await waitFor(() => expect(verify).toHaveBeenCalledWith('code.credit', '4071'));
    await waitFor(() =>
      expect(owner.db.get<{ n: number }>('SELECT COUNT(*) AS n FROM sales')!.n).toBe(before + 1),
    );
    const last = owner.db.get<{ payment_method: string }>(
      'SELECT payment_method FROM sales ORDER BY id DESC LIMIT 1',
    );
    expect(last?.payment_method).toBe('credit');
    // The use of the code is in the owner's log, never the code itself.
    const logged = owner.db.get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM activity WHERE action = 'code.credit'",
    )!.n;
    expect(logged).toBe(1);
    for (const m of [has, verify, prompt]) m.mockRestore();
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
    // Her shift opening, her three sales (one with the owner's approval, one on credit) and the
    // credit code she used.
    expect(screen.getAllByText(/^سارة • /)).toHaveLength(5);
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

  it('shows her the closed shift at the top of the home screen, and locks selling (I3)', async () => {
    setActor(SARA);
    await renderRouter(routes, { initialUrl: '/jewelry' });
    expect(await screen.findByTestId('open-shift')).toHaveTextContent(/الوردية مغلقة/);
    // Her shortcuts: deposit, return, debt payment, customer; the receipt and new piece are the
    // owner's second row.
    for (const id of [
      'quick-sale',
      'quick-order',
      'quick-return',
      'quick-payment',
      'quick-customer',
    ])
      expect(screen.getByTestId(id)).toBeOnTheScreen();
    for (const id of ['quick-receipt', 'quick-product'])
      expect(screen.queryByTestId(id)).toBeNull();
    await renderRouter(routes, { initialUrl: '/jewelry/sale' });
    expect(await screen.findByTestId('sale-locked')).toBeOnTheScreen();
    expect(screen.getByText('البيع مقفل حتى تفتح الوردية')).toBeOnTheScreen();
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
    // The bar says since when (or, after the owner's hour, that it is time to close), and the
    // sale tab opens again.
    await renderRouter(routes, { initialUrl: '/jewelry' });
    expect(await screen.findByTestId('shift-bar')).toHaveTextContent(
      /الوردية مفتوحة منذ|حان وقت إغلاق الوردية/,
    );
    await renderRouter(routes, { initialUrl: '/jewelry/sale' });
    expect(screen.queryByTestId('sale-locked')).toBeNull();
  });
});

describe('the S6 stock count and alerts', () => {
  it('lets her count blind and send the count to the owner', async () => {
    setActor(SARA);
    await renderRouter(routes, { initialUrl: '/jewelry/more/stock-count' });
    await fireEvent.press(await screen.findByTestId('count-start'));
    expect(await screen.findByTestId('count-open')).toBeOnTheScreen();
    // Blind: the piece shows its name and code, never its stock.
    const stock = getProduct(ctxAs(OWNER), ring)!.stock;
    expect(screen.getByTestId(`count-row-${ring}`)).toHaveTextContent('RingR-1—');
    const prompt = jest.spyOn(Alert, 'prompt').mockImplementation((_t, _m, buttons) => {
      if (Array.isArray(buttons))
        buttons.find((b) => b.text === 'حفظ')?.onPress?.(String(stock - 1));
    });
    await fireEvent.press(screen.getByTestId(`count-row-${ring}`));
    prompt.mockRestore();
    expect(await screen.findByTestId(`count-value-${ring}`)).toHaveTextContent(String(stock - 1));
    expect(screen.getByTestId('count-progress')).toHaveTextContent(/عُدّ 1 من/);
    // Only the owner cancels.
    expect(screen.queryByTestId('count-cancel')).toBeNull();
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByTestId('count-submit'));
    await pressAlert(alert, 'إنهاء وإرسال');
    alert.mockRestore();
    expect(await screen.findByTestId('count-start')).toBeOnTheScreen();
    expect(openCount(ctxAs(OWNER))).toBeUndefined();
  });

  it('shows the owner the difference and applies it as a stock change', async () => {
    setActor(OWNER);
    const before = getProduct(ctxAs(OWNER), ring)!.stock;
    const id = ctxAs(OWNER).db.get<{ id: number }>('SELECT max(id) id FROM stock_counts')!.id;
    await renderRouter(routes, { initialUrl: '/jewelry/more/stock-count' });
    await fireEvent.press(await screen.findByTestId(`count-${id}`));
    expect(await screen.findByTestId(`count-line-${ring}`)).toHaveTextContent(/−1/);
    expect(screen.getByTestId('count-summary')).toHaveTextContent('ناقص 1 • زائد 0 • مطابق 0');
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByTestId('count-apply'));
    await pressAlert(alert, 'تطبيق');
    alert.mockRestore();
    expect(await screen.findByTestId('count-status')).toHaveTextContent('طُبّق');
    expect(getProduct(ctxAs(OWNER), ring)!.stock).toBe(before - 1);
  });

  it('lets the owner cancel a count in progress', async () => {
    setActor(OWNER);
    startCount(ctxAs(OWNER));
    await renderRouter(routes, { initialUrl: '/jewelry/more/stock-count' });
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(await screen.findByTestId('count-cancel'));
    await pressAlert(alert, 'إلغاء الجرد');
    alert.mockRestore();
    expect(await screen.findByTestId('count-start')).toBeOnTheScreen();
  });

  it('alerts the owner on the home screen, and hides an alert once seen', async () => {
    setActor(OWNER);
    for (let i = 0; i < 3; i++) recordWrongPin(ctxAs(OWNER), SARA);
    await renderRouter(routes, { initialUrl: '/jewelry' });
    expect(await screen.findByTestId('alert-wrongPins')).toHaveTextContent(/محاولات رمز خطأ: سارة/);
    // Sara's 5 د.ل shortage (S5) is an alert too.
    expect(screen.getByTestId('alert-shortage')).toHaveTextContent(/عجز 5/);
    const alert = jest.spyOn(Alert, 'alert');
    await fireEvent.press(screen.getByTestId('alert-wrongPins'));
    await pressAlert(alert, 'اطلعت');
    alert.mockRestore();
    await waitFor(() => expect(screen.queryByTestId('alert-wrongPins')).toBeNull());
    expect(ownerAlerts(ctxAs(OWNER)).map((a) => a.kind)).not.toContain('wrongPins');
  });

  it('shows the owner the device protection guide', async () => {
    setActor(OWNER);
    await renderRouter(routes, { initialUrl: '/jewelry/more/device-guide' });
    expect(await screen.findByText('الوصول الموجّه: يبقى الموظف داخل التطبيق')).toBeOnTheScreen();
    expect(screen.getByText('مدة استخدام الجهاز: لا يُحذف التطبيق')).toBeOnTheScreen();
  });
});
