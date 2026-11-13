/**
 * Receipts on the real route files and a real (in-memory) database: a receipt made by hand, the
 * studio's checks, pieces from the stock, reordering, a gift receipt, printing and sharing,
 * searching the history and deleting.
 */
import { OWNER } from '@/staff/model';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ReceiptsStack from '@/app/[system]/(tabs)/receipts/_layout';
import Receipts from '@/app/[system]/(tabs)/receipts/index';
import ReceiptRoute from '@/app/[system]/receipt/[id]';
import type { Ctx } from '@/domain/context';
import { saveProduct } from '@/domain/products';
import { listReceipts } from '@/domain/receipts';
import { printReceipt, shareReceipt } from '@/receipts/output';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('react-native-webview', () => ({ WebView: () => null }));
// The PDF is made by iOS; here the output functions are checked to be called with the receipt.
jest.mock('@/receipts/output', () => ({
  printReceipt: jest.fn(() => Promise.resolve()),
  shareReceipt: jest.fn(() => Promise.resolve()),
  saveReceiptToFiles: jest.fn(() => Promise.resolve('SALFORD-Receipt.pdf')),
}));
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
  _layout: RootLayout,
  index: () => null,
  '[system]/_layout': SystemLayout,
  '[system]/(tabs)/_layout': TabsLayout,
  '[system]/(tabs)/receipts/_layout': ReceiptsStack,
  '[system]/(tabs)/receipts/index': Receipts,
  '[system]/receipt/[id]': ReceiptRoute,
};

afterEach(() => jest.clearAllMocks());

// The tests share one database (the app keeps it open) and run in order.
it('makes a receipt by hand: checks, pieces from the stock, the number on save', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  saveProduct(ctx(), {
    name: 'Ring',
    brand: 'Pandora',
    color: 'Gold',
    category: 'خواتم',
    price: 350_000,
    stock: 3,
  });
  const app = await renderRouter(routes, { initialUrl: '/jewelry/receipts' });

  expect(await screen.findByText('لا توجد إيصالات بعد')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'إيصال جديد' }));
  expect(app.getPathname()).toBe('/jewelry/receipt/new');
  expect(await screen.findByTestId('studio-number')).toHaveTextContent('إيصال جديد');

  // Nothing to save yet.
  await fireEvent.press(screen.getByTestId('studio-save'));
  expect(alert).toHaveBeenLastCalledWith('لم يتم الحفظ', 'أضف قطعة واحدة على الأقل إلى الإيصال');

  // A piece from the stock comes with its brand, colour, code and price.
  await fireEvent.press(screen.getByTestId('studio-pick'));
  await fireEvent.press(screen.getByTestId('studio-pick-Ring'));
  expect(screen.getByTestId('studio-price-0')).toHaveDisplayValue('350');
  // A typed line without a price is refused on an official receipt.
  await fireEvent.press(screen.getByTestId('studio-add'));
  await fireEvent.changeText(screen.getByTestId('studio-name-1'), 'Gift box');
  await fireEvent.press(screen.getByTestId('studio-save'));
  expect(alert).toHaveBeenLastCalledWith(
    'لم يتم الحفظ',
    'اكتب سعر كل قطعة، أو اختر «هدية بدون أسعار»',
  );
  await fireEvent.changeText(screen.getByTestId('studio-price-1'), '٢٥');
  // Moved to the top.
  await fireEvent.press(screen.getByTestId('studio-up-1'));
  await fireEvent.changeText(screen.getByTestId('studio-customer'), 'سارة');
  await fireEvent.press(screen.getByTestId('template-salford_light'));
  await fireEvent.press(screen.getByTestId('studio-save'));

  expect(await screen.findByTestId('studio-number')).toHaveTextContent(/^GR-\d{4}-0001$/);
  const [r] = listReceipts(ctx());
  expect(r).toMatchObject({ customer: 'سارة', template: 'salford_light', total: 375_000 });
  expect(r.items.map((i) => [i.name, i.brand, i.code, i.price])).toEqual([
    ['Gift box', null, null, 25_000],
    ['Ring', 'Pandora', 'RNG-0001', 350_000],
  ]);

  // Back in the history, found by customer and by piece.
  await fireEvent.press(screen.getByTestId('studio-save'));
  await act(() => router.back());
  expect(await screen.findByTestId(`receipt-${r.receiptNo}`)).toBeOnTheScreen();
  expect(screen.getByText('375 د.ل')).toBeOnTheScreen();
  expect(screen.getByText('إيصال يدوي')).toBeOnTheScreen();
});

it('prints and shares the saved receipt, and turns it into a gift receipt', async () => {
  const [r] = listReceipts(ctx());
  await renderRouter(routes, { initialUrl: `/jewelry/receipt/${r.id}` });
  expect(await screen.findByTestId('studio-number')).toHaveTextContent(r.receiptNo);

  await fireEvent.press(screen.getByTestId('studio-print'));
  expect(printReceipt).toHaveBeenCalledWith(
    expect.objectContaining({ receiptNo: r.receiptNo, customer: 'سارة', showPrices: true }),
  );
  await fireEvent.press(screen.getByTestId('studio-share'));
  expect(shareReceipt).toHaveBeenCalledTimes(1);

  // Changing it saves first, so the PDF always matches what is saved.
  await fireEvent.press(screen.getByText('هدية بدون أسعار'));
  await fireEvent.press(screen.getByTestId('studio-share'));
  expect(shareReceipt).toHaveBeenLastCalledWith(expect.objectContaining({ showPrices: false }));
  expect(listReceipts(ctx())[0].showPrices).toBe(false);
});

it('marks unsaved changes, and deletes a receipt after asking', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const [r] = listReceipts(ctx());
  await renderRouter(routes, { initialUrl: `/jewelry/receipt/${r.id}` });
  await fireEvent.changeText(await screen.findByTestId('studio-customer'), 'هند');
  expect(screen.getByText('غير محفوظ')).toBeOnTheScreen();

  await fireEvent.press(screen.getByTestId('studio-delete'));
  const [, , buttons] = alert.mock.lastCall!;
  expect(alert.mock.lastCall![0]).toBe(`حذف الإيصال ${r.receiptNo}؟`);
  await act(async () => buttons!.find((b) => b.text === 'حذف')!.onPress!());
  expect(listReceipts(ctx())).toHaveLength(0);
});
