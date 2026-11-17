/**
 * Settings → التنبيهات (J6) on the real route and a real (in-memory) database: asking iOS for the
 * permission, a kind turned off, names hidden and the times changed, each saved for the plan.
 */
import { OWNER } from '@/staff/model';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import NotificationsRoute from '@/app/[system]/(tabs)/more/notifications';
import * as Notifications from 'expo-notifications';
import type { Ctx } from '@/domain/context';
import { getNotifyRules } from '@/domain/notify';
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
  '[system]/(tabs)/more/notifications': NotificationsRoute,
};

it('asks for the permission, turns a kind off, hides names and moves the times', async () => {
  const N = jest.mocked(Notifications);
  await renderRouter(routes, { initialUrl: '/jewelry/more/notifications' });
  expect(await screen.findByTestId('notify-status')).toHaveTextContent(/غير مسموح/);
  expect(screen.getByTestId('notify-per-system')).toHaveTextContent(/لنظام المجوهرات وحده/);

  N.getPermissionsAsync.mockResolvedValue({ granted: true, canAskAgain: true } as never);
  await fireEvent.press(screen.getByTestId('notify-allow'));
  expect(N.requestPermissionsAsync).toHaveBeenCalled();
  expect(await screen.findByText(/لا شيء يُنبَّه عنه/)).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('notify-kind-gifts'));
  expect(getNotifyRules(ctx()).on.gifts).toBe(false);
  expect(screen.getByTestId('notify-kind-gifts')).toHaveTextContent(/متوقفة/);

  await fireEvent.press(screen.getByTestId('notify-hide-names'));
  expect(getNotifyRules(ctx()).hideNames).toBe(true);

  await fireEvent.changeText(screen.getByTestId('notify-morning'), '٨:٣٠');
  await fireEvent.changeText(screen.getByTestId('notify-closing'), '22');
  await fireEvent.press(screen.getByTestId('notify-save-times'));
  expect(getNotifyRules(ctx())).toMatchObject({
    hour: 8,
    minute: 30,
    closeHour: 22,
    closeMinute: 0,
  });
  expect(screen.getByTestId('notify-morning').props.value).toBe('08:30');
});
