/**
 * Repairs (J3) on the real route files and a real (in-memory) database: taking a piece in with a
 * deposit, its ticket, moving it to the workshop and ready, and delivering it with the rest paid;
 * the list with its stages, and the repairs on the customer's page.
 */
import { OWNER } from '@/staff/model';
import { fireEvent, renderRouter, screen, act } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import CustomerRoute from '@/app/[system]/(tabs)/more/customer/[id]';
import RepairRoute from '@/app/[system]/(tabs)/more/repair/[id]';
import RepairsRoute from '@/app/[system]/(tabs)/more/repairs';
import RepairFormRoute from '@/app/[system]/repair-form';
import RepairTicketRoute from '@/app/[system]/repair-ticket/[id]';
import type { Ctx } from '@/domain/context';
import { getRepair, listRepairs } from '@/domain/repairs';
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
  '[system]/(tabs)/more/repairs': RepairsRoute,
  '[system]/(tabs)/more/repair/[id]': RepairRoute,
  '[system]/(tabs)/more/customer/[id]': CustomerRoute,
  '[system]/repair-form': RepairFormRoute,
  '[system]/repair-ticket/[id]': RepairTicketRoute,
};

async function answer(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.lastCall![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
}
afterEach(() => jest.restoreAllMocks());

it('takes a piece in, prints its ticket, moves it along and delivers it with the rest paid', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = await renderRouter(routes, { initialUrl: '/jewelry/repair-form' });
  await fireEvent.changeText(await screen.findByTestId('repair-name'), 'منى');
  await fireEvent.changeText(screen.getByTestId('repair-phone'), '0912345678');
  await fireEvent.changeText(screen.getByTestId('repair-description'), 'خاتم ذهب');
  await fireEvent.press(screen.getByTestId('repair-work-solder'));
  await fireEvent.changeText(screen.getByTestId('repair-price'), '50');
  await fireEvent.changeText(screen.getByTestId('repair-deposit'), '20');
  await fireEvent.press(screen.getByTestId('repair-save'));
  expect(alert).not.toHaveBeenCalled();
  const [repair] = listRepairs(ctx());
  expect(repair).toMatchObject({ work: 'solder', price: 50_000, paid: 20_000 });
  // The ticket opens in place of the form.
  expect(app.getPathname()).toBe(`/jewelry/repair-ticket/${repair.id}`);
  expect(await screen.findByTestId('repair-ticket-print')).toBeOnTheScreen();

  await act(async () => router.push(`/jewelry/more/repair/${repair.id}`));
  expect(await screen.findByTestId('repair-remaining')).toHaveTextContent(/30 د.ل/);
  await fireEvent.press(screen.getByTestId('repair-workshop'));
  expect(getRepair(ctx(), repair.id)!.status).toBe('workshop');
  await fireEvent.press(await screen.findByTestId('repair-ready'));
  expect(getRepair(ctx(), repair.id)!.status).toBe('ready');
  await fireEvent.press(await screen.findByTestId('repair-deliver'));
  await answer(alert, 'بطاقة');
  expect(getRepair(ctx(), repair.id)).toMatchObject({ status: 'delivered', paid: 50_000 });
  // The owner sees the workshop's cost line.
  expect(screen.getByTestId('repair-cost')).toBeOnTheScreen();
});

it("shows the repairs in the list by stage and on the customer's page", async () => {
  const [repair] = listRepairs(ctx(), { show: 'done' });
  await renderRouter(routes, { initialUrl: '/jewelry/more/repairs' });
  expect(await screen.findByText('لا توجد قطع للصيانة')).toBeOnTheScreen();
  await fireEvent.press(screen.getByText('المُسلّمة والملغاة'));
  expect(await screen.findByTestId(`repair-${repair.id}`)).toBeOnTheScreen();
  await renderRouter(routes, { initialUrl: `/jewelry/more/customer/${repair.customerId}` });
  expect(await screen.findByTestId(`customer-repair-${repair.id}`)).toBeOnTheScreen();
  expect(screen.getByTestId('customer-new-repair')).toBeOnTheScreen();
});
