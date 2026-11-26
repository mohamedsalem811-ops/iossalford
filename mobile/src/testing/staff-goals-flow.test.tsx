/**
 * Phase L on the real routes and a real (in-memory) database, as the owner: a bonus put on a slow
 * piece from «الراكدة», the monthly staff report with last month's bonuses added to the accounts,
 * and paying an employee what the shop owes them from their account.
 */
import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import AccountRoute from '@/app/[system]/(tabs)/more/account/[id]';
import StaffReportRoute from '@/app/[system]/(tabs)/more/staff-report';
import ProductsLayout from '@/app/[system]/(tabs)/products/_layout';
import SlowRoute from '@/app/[system]/(tabs)/products/slow';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { getProduct, saveProduct } from '@/domain/products';
import { openShift } from '@/domain/shifts';
import { employeeStatement } from '@/domain/staff-ledger';
import { setGoals } from '@/domain/staff-goals';
import { addMonths, monthKey } from '@/lib/dates';
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
jest.mock('expo-print', () => ({ printToFileAsync: jest.fn(), printAsync: jest.fn() }));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn() }));
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
// The native segmented control is replaced by plain buttons so the test can switch it.
jest.mock('@expo/ui/community/segmented-control', () => ({
  __esModule: true,
  default: ({
    values,
    onChange,
  }: {
    values: string[];
    onChange: (e: { nativeEvent: { selectedSegmentIndex: number; value: string } }) => void;
  }) => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
    const { Pressable, Text: RNText, View } = require('react-native');
    return (
      <View>
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
jest.mock('@/hooks/use-layout', () => ({
  ...jest.requireActual('@/hooks/use-layout'),
  useLayout: () => ({ split: false, cartBeside: false }),
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
  '[system]/(tabs)/index': () => null,
  '[system]/(tabs)/products/_layout': ProductsLayout,
  '[system]/(tabs)/products/slow': SlowRoute,
  '[system]/(tabs)/more/_layout': ManagementLayout,
  '[system]/(tabs)/more/staff-report': StaffReportRoute,
  '[system]/(tabs)/more/account/[id]': AccountRoute,
};

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();
const lastMonth = addMonths(monthKey(new Date()), -1);

/** Answers the next prompt's button with what was typed. */
const answer = (button: string, typed: string) =>
  jest.spyOn(Alert, 'prompt').mockImplementationOnce((_t, _m, buttons) => {
    if (Array.isArray(buttons)) buttons.find((b) => b.text === button)?.onPress?.(typed);
  });
/** Presses a button of the next alert. */
const press = (button: string) =>
  jest.spyOn(Alert, 'alert').mockImplementationOnce((_t, _m, buttons) => {
    buttons?.find((b) => b.text === button)?.onPress?.();
  });

let chain = 0;
beforeAll(() => {
  useStaffStore.setState((s) => ({
    staff: {
      ...s.staff,
      employees: [{ id: 's1', name: 'سارة', active: true, createdAt: '', mustChangePin: false }],
    },
  }));
  setActor(OWNER);
  const c = ctxAs(OWNER);
  chain = saveProduct(c, {
    name: 'سلسلة',
    category: 'سلاسل',
    price: 50_000,
    cost: 30_000,
    stock: 6,
  });
  c.db.run('UPDATE products SET created_at = ? WHERE id = ?', [ago(120), chain]);
  c.db.run('UPDATE stock_moves SET created_at = ? WHERE product_id = ?', [ago(120), chain]);
});
afterEach(() => jest.restoreAllMocks());

it('puts a bonus on a slow piece, and shows it on the list', async () => {
  await renderRouter(routes, { initialUrl: '/jewelry/products/slow' });
  await fireEvent.press(await screen.findByTestId(`slow-row-${chain}`));
  answer('حفظ', '25');
  await fireEvent.press(screen.getByTestId('slow-bonus'));
  expect(getProduct(ctxAs(OWNER), chain)!.bonus).toBe(25_000);
  expect(await screen.findByTestId(`bonus-row-${chain}`)).toHaveTextContent(/25 د.ل/);
  expect(screen.getByTestId(`slow-row-${chain}`)).toHaveTextContent(/مكافأة 25/);
});

it('reports last month, adds its bonuses to the accounts once, and pays her', async () => {
  setGoals(ctxAs(OWNER), { target: 200_000 });
  openShift(ctxAs(SARA), 0);
  const p = getProduct(ctxAs(SARA), chain)!;
  const cart = (addToCart([], p, p.name, 2) as { cart: CartLine[] }).cart;
  checkout(ctxAs(SARA), { cart, paymentMethod: 'cash' });
  // As if she sold them last month.
  ctxAs(OWNER).db.run('UPDATE sales SET month = ?', [lastMonth]);

  await renderRouter(routes, { initialUrl: '/jewelry/more/staff-report' });
  expect(await screen.findByTestId('report-emp-s1-0')).toHaveTextContent(/100 د.ل/);
  expect(screen.getByTestId('report-emp-s1-1')).toHaveTextContent(/50%/);
  expect(screen.getByTestId('report-emp-s1-7')).toHaveTextContent(/50 د.ل • لم تُضف بعد/);
  press('إضافة');
  press('حسناً');
  await fireEvent.press(screen.getByTestId('report-credit'));
  expect(employeeStatement(ctxAs(OWNER), 'emp-s1').balance).toBe(-50_000);
  await waitFor(() => expect(screen.queryByTestId('report-credit')).toBeNull());
  expect(screen.getByTestId('report-emp-s1-7')).toHaveTextContent(/في الحساب/);

  await renderRouter(routes, { initialUrl: '/jewelry/more/account/s1' });
  expect(await screen.findByTestId('account-balance')).toHaveTextContent(/50 د.ل/);
  expect(screen.getByText('له')).toBeOnTheScreen();
  answer('تسجيل الدفع', '50');
  await fireEvent.press(screen.getByTestId('account-pay'));
  expect(employeeStatement(ctxAs(OWNER), 'emp-s1').balance).toBe(0);
  expect(await screen.findByTestId('account-balance')).toHaveTextContent('لا شيء عليه ولا له');
});
