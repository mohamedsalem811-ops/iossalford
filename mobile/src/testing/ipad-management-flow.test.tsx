/**
 * iPad: the Management menu stays on the leading side and the chosen section opens beside it,
 * with its row marked; a deeper screen opens in the same pane; another section replaces it.
 */
import { renderRouter, fireEvent, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import More from '@/app/[system]/(tabs)/more/index';
import SalesRoute from '@/app/[system]/(tabs)/more/sales';
import ReceiptsLayout from '@/app/[system]/(tabs)/receipts/_layout';
import ReceiptsRoute from '@/app/[system]/(tabs)/receipts/index';
import { issueReceipt } from '@/domain/receipts';
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
  useLayout: () => ({ split: true, cartBeside: true }),
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

const routes = {
  ...routeStubs,
  _layout: RootLayout,
  index: () => null,
  '[system]/_layout': SystemLayout,
  '[system]/(tabs)/_layout': TabsLayout,
  '[system]/(tabs)/index': () => null,
  '[system]/(tabs)/more/_layout': ManagementLayout,
  '[system]/(tabs)/more/index': More,
  '[system]/(tabs)/more/sales': SalesRoute,
  '[system]/(tabs)/receipts/_layout': ReceiptsLayout,
  '[system]/(tabs)/receipts/index': ReceiptsRoute,
};

it('keeps the menu beside the open section, as in the iPad Settings app', async () => {
  const app = await renderRouter(routes, { initialUrl: '/jewelry/more' });
  expect(await screen.findByTestId('manage-sidebar')).toBeOnTheScreen();
  expect(screen.getByText('اختر قسماً من القائمة ليظهر هنا.')).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('manage-sales'));
  expect(app.getPathname()).toBe('/jewelry/more/sales');
  expect(screen.getByTestId('manage-sidebar')).toBeOnTheScreen();
  expect(screen.getByTestId('manage-sales')).toBeSelected();

  // Another section takes the pane's place (not stacked on top of the first one).
  await fireEvent.press(screen.getByTestId('manage-settings'));
  expect(app.getPathname()).toBe('/jewelry/more/settings');
  expect(screen.getByTestId('manage-settings')).toBeSelected();
  expect(screen.getByTestId('manage-sales')).not.toBeSelected();
});

it('shows the chosen receipt beside the list, with its actions', async () => {
  const { openSystemDb } = jest.requireMock('@/db/manager');
  const ctx = { db: openSystemDb('jewelry').db, system: 'jewelry' as const, now: () => new Date() };
  const r = issueReceipt(ctx, {
    customer: 'سارة',
    items: [
      { name: 'Ring', brand: 'Pandora', color: null, code: null, quantity: 1, price: 350_000 },
    ],
  });
  await renderRouter(routes, { initialUrl: '/jewelry/receipts' });
  expect(await screen.findByText('اختر إيصالاً من القائمة')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId(`receipt-${r.receiptNo}`));
  expect(screen.getByTestId('receipt-pane')).toBeOnTheScreen();
  expect(screen.getAllByText(r.receiptNo).length).toBeGreaterThan(0);
  expect(screen.getByTestId('receipt-pane-edit')).toBeOnTheScreen();
});
