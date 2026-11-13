/**
 * Management on the real route files and a real (in-memory) database: the sales history, a sale's
 * details, a return against its line, the returns list, undoing a return, deleting a sale and a
 * return without a sale.
 */
import { OWNER } from '@/staff/model';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { ActionSheetIOS, Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import ReturnRoute from '@/app/[system]/return/[id]';
import ReturnsRoute from '@/app/[system]/(tabs)/more/returns';
import SaleRoute from '@/app/[system]/(tabs)/more/sale/[id]';
import SalesRoute from '@/app/[system]/(tabs)/more/sales';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { getProduct, saveProduct } from '@/domain/products';
import { getSale, listReturns, listSales } from '@/domain/sales';
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
  '[system]/(tabs)/more/sales': SalesRoute,
  '[system]/(tabs)/more/sale/[id]': SaleRoute,
  '[system]/(tabs)/more/returns': ReturnsRoute,
  '[system]/return/[id]': ReturnRoute,
};

/** Presses a button of the last alert. */
async function answer(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.lastCall![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
}

let ring = 0;
let saleId = 0;
beforeAll(() => {
  ring = saveProduct(ctx(), {
    name: 'Ring',
    category: 'خواتم',
    price: 350_000,
    cost: 200_000,
    stock: 5,
  });
  const r = addToCart([], getProduct(ctx(), ring)!, 'Ring', 3);
  const cart = (r as { cart: CartLine[] }).cart;
  saleId = checkout(ctx(), { cart, paymentMethod: 'cash', customer: { name: 'سارة' } }).saleId;
});
afterEach(() => jest.restoreAllMocks());

it('shows the sale, takes a return against its line, lists it, and undoes it', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = await renderRouter(routes, { initialUrl: '/jewelry/more/sales' });
  expect(await screen.findByTestId('sales-summary')).toHaveTextContent('1 بيعة • 1,050 د.ل');
  await fireEvent.press(screen.getByTestId(`sale-${saleId}`));
  expect(app.getPathname()).toBe(`/jewelry/more/sale/${saleId}`);
  expect(await screen.findByText('Ring × 3')).toBeOnTheScreen();
  expect(screen.getByText('450 د.ل')).toBeOnTheScreen(); // profit: 1,050 − 600

  // A return of 2 pieces: more than they paid is refused; empty refunds what they paid.
  const line = getSale(ctx(), saleId)!.lines[0];
  await fireEvent.press(screen.getByTestId(`sale-return-${line.id}`));
  await fireEvent.press(await screen.findByTestId('return-quantity-plus'));
  expect(screen.getByText('اتركه فارغاً لإعادة ما دفعه: 700 د.ل')).toBeOnTheScreen();
  // The photo of the piece and the conditions (phase S4).
  await fireEvent.press(screen.getByText('الكاميرا'));
  await fireEvent.press(await screen.findByTestId('cond-yes-0'));
  await fireEvent.press(screen.getByTestId('cond-yes-1'));
  await fireEvent.changeText(screen.getByTestId('return-refund'), '701');
  await fireEvent.press(screen.getByTestId('return-save'));
  expect(alert).toHaveBeenLastCalledWith(
    'لم يتم الحفظ',
    'لا يمكن أن يتجاوز الاسترداد ما دفعه الزبون',
  );
  await fireEvent.changeText(screen.getByTestId('return-refund'), '');
  await fireEvent.changeText(screen.getByTestId('return-reason'), 'المقاس');
  await fireEvent.press(screen.getByTestId('return-save'));
  expect(listReturns(ctx())).toMatchObject([
    { quantity: 2, refund: 700_000, reason: 'المقاس', photo: 'return.jpg' },
  ]);
  expect(getProduct(ctx(), ring)!.stock).toBe(4); // 5 − 3 sold + 2 back
  expect(await screen.findByText('أُرجع 2 من 3')).toBeOnTheScreen();

  // The returns list; undoing the return takes the pieces out of stock again.
  await act(() => router.push('/jewelry/more/returns'));
  const [ret] = listReturns(ctx());
  expect(await screen.findByText('Ring × 2')).toBeOnTheScreen();
  // The row's action sheet is native: here it answers with "إلغاء المرتجع".
  jest
    .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
    .mockImplementation((o, pick) => pick(o.options.indexOf('إلغاء المرتجع')));
  await fireEvent.press(screen.getByTestId(`return-${ret.id}`));
  expect(alert.mock.lastCall![0]).toBe('إلغاء المرتجع؟');
  await answer(alert, 'إلغاء المرتجع');
  expect(listReturns(ctx())).toHaveLength(0);
  expect(getProduct(ctx(), ring)!.stock).toBe(2);
});

it('deletes a sale, putting back only the pieces not already returned', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderRouter(routes, { initialUrl: `/jewelry/more/sale/${saleId}` });
  await fireEvent.press(await screen.findByTestId('sale-delete'));
  expect(alert.mock.lastCall![0]).toBe(`حذف البيعة رقم ${saleId}؟`);
  // It has a receipt: delete it too, or keep it with its number.
  await answer(alert, 'حذف البيعة وإبقاء الإيصال');
  expect(listSales(ctx())).toHaveLength(0);
  // All 3 pieces come back (none is returned any more).
  expect(getProduct(ctx(), ring)!.stock).toBe(5);
});

it('records a return of a piece sold before the app, with the amount given back', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderRouter(routes, { initialUrl: '/jewelry/return/new' });
  await fireEvent.press(await screen.findByTestId('return-pick-Ring'));
  await fireEvent.press(screen.getByTestId('return-save'));
  expect(alert).toHaveBeenLastCalledWith('لم يتم الحفظ', 'صوّر القطعة المرتجعة قبل الحفظ.');
  await fireEvent.press(screen.getByText('الكاميرا'));
  await fireEvent.press(screen.getByTestId('return-save'));
  expect(alert).toHaveBeenLastCalledWith('لم يتم الحفظ', 'اكتب المبلغ الذي أُعيد للزبون');
  await fireEvent.changeText(screen.getByTestId('return-refund'), '300');
  await fireEvent.press(screen.getByTestId('return-save'));
  expect(listReturns(ctx())).toMatchObject([
    { saleLineId: null, quantity: 1, refund: 300_000, reason: 'مرتجع بدون فاتورة' },
  ]);
  expect(getProduct(ctx(), ring)!.stock).toBe(6);
});
