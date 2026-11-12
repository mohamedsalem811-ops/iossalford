/**
 * Money screens on the real route files and a real (in-memory) database: an expense booked to a
 * month, closing the quarter (and the warning for an expense added after), and the monthly
 * comparison.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import ClosingRoute from '@/app/[system]/(tabs)/more/closing';
import ComparisonRoute from '@/app/[system]/(tabs)/more/comparison';
import ExpensesRoute from '@/app/[system]/(tabs)/more/expenses';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import { listClosings } from '@/domain/closing';
import type { Ctx } from '@/domain/context';
import { listExpenses } from '@/domain/expenses';
import { getProduct, saveProduct } from '@/domain/products';
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

const ctx = (): Ctx => ({
  db: jest.requireMock('@/db/manager').openSystemDb('jewelry').db,
  system: 'jewelry',
  now: () => new Date(),
});

const routes = {
  ...routeStubs,
  _layout: RootLayout,
  index: () => null,
  '[system]/_layout': SystemLayout,
  '[system]/(tabs)/_layout': TabsLayout,
  '[system]/(tabs)/more/_layout': ManagementLayout,
  '[system]/(tabs)/index': () => null,
  '[system]/(tabs)/more/expenses': ExpensesRoute,
  '[system]/(tabs)/more/closing': ClosingRoute,
  '[system]/(tabs)/more/comparison': ComparisonRoute,
};

async function answer(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.lastCall![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
}

beforeAll(() => {
  const ring = saveProduct(ctx(), {
    name: 'Ring',
    category: 'خواتم',
    price: 1_000_000,
    cost: 600_000,
    stock: 5,
  });
  const r = addToCart([], getProduct(ctx(), ring)!, 'Ring', 1);
  checkout(ctx(), { cart: (r as { cart: CartLine[] }).cart, paymentMethod: 'cash' });
});
afterEach(() => jest.restoreAllMocks());

it('adds an expense to this month and lists it under the month total', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderRouter(routes, { initialUrl: '/jewelry/more/expenses' });
  expect(await screen.findByText('لا توجد مصروفات بعد')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('expense-add'));
  expect(alert).toHaveBeenLastCalledWith('لم يتم الحفظ', 'اكتب وصف المصروف');
  await fireEvent.changeText(screen.getByTestId('expense-description'), 'إيجار');
  await fireEvent.changeText(screen.getByTestId('expense-amount'), '١٥٠');
  await fireEvent.press(screen.getByTestId('expense-add'));
  expect(listExpenses(ctx())).toMatchObject([{ description: 'إيجار', amount: 150_000 }]);
  expect(await screen.findByText('150 د.ل')).toBeOnTheScreen();
  expect(screen.getByTestId('expense-description')).toHaveDisplayValue('');
});

it('closes the quarter with its net profit, and warns about an expense added after', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderRouter(routes, { initialUrl: '/jewelry/more/closing' });
  // 1,000 sales − 600 cost − 150 expenses.
  expect(await screen.findByTestId('closing-net')).toHaveTextContent('250 د.ل');
  await fireEvent.press(screen.getByTestId('closing-issue'));
  await answer(alert, 'إقفال');
  expect(listClosings(ctx())).toMatchObject([{ netProfit: 250_000, transactions: 1 }]);
  expect(await screen.findByTestId('closing-existing')).toBeOnTheScreen();
  expect(screen.getByText('إعادة إصدار الإقفال')).toBeOnTheScreen();

  await act(async () => {
    await renderRouter(routes, { initialUrl: '/jewelry/more/expenses' });
  });
  expect(await screen.findByTestId('expense-closed')).toBeOnTheScreen();
});

it('compares the months with their totals', async () => {
  await renderRouter(routes, { initialUrl: '/jewelry/more/comparison' });
  expect(await screen.findByTestId('comparison-total')).toHaveTextContent('المبيعات 1,000 د.ل');
});
