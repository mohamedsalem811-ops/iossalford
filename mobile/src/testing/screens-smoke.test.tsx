/**
 * Every screen that had no screen test opens on a real (in-memory) database without the error
 * screen: loyalty, the rewards card, customer care, policies, settings, backup, archived pieces,
 * an employee's account, an order payment, a return's details, sets, the PIN change and a photo.
 */
import { OWNER } from '@/staff/model';
import { renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import LoyaltyRoute from '@/app/[system]/(tabs)/more/loyalty';
import RewardCardRoute from '@/app/[system]/(tabs)/more/reward-card';
import CustomerCareRoute from '@/app/[system]/(tabs)/more/customer-care';
import PoliciesRoute from '@/app/[system]/(tabs)/more/policies';
import SettingsRoute from '@/app/[system]/(tabs)/more/settings';
import BackupRoute from '@/app/[system]/(tabs)/more/backup';
import ArchivedRoute from '@/app/[system]/(tabs)/more/archived';
import AccountRoute from '@/app/[system]/(tabs)/more/account/[id]';
import ManageSetsRoute from '@/app/[system]/(tabs)/more/manage-sets';
import OrderPayRoute from '@/app/[system]/order-pay/[id]';
import ReturnDetailRoute from '@/app/[system]/return-detail/[id]';
import ChangePinRoute from '@/app/[system]/change-pin';
import PhotoRoute from '@/app/[system]/photo/[id]';
import type { Ctx } from '@/domain/context';
import { takeOrder, type TakeOrderInput } from '@/domain/orders';
import { saveProduct } from '@/domain/products';
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
  '[system]/(tabs)/more/loyalty': LoyaltyRoute,
  '[system]/(tabs)/more/reward-card': RewardCardRoute,
  '[system]/(tabs)/more/customer-care': CustomerCareRoute,
  '[system]/(tabs)/more/policies': PoliciesRoute,
  '[system]/(tabs)/more/settings': SettingsRoute,
  '[system]/(tabs)/more/backup': BackupRoute,
  '[system]/(tabs)/more/archived': ArchivedRoute,
  '[system]/(tabs)/more/account/[id]': AccountRoute,
  '[system]/(tabs)/more/manage-sets': ManageSetsRoute,
  '[system]/order-pay/[id]': OrderPayRoute,
  '[system]/return-detail/[id]': ReturnDetailRoute,
  '[system]/change-pin': ChangePinRoute,
  '[system]/photo/[id]': PhotoRoute,
};

let ring = 0;
let orderId = 0;
beforeAll(() => {
  ring = saveProduct(ctx(), { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 3 });
  orderId = takeOrder(ctx(), {
    kind: 'order',
    customer: { name: 'منى', phone: '0912345678' },
    description: 'سوار',
    unitPrice: 1_000_000,
    deposit: { amount: 300_000, method: 'cash' },
  } as TakeOrderInput).orderId;
});

const screens: [string, () => string, RegExp | null][] = [
  ['loyalty', () => '/jewelry/more/loyalty', /بطاقة المكافآت/],
  ['the rewards card', () => '/jewelry/more/reward-card', null],
  ['customer care', () => '/jewelry/more/customer-care', /أعياد/],
  ['policies', () => '/jewelry/more/policies', null],
  ['settings', () => '/jewelry/more/settings', null],
  ['backup', () => '/jewelry/more/backup', null],
  ['archived pieces', () => '/jewelry/more/archived', null],
  ['an unknown employee account', () => '/jewelry/more/account/nobody', null],
  ['sets', () => '/jewelry/more/manage-sets', null],
  ['an order payment', () => `/jewelry/order-pay/${orderId}`, null],
  ['an unknown return', () => '/jewelry/return-detail/999', /المرتجع غير موجود/],
  ['the PIN change', () => '/jewelry/change-pin', null],
  ['a photo', () => `/jewelry/photo/${ring}`, /لا توجد صورة/],
];

it.each(screens)('opens %s without the error screen', async (_name, url, text) => {
  await renderRouter(routes, { initialUrl: url() });
  if (text) expect((await screen.findAllByText(text)).length).toBeGreaterThan(0);
  expect(screen.queryByTestId('error-screen')).toBeNull();
  expect(screen.toJSON()).not.toBeNull();
});
