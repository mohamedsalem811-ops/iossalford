/**
 * The products tab and the product form on the real route files and a real (in-memory)
 * database: an empty shop, a missing name, adding a piece, the brand filter and searching.
 */
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ProductsStack from '@/app/[system]/(tabs)/products/_layout';
import Products from '@/app/[system]/(tabs)/products/index';
import ProductRoute from '@/app/[system]/product/[id]';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-router/native-tabs', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  const { Slot } = require('expo-router');
  const Trigger = Object.assign(() => null, { Label: () => null, Icon: () => null });
  return { NativeTabs: Object.assign(() => <Slot />, { Trigger }) };
});
// Swipes need the native gesture system; here the row is shown without them.
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));
// A row with a long-press menu uses a native iOS view; here it shows the row as it is.
jest.mock('expo-router/build/link/preview/native', () => ({
  ...jest.requireActual('expo-router/build/link/preview/native'),
  NativeLinkPreview: ({ children }: { children: React.ReactNode }) => children,
  NativeLinkPreviewAction: () => null,
  NativeLinkPreviewContent: () => null,
}));
// Already unlocked: the PIN screens have their own tests.
jest.mock('@/state/lock', () => ({
  LockProvider: ({ children }: { children: React.ReactNode }) => children,
  useLock: () => ({ unlocked: 'jewelry', unlock: () => {}, lock: () => {}, active: true }),
}));
jest.mock('@/db/manager', () => {
  /* eslint-disable @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports */
  const { openMemoryDb } = require('@/db/testing/node-db');
  const { migrate } = require('@/db/migrate');
  /* eslint-enable @typescript-eslint/no-require-imports */
  const db = openMemoryDb();
  migrate(db);
  return { openSystemDb: () => ({ status: 'ok', db }), setAsideUnreadable: jest.fn() };
});

const routes = {
  _layout: RootLayout,
  index: () => null,
  '[system]/photo/[id]': () => null,
  '[system]/_layout': SystemLayout,
  '[system]/(tabs)/_layout': TabsLayout,
  '[system]/(tabs)/products/_layout': ProductsStack,
  '[system]/(tabs)/products/index': Products,
  '[system]/product/[id]': ProductRoute,
};

afterEach(() => jest.restoreAllMocks());

it('adds a piece through the form and finds it in the list', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = await renderRouter(routes, { initialUrl: '/jewelry/products' });

  // An empty shop invites adding the first piece.
  expect(await screen.findByText('لا توجد قطع بعد')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'إضافة قطعة' }));
  expect(app.getPathname()).toBe('/jewelry/product/new');

  // Saving without a name or price is refused with an Arabic message; nothing is saved.
  await fireEvent.press(screen.getByTestId('product-save'));
  expect(alert).toHaveBeenCalledWith('لم يتم الحفظ', 'اسم القطعة مطلوب');
  expect(await screen.findByText('اسم القطعة مطلوب')).toBeOnTheScreen();

  await fireEvent.changeText(screen.getByTestId('product-name'), 'خاتم زركون');
  await fireEvent.changeText(screen.getByTestId('product-brand'), 'Pandora');
  expect(screen.getByText('ماركة جديدة — ستُضاف للقائمة عند الحفظ')).toBeOnTheScreen();
  // Arabic digits become 0-9 as they are typed.
  await fireEvent.changeText(screen.getByTestId('product-price'), '٣٥٠');
  await fireEvent.changeText(screen.getByTestId('product-cost'), '200');
  expect(screen.getByText('150 د.ل • 43٪')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('product-save'));

  // Back on the list: the piece with its generated code, brand and stock.
  expect(await screen.findByText('خاتم زركون')).toBeOnTheScreen();
  expect(app.getPathname()).toBe('/jewelry/products');
  expect(screen.getByText('RNG-0001 • خواتم')).toBeOnTheScreen();
  expect(screen.getByText('350 د.ل')).toBeOnTheScreen();
  expect(screen.getByTestId('products-summary')).toHaveTextContent('1 صنف • 1 قطعة في المخزن');
  expect(screen.getByTestId('brand-chip-Pandora')).toBeOnTheScreen();

  // Tapping the row opens it for editing, filled in.
  await fireEvent.press(screen.getByTestId('product-RNG-0001'));
  expect(app.getPathname()).toBe('/jewelry/product/1');
  expect(await screen.findByDisplayValue('خاتم زركون')).toBeOnTheScreen();
  await act(() => router.back());

  // A second piece without a brand.
  await act(() => router.push('/jewelry/product/new'));
  await fireEvent.changeText(await screen.findByTestId('product-name'), 'بروش');
  await fireEvent.changeText(screen.getByTestId('product-price'), '90');
  await fireEvent.changeText(screen.getByTestId('product-cost'), '0');
  await fireEvent.press(screen.getByTestId('product-save'));
  expect(await screen.findByText('بروش')).toBeOnTheScreen();
  expect(screen.getByTestId('products-summary')).toHaveTextContent('2 صنف • 2 قطعة في المخزن');

  // One tap on a brand shows only its pieces; a second tap shows all again.
  await fireEvent.press(screen.getByTestId('brand-chip-Pandora'));
  expect(screen.getByTestId('products-summary')).toHaveTextContent(/^1 صنف •/);
  expect(screen.queryByText('بروش')).not.toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('brand-chip-Pandora'));
  expect(screen.getByTestId('products-summary')).toHaveTextContent(/^2 صنف •/);

  // Categories filter too.
  await fireEvent.press(screen.getByRole('button', { name: 'دبابيس' }));
  expect(screen.getByTestId('products-summary')).toHaveTextContent(/^0 صنف •/);
  expect(screen.getByText('لا توجد نتائج')).toBeOnTheScreen();
});
