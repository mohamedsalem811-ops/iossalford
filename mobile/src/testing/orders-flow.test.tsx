/**
 * Deposits (I2) on the real route files and a real (in-memory) database: taking a deposit for a
 * piece ordered from the supplier, the owner buying it with its date, its arrival, and the
 * delivery at checkout with the deposit taken off; the home shortcut and reminders, and the
 * orders on the customer's page.
 */
import { OWNER } from '@/staff/model';
import { fireEvent, renderRouter, screen, act } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import CheckoutRoute from '@/app/[system]/checkout';
import CustomerRoute from '@/app/[system]/(tabs)/more/customer/[id]';
import OrderRoute from '@/app/[system]/(tabs)/more/order/[id]';
import OrdersRoute from '@/app/[system]/(tabs)/more/orders';
import OrderBuyRoute from '@/app/[system]/order-buy/[id]';
import OrderFormRoute from '@/app/[system]/order-form';
import type { Ctx } from '@/domain/context';
import { getOrder, listOrders } from '@/domain/orders';
import { getSale } from '@/domain/sales';
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
  actor: OWNER,
});

const routes = {
  ...routeStubs,
  _layout: RootLayout,
  index: () => null,
  '[system]/_layout': SystemLayout,
  '[system]/(tabs)/_layout': TabsLayout,
  '[system]/(tabs)/more/_layout': ManagementLayout,
  '[system]/(tabs)/index': () => null,
  '[system]/(tabs)/more/orders': OrdersRoute,
  '[system]/(tabs)/more/order/[id]': OrderRoute,
  '[system]/(tabs)/more/customer/[id]': CustomerRoute,
  '[system]/order-form': OrderFormRoute,
  '[system]/order-buy/[id]': OrderBuyRoute,
  '[system]/checkout': CheckoutRoute,
};

async function answer(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.lastCall![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
}
afterEach(() => jest.restoreAllMocks());

it('takes a deposit, buys the piece, marks it arrived and delivers it with the deposit off', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = await renderRouter(routes, { initialUrl: '/jewelry/order-form?kind=order' });
  await fireEvent.changeText(await screen.findByTestId('order-name'), 'منى');
  await fireEvent.changeText(screen.getByTestId('order-phone'), '0912345678');
  await fireEvent.changeText(screen.getByTestId('order-description'), 'سوار تيفاني');
  await fireEvent.changeText(screen.getByTestId('order-price'), '1000');
  expect(screen.getByTestId('order-hint')).toHaveTextContent('أقل عربون 50%: 500 د.ل');
  await fireEvent.changeText(screen.getByTestId('order-deposit'), '400');
  await fireEvent.press(screen.getByTestId('order-save'));
  // Under the minimum, but the owner herself takes it: nothing to approve.
  expect(alert).not.toHaveBeenCalled();
  const [order] = listOrders(ctx());
  expect(order).toMatchObject({ description: 'سوار تيفاني', price: 1_000_000, paid: 400_000 });
  expect(app.getPathname()).toMatch(/^\/jewelry\/receipt\//);

  await act(async () => router.push(`/jewelry/more/order/${order.id}`));
  expect(await screen.findByTestId('order-remaining')).toHaveTextContent(/600 د.ل/);
  await fireEvent.press(screen.getByTestId('order-buy'));
  // The cost is in dollars at first (most pieces are bought abroad), at today's rate.
  await fireEvent.changeText(await screen.findByTestId('order-buy-cost'), '100');
  await fireEvent.press(screen.getByTestId('order-buy-save'));
  expect(getOrder(ctx(), order.id)).toMatchObject({ status: 'purchased', costUsd: 10_000 });

  expect(await screen.findByTestId('order-arrived')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('order-arrived'));
  await answer(alert, 'وصلت');
  expect(getOrder(ctx(), order.id)!.status).toBe('arrived');

  await fireEvent.press(await screen.findByTestId('order-deliver'));
  expect(app.getPathname()).toBe('/jewelry/checkout');
  expect(await screen.findByTestId('checkout-deposit')).toHaveTextContent(/400 د.ل/);
  expect(screen.getByTestId('checkout-order')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('checkout-confirm'));
  const done = getOrder(ctx(), order.id)!;
  expect(done.status).toBe('delivered');
  expect(getSale(ctx(), done.saleId!)).toMatchObject({ total: 1_000_000, depositUsed: 400_000 });
});

it("shows the orders in the list and on the customer's page", async () => {
  const [order] = listOrders(ctx(), { show: 'done' });
  await renderRouter(routes, { initialUrl: '/jewelry/more/orders' });
  await fireEvent.press(await screen.findByText('المُسلّمة والملغاة'));
  expect(await screen.findByTestId(`order-${order.id}`)).toBeOnTheScreen();
  await renderRouter(routes, { initialUrl: `/jewelry/more/customer/${order.customerId}` });
  expect(await screen.findByTestId(`customer-order-${order.id}`)).toBeOnTheScreen();
  expect(screen.getByTestId('customer-new-order')).toBeOnTheScreen();
});
