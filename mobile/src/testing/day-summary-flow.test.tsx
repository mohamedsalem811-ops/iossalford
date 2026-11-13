/**
 * The end-of-day summary on its real route: the day's figures, moving to another day, a shift's
 * line that opens its report, and the PDF to print or share. Owner only.
 */
import { OWNER } from '@/staff/model';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import DaySummaryRoute from '@/app/[system]/(tabs)/more/day-summary';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { getProduct, saveProduct } from '@/domain/products';
import { openShift } from '@/domain/shifts';
import { routeStubs } from '@/testing/route-stubs';

// The camera: a photo is "taken" at once (phase S4 returns need one).
jest.mock('@/lib/photos', () => ({
  ...jest.requireActual('@/lib/photos'),
  pickPhoto: jest.fn(() => Promise.resolve({ status: 'picked', file: 'return.jpg' })),
}));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
jest.mock('expo-print', () => ({
  printAsync: jest.fn(() => Promise.resolve()),
  printToFileAsync: jest.fn(() => Promise.resolve({ uri: 'file:///tmp/day.pdf' })),
}));
jest.mock('expo-sharing', () => ({ shareAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('expo-file-system', () => {
  class File {
    uri: string;
    constructor(...parts: (string | { uri: string })[]) {
      this.uri = parts.map((p) => (typeof p === 'string' ? p : p.uri)).join('/');
    }
    get exists() {
      return false;
    }
    delete() {}
    async move() {}
  }
  return { File, Paths: { cache: { uri: 'file:///cache' } } };
});
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
  '[system]/(tabs)/more/day-summary': DaySummaryRoute,
  '[system]/(tabs)/more/shift-report/[id]': () => null,
};

it('shows today, moves back a day and forward again, and prints or shares the page', async () => {
  const ring = saveProduct(ctx(), { name: 'Ring', category: 'خواتم', price: 350_000, stock: 5 });
  openShift(ctx(), 50_000);
  const cart = (addToCart([], getProduct(ctx(), ring)!, 'Ring', 2) as { cart: CartLine[] }).cart;
  checkout(ctx(), { cart, paymentMethod: 'cash' });

  const app = await renderRouter(routes, { initialUrl: '/jewelry/more/day-summary' });
  expect(await screen.findByText('اليوم')).toBeOnTheScreen();
  expect(screen.getByTestId('day-row-0-0')).toHaveTextContent(/المجموع.*700 د\.ل/);
  expect(screen.getByTestId('day-row-0-1')).toHaveTextContent(/1 • 2 قطعة/);
  // The day can't go past today.
  expect(screen.getByTestId('day-next')).toBeDisabled();
  // The owner's open shift, with what the drawer should hold now: 50 + 700.
  const shift = screen.getByTestId(/^day-shift-/);
  expect(shift).toHaveTextContent(/مفتوحة.*المتوقع الآن 750 د\.ل/);

  await fireEvent.press(screen.getByTestId('day-previous'));
  expect(screen.queryByText('اليوم')).toBeNull();
  expect(screen.getByTestId('day-row-0-0')).toHaveTextContent(/0 د\.ل/);
  expect(screen.getByTestId('day-no-shifts')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('day-next'));
  expect(screen.getByText('اليوم')).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('day-print'));
  const print = jest.requireMock('expo-print');
  expect(print.printAsync).toHaveBeenCalledWith({
    html: expect.stringContaining('ملخص اليوم'),
  });
  await fireEvent.press(screen.getByTestId('day-share'));
  expect(jest.requireMock('expo-sharing').shareAsync).toHaveBeenCalledWith(
    expect.stringMatching(/SALFORD-Day-\d{4}-\d{2}-\d{2}\.pdf$/),
    expect.objectContaining({ mimeType: 'application/pdf' }),
  );

  // A shift opens its report.
  await fireEvent.press(screen.getByTestId(/^day-shift-/));
  expect(app.getPathname()).toMatch(/^\/jewelry\/more\/shift-report\/\d+$/);
});
