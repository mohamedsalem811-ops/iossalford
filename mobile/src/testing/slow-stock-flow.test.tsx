/**
 * Slow-moving stock (J5) on the real route and a real (in-memory) database: the pieces unsold for
 * the days chosen with the money tied up, by brand, and a piece's price changed from the list.
 */
import { OWNER } from '@/staff/model';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ProductsLayout from '@/app/[system]/(tabs)/products/_layout';
import SlowRoute from '@/app/[system]/(tabs)/products/slow';
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
  '[system]/(tabs)/products/_layout': ProductsLayout,
  '[system]/(tabs)/index': () => null,
  '[system]/(tabs)/products/slow': SlowRoute,
};

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

it('lists the slow pieces with the money tied up, and changes a price', async () => {
  const c = ctx();
  const chain = saveProduct(c, {
    name: 'سلسلة',
    brand: 'لازوردي',
    category: 'سلاسل',
    price: 50_000,
    cost: 30_000,
    stock: 4,
  });
  const ring = saveProduct(c, {
    name: 'خاتم',
    brand: 'لازوردي',
    category: 'خواتم',
    price: 100_000,
    cost: 40_000,
    stock: 1,
  });
  saveProduct(c, { name: 'جديد', category: 'أخرى', price: 10_000, cost: 1_000, stock: 5 });
  c.db.run('UPDATE products SET created_at = ? WHERE id = ?', [ago(200), chain]);
  c.db.run('UPDATE stock_moves SET created_at = ? WHERE product_id = ?', [ago(200), chain]);
  c.db.run('UPDATE products SET created_at = ? WHERE id = ?', [ago(100), ring]);
  c.db.run('UPDATE stock_moves SET created_at = ? WHERE product_id = ?', [ago(100), ring]);

  await renderRouter(routes, { initialUrl: '/jewelry/products/slow' });
  expect(await screen.findByTestId('slow-total')).toHaveTextContent(/^160 د.ل/);
  expect(screen.getByTestId(`slow-row-${chain}`)).toBeOnTheScreen();
  expect(screen.getByTestId('slow-brand-لازوردي')).toHaveTextContent(/2 صنف • 5 قطعة/);

  await fireEvent.press(screen.getByText('180 يوماً'));
  expect(screen.getByTestId('slow-total')).toHaveTextContent(/^120 د.ل/);
  expect(screen.queryByTestId(`slow-row-${ring}`)).toBeNull();

  await fireEvent.press(screen.getByTestId(`slow-row-${chain}`));
  await fireEvent.changeText(screen.getByTestId('slow-price'), '35');
  await fireEvent.press(screen.getByTestId('slow-price-save'));
  expect(getProduct(c, chain)!.price).toBe(35_000);
  expect(screen.queryByTestId('slow-price')).toBeNull();
});
