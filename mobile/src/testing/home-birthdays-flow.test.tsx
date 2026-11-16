/**
 * The home screen's «أعياد ميلاد هذا الأسبوع» row opens «متابعة الزبائن» (G3), on the real route
 * files and a real (in-memory) database. The simulator flow customer-care opens that page this
 * way on iPad (run 68: the customers' «More» menu failed there).
 */
import { OWNER } from '@/staff/model';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import HomeRoute from '@/app/[system]/(tabs)/index';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import CustomerCareRoute from '@/app/[system]/(tabs)/more/customer-care';
import type { Ctx } from '@/domain/context';
import { saveCustomer } from '@/domain/customers';
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
  '[system]/(tabs)/index': HomeRoute,
  '[system]/(tabs)/more/_layout': ManagementLayout,
  '[system]/(tabs)/more/customer-care': CustomerCareRoute,
};

it("opens «متابعة الزبائن» from the home screen's birthday row", async () => {
  const today = new Date();
  saveCustomer(ctx(), {
    name: 'Noor',
    birthDay: today.getDate(),
    birthMonth: today.getMonth() + 1,
  } as Parameters<typeof saveCustomer>[1]);
  const app = await renderRouter(routes, { initialUrl: '/jewelry' });
  const row = await screen.findByTestId('attention-birthdays');
  // What Maestro reads: the row's title alone (list-group.tsx).
  expect(row.props.accessibilityLabel).toBe('أعياد ميلاد هذا الأسبوع: 1');
  await fireEvent.press(row);
  expect(app.getPathname()).toBe('/jewelry/more/customer-care');
  expect(await screen.findByText('أعياد ميلاد هذا الأسبوع')).toBeOnTheScreen();
  expect(screen.getAllByText(/Noor/).length).toBeGreaterThan(0);
});
