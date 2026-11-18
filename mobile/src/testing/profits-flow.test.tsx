/**
 * Profit by brand, category and piece (J4) on the real route and a real (in-memory) database:
 * the month's brands with their profit, a brand opened into its categories and a category into
 * its pieces, a brand with no name still opening, and the sort by margin.
 */
import { OWNER } from '@/staff/model';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import ProfitsRoute from '@/app/[system]/(tabs)/more/profits';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
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
  '[system]/(tabs)/more/profits': ProfitsRoute,
};

const sell = (id: number, qty: number) => {
  const p = getProduct(ctx(), id)!;
  const cart = (addToCart([], p, p.name, qty) as { cart: CartLine[] }).cart;
  checkout(ctx(), { cart, paymentMethod: 'cash' });
};

it('shows the brands, opens one into categories and pieces, and sorts by margin', async () => {
  const c = ctx();
  const ring = saveProduct(c, {
    name: 'خاتم',
    brand: 'لازوردي',
    category: 'خواتم',
    price: 100_000,
    cost: 40_000,
    stock: 20,
  });
  const plain = saveProduct(c, {
    name: 'دبوس',
    category: 'أخرى',
    price: 10_000,
    cost: 1_000,
    stock: 5,
  });
  sell(ring, 10);
  sell(plain, 1);

  await renderRouter(routes, { initialUrl: '/jewelry/more/profits' });
  expect(await screen.findByTestId('profits-total')).toHaveTextContent(/609 د.ل/);
  // By profit: the brand first; by margin: the piece with no brand (90%) first.
  expect(screen.getByTestId('profits-row-لازوردي')).toHaveTextContent(/600 د.ل • 60٪/);
  await fireEvent.press(screen.getByText('حسب الهامش'));
  expect(screen.getAllByTestId(/^profits-row-/)[0]).toHaveTextContent(/^بدون ماركة/);

  await fireEvent.press(screen.getByTestId('profits-row-لازوردي'));
  expect(await screen.findByTestId('profits-row-خواتم')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('profits-row-خواتم'));
  expect(await screen.findByTestId(`profits-row-${ring}`)).toHaveTextContent(/^خاتم/);
});

it('opens the brand with no name too', async () => {
  await renderRouter(routes, { initialUrl: '/jewelry/more/profits' });
  await fireEvent.press(await screen.findByTestId('profits-row-'));
  expect(await screen.findByTestId('profits-row-أخرى')).toBeOnTheScreen();
});
