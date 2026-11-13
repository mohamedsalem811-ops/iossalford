/**
 * The real route files together: first launch, PIN setup, the system choice, login, the
 * dashboard, switching system and locking in the background. Device parts are replaced: an
 * in-memory Keychain, no Face ID, and a database stand-in.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { ActionSheetIOS, AppState, type AppStateStatus } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import Dashboard from '@/app/[system]/(tabs)/index';
import More from '@/app/[system]/(tabs)/more/index';
import Index from '@/app/index';
import Setup from '@/app/setup';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
// Native tabs need UIKit; in tests the layout just shows the current tab.
jest.mock('expo-router/native-tabs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  const { Slot } = require('expo-router');
  const Trigger = Object.assign(() => null, { Label: () => null, Icon: () => null });
  return { NativeTabs: Object.assign(() => <Slot />, { Trigger }) };
});
jest.mock('@/security/device', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  const { PinVault } = require('@/security/pin');
  const store = new Map<string, string>();
  const kv = {
    get: async (k: string) => store.get(k) ?? null,
    set: async (k: string, v: string) => void store.set(k, v),
    remove: async (k: string) => void store.delete(k),
  };
  let last: string | null = null;
  return {
    pinVault: new PinVault(
      kv,
      async (t: string) => `h:${t}`,
      () => 'salt',
    ),
    faceIdStatus: async () => 'none',
    askFaceId: async () => ({ ok: false, error: 'user_cancel' }),
    lastSystem: () => last,
    rememberSystem: (s: string) => (last = s),
  };
});
jest.mock('@/db/manager', () => ({
  openSystemDb: jest.fn(() => ({ status: 'ok', db: {} })),
  setAsideUnreadable: jest.fn(),
}));
// The dashboard's figures (this test is about PINs and locking, not the numbers).
jest.mock('@/features/dashboard/model', () => ({
  ...jest.requireActual('@/features/dashboard/model'),
  readDashboard: () => ({
    date: new Date(2026, 10, 9),
    rate: 7_000,
    today: {
      total: 1_250_000,
      profit: 300_000,
      sales: 2,
      pieces: 3,
      byMethod: { cash: 1_250_000, card: 0, transfer: 0, credit: 0 },
    },
    month: '2026-11',
    months: ['2026-11'],
    summary: {
      grossSales: 0,
      costOfSales: 0,
      grossProfit: 0,
      refunds: 0,
      returnedCost: 0,
      expenses: 0,
      transactions: 0,
      itemsSold: 0,
      itemsReturned: 0,
      netSales: 0,
      netProfit: 0,
      grossSalesUsd: 0,
      grossProfitUsd: 0,
      netProfitUsd: 0,
    },
    daily: [],
    attention: {
      low: [],
      lowCount: 0,
      outCount: 0,
      owed: 0,
      debtors: 0,
      backupReminder: null,
      alerts: [],
    },
    byCategory: [],
    byBrand: [],
    byPayment: [],
    bySize: [],
    top: [],
    latest: [],
    stock: { items: 0, pieces: 0, costValue: 0, priceValue: 0, low: 0, out: 0 },
  }),
}));
jest.mock('@expo/ui/swift-ui', () => ({ Host: () => null, Chart: () => null }));
jest.mock('@/domain/settings', () => ({ getRate: () => 7_000 }));

const JEWELRY = '19283746';
const SCARVES = '56473829';

async function enter(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`pin-key-${d}`));
}

// Every listener hears each change, as on iOS (the lock and the automatic backup both listen).
const listeners = new Set<(state: AppStateStatus) => void>();
const emit = (state: AppStateStatus) => [...listeners].forEach((l) => l(state));

beforeEach(() => {
  listeners.clear();
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    const l = handler as (state: AppStateStatus) => void;
    listeners.add(l);
    return { remove: () => listeners.delete(l) } as never;
  });
});
afterEach(() => jest.restoreAllMocks());

it('sets up both PINs, opens a system, switches, and locks in the background', async () => {
  const router = await renderRouter({
    _layout: RootLayout,
    index: Index,
    setup: Setup,
    '[system]/_layout': SystemLayout,
    '[system]/(tabs)/_layout': TabsLayout,
    '[system]/(tabs)/more/_layout': ManagementLayout,
    '[system]/(tabs)/index': Dashboard,
    '[system]/(tabs)/more/index': More,
    '[system]/product/[id]': () => null,
    '[system]/photo/[id]': () => null,
  });

  // First launch goes to setup: there is no default PIN.
  expect(await screen.findByText('أنشئ رمز نظام المجوهرات')).toBeOnTheScreen();
  expect(router.getPathname()).toBe('/setup');
  await enter(JEWELRY);
  await enter(JEWELRY);
  await enter(SCARVES);
  await enter(SCARVES);

  // The system choice.
  expect(await screen.findByText('اختر النظام')).toBeOnTheScreen();
  expect(router.getPathname()).toBe('/');
  await fireEvent.press(screen.getByRole('button', { name: 'نظام المجوهرات' }));
  expect(router.getPathname()).toBe('/jewelry');
  expect(await screen.findByText('أدخل رمز الدخول')).toBeOnTheScreen();

  // The scarves PIN does not open jewelry.
  await enter(SCARVES);
  expect(await screen.findByText('رمز خاطئ، بقيت 4 محاولات قبل القفل المؤقت')).toBeOnTheScreen();
  await enter(JEWELRY);
  expect(await screen.findByText('مبيعات اليوم')).toBeOnTheScreen();
  expect(screen.getByTestId('today-total')).toHaveTextContent('1,250 د.ل');

  // The app switcher hides the screen without locking; the background locks.
  await act(async () => emit('inactive'));
  expect(screen.getByTestId('privacy-cover')).toBeOnTheScreen();
  await act(async () => emit('active'));
  expect(screen.queryByTestId('privacy-cover')).toBeNull();
  expect(screen.getByText('مبيعات اليوم')).toBeOnTheScreen();
  await act(async () => emit('background'));
  await act(async () => emit('active'));
  expect(await screen.findByText('أدخل رمز الدخول')).toBeOnTheScreen();
  expect(screen.queryByText('مبيعات اليوم')).toBeNull();
  await enter(JEWELRY);
  expect(await screen.findByText('مبيعات اليوم')).toBeOnTheScreen();

  // Switching goes back to the choice, highlights the last system, and asks for the PIN again.
  // The logo opens the system menu; its first choice switches.
  const sheet = jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((_options, choose) => choose(0));
  await fireEvent.press(screen.getByTestId('dashboard-system'));
  sheet.mockRestore();
  expect(await screen.findByText('اختر النظام')).toBeOnTheScreen();
  expect(screen.getByTestId('system-jewelry')).toBeSelected();
  await fireEvent.press(screen.getByRole('button', { name: 'نظام المجوهرات' }));
  expect(await screen.findByText('أدخل رمز الدخول')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'تغيير النظام' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'نظام الأوشحة' }));
  expect(router.getPathname()).toBe('/scarves');
  await enter(SCARVES);
  expect(await screen.findByText('مبيعات اليوم')).toBeOnTheScreen();
  expect(screen.getByText('وشاح')).toBeOnTheScreen();
});

it('sends an unknown system address back to the choice', async () => {
  const router = await renderRouter(
    {
      _layout: RootLayout,
      index: Index,
      setup: Setup,
      '[system]/_layout': SystemLayout,
      '[system]/(tabs)/_layout': TabsLayout,
      '[system]/(tabs)/index': Dashboard,
    },
    { initialUrl: '/watches' },
  );
  await act(async () => {});
  expect(router.getPathname()).not.toBe('/watches');
});
