/**
 * Customers and debts on the real route files and a real (in-memory) database: the debts total, a
 * customer's statement, a payment (and deleting it), the delete rules, adding a customer and a
 * phone number that belongs to someone else.
 */
import { fireEvent, renderRouter, screen, act } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import CustomerRoute from '@/app/[system]/customer/[id]';
import CustomerFormRoute from '@/app/[system]/customer-form/[id]';
import CustomersRoute from '@/app/[system]/customers';
import DebtsRoute from '@/app/[system]/debts';
import PaymentRoute from '@/app/[system]/payment/[id]';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { listCustomers } from '@/domain/customers';
import { balance, payments } from '@/domain/debts';
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
  '[system]/(tabs)/index': () => null,
  '[system]/customers': CustomersRoute,
  '[system]/customer/[id]': CustomerRoute,
  '[system]/customer-form/[id]': CustomerFormRoute,
  '[system]/debts': DebtsRoute,
  '[system]/payment/[id]': PaymentRoute,
};

async function answer(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.lastCall![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
}

let sara = 0;
beforeAll(() => {
  const ring = saveProduct(ctx(), { name: 'Ring', category: 'خواتم', price: 350_000, stock: 5 });
  const r = addToCart([], getProduct(ctx(), ring)!, 'Ring', 1);
  checkout(ctx(), {
    cart: (r as { cart: CartLine[] }).cart,
    paymentMethod: 'credit',
    customer: { name: 'سارة', phone: '0912345678' },
  });
  sara = listCustomers(ctx())[0].id;
});
afterEach(() => jest.restoreAllMocks());

it('shows the debts total, the statement, and takes a payment', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = await renderRouter(routes, { initialUrl: '/jewelry/debts' });
  expect(await screen.findByTestId('debts-total')).toHaveTextContent('350 د.ل');
  await fireEvent.press(screen.getByTestId('customer-سارة'));
  expect(app.getPathname()).toBe(`/jewelry/customer/${sara}`);
  expect(await screen.findByTestId('customer-balance')).toHaveTextContent('عليه 350 د.ل');
  expect(screen.getByText('بيع آجل رقم 1')).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('customer-pay'));
  // Starts at the whole balance; more than owed is refused.
  expect(await screen.findByDisplayValue('350')).toBeOnTheScreen();
  await fireEvent.changeText(screen.getByTestId('payment-amount'), '400');
  await fireEvent.press(screen.getByTestId('payment-save'));
  expect(alert).toHaveBeenLastCalledWith(
    'لم يتم الحفظ',
    'المبلغ أكبر من المستحق على الزبون (350 د.ل)',
  );
  await fireEvent.changeText(screen.getByTestId('payment-amount'), '100');
  await fireEvent.press(screen.getByTestId('payment-save'));
  expect(balance(ctx(), sara)).toBe(250_000);
  expect(await screen.findByTestId('customer-balance')).toHaveTextContent('عليه 250 د.ل');
  expect(screen.getByText('الرصيد 250 د.ل')).toBeOnTheScreen();

  // Deleting a customer with a debt is refused with the reason.
  await fireEvent.press(screen.getByTestId('customer-delete'));
  await answer(alert, 'حذف');
  expect(alert).toHaveBeenLastCalledWith('لم يتم الحفظ', 'لا يمكن حذف «سارة»: عليه 250 د.ل', [
    { text: 'حسناً' },
  ]);

  // A payment recorded by mistake can be deleted; the money is owed again.
  const [p] = payments(ctx(), sara);
  await fireEvent.press(screen.getByTestId(`payment-${p.id}`));
  await answer(alert, 'حذف');
  expect(balance(ctx(), sara)).toBe(350_000);
});

it('adds a customer, and refuses a phone number that belongs to another customer', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderRouter(routes, { initialUrl: '/jewelry/customer-form/new' });
  await fireEvent.changeText(await screen.findByTestId('customer-name'), 'هند');
  await fireEvent.changeText(screen.getByTestId('customer-phone'), '+218 91 234 5678');
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(alert).toHaveBeenLastCalledWith('لم يتم الحفظ', 'رقم الهاتف مسجل مسبقاً للزبون «سارة»', [
    { text: 'حسناً' },
  ]);
  await fireEvent.changeText(screen.getByTestId('customer-phone'), '0923456789');
  await fireEvent.press(screen.getByTestId('customer-save'));
  expect(listCustomers(ctx()).map((c) => c.name)).toEqual(['سارة', 'هند']);
});

it('finds customers by name or phone, with what they owe', async () => {
  await renderRouter(routes, { initialUrl: '/jewelry/customers' });
  expect(await screen.findByText('2 زبون')).toBeOnTheScreen();
  expect(screen.getByText('عليه 350 د.ل')).toBeOnTheScreen();
});
