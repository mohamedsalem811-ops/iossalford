/**
 * Selling on the real route files and a real (in-memory) database: tap to add, an out-of-stock
 * piece, the cart, a credit sale that needs a customer, the success screen, a scarf size, a set
 * and the long-press quantity and price sheet.
 */
import { OWNER } from '@/staff/model';
import { router } from 'expo-router';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { Alert } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import SaleStack from '@/app/[system]/(tabs)/sale/_layout';
import Sale from '@/app/[system]/(tabs)/sale/index';
import AddRoute from '@/app/[system]/add/[id]';
import CartRoute from '@/app/[system]/cart';
import CheckoutRoute from '@/app/[system]/checkout';
import ReceiptRoute from '@/app/[system]/receipt/[id]';
import SetRoute from '@/app/[system]/set/[id]';
import SetsRoute from '@/app/[system]/sets';
import SizesRoute from '@/app/[system]/sizes/[id]';
import SoldRoute from '@/app/[system]/sold/[id]';
import type { Ctx } from '@/domain/context';
import { adjustStock, getProduct, saveProduct } from '@/domain/products';
import { saveScarfDesign } from '@/domain/scarves';
import { addReturn, getSale, listSales } from '@/domain/sales';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import { listCustomers } from '@/domain/customers';
import { balance, recordPayment } from '@/domain/debts';
import { getPolicies } from '@/domain/policies';

import { saveSet } from '@/domain/sets';
import { getCart, putCart } from '@/state/cart';
import type { SystemId } from '@/theme';

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
// The native segmented control is replaced by plain buttons so the test can choose a payment.
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
// An iPhone-sized window (the cart opens as a sheet) unless a test sets an iPad.
let mockIpad = false;
jest.mock('@/hooks/use-layout', () => ({
  ...jest.requireActual('@/hooks/use-layout'),
  useLayout: () => ({ split: mockIpad, cartBeside: mockIpad }),
}));
// Already unlocked: the PIN screens have their own tests.
let mockUnlocked = 'jewelry';
jest.mock('@/state/lock', () => ({
  LockProvider: ({ children }: { children: React.ReactNode }) => children,
  useLock: () => ({ unlocked: mockUnlocked, unlock: () => {}, lock: () => {}, active: true }),
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

const ctxOf = (system: SystemId): Ctx => ({
  db: jest.requireMock('@/db/manager').openSystemDb(system).db,
  system,
  now: () => new Date(),
  actor: OWNER,
});

const routes = {
  _layout: RootLayout,
  index: () => null,
  '[system]/_layout': SystemLayout,
  '[system]/(tabs)/_layout': TabsLayout,
  '[system]/(tabs)/more/_layout': ManagementLayout,
  '[system]/(tabs)/sale/_layout': SaleStack,
  '[system]/(tabs)/sale/index': Sale,
  '[system]/cart': CartRoute,
  '[system]/checkout': CheckoutRoute,
  '[system]/sold/[id]': SoldRoute,
  '[system]/receipt/[id]': ReceiptRoute,
  '[system]/add/[id]': AddRoute,
  '[system]/sizes/[id]': SizesRoute,
  '[system]/sets': SetsRoute,
  '[system]/set/[id]': SetRoute,
  // Screens of other phases, not opened here.
  '[system]/(tabs)/more/brands': () => null,
  '[system]/(tabs)/more/manage-sets': () => null,
  '[system]/product/[id]': () => null,
  '[system]/photo/[id]': () => null,
  '[system]/design/[id]': () => null,
  '[system]/stock/[id]': () => null,
};

/** The grid is drawn once its width is known. */
async function layoutGrid() {
  await fireEvent(await screen.findByTestId('sale-grid'), 'layout', {
    nativeEvent: { layout: { width: 390, height: 800, x: 0, y: 0 } },
  });
}

// One database per system for the whole file (the app keeps it open); each test uses its own
// pieces, and starts with empty carts.
beforeEach(() => {
  mockUnlocked = 'jewelry';
  mockIpad = false;
  putCart('jewelry', []);
  putCart('scarves', []);
});
afterEach(() => jest.restoreAllMocks());

it('sells two pieces on credit to a named customer, after refusing an out-of-stock piece', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const ctx = ctxOf('jewelry');
  const ring = saveProduct(ctx, {
    name: 'Ring',
    category: 'خواتم',
    price: 350_000,
    cost: 200_000,
    stock: 2,
  });
  saveProduct(ctx, { name: 'Chain', category: 'سلاسل', price: 500_000, stock: 0 });

  const app = await renderRouter(routes, { initialUrl: '/jewelry/sale' });
  await layoutGrid();

  // Out of stock: nothing is added, and the message names the piece.
  expect(screen.getByText('نفد المخزون')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('sale-tile-Chain'));
  expect(alert).toHaveBeenCalledWith(
    'لم تتم الإضافة',
    '«Chain»: المطلوب 1 والمتوفر 0 فقط',
    expect.anything(),
  );
  expect(getCart('jewelry')).toHaveLength(0);

  // A tap adds one; the tile shows it is in the cart.
  await fireEvent.press(screen.getByTestId('sale-tile-Ring'));
  expect(getCart('jewelry')).toMatchObject([{ productId: ring, quantity: 1, unitPrice: 350_000 }]);
  expect(await screen.findByText('في السلة 1')).toBeOnTheScreen();

  // The cart: one more is fine, a third is more than the stock.
  await act(() => router.push('/jewelry/cart'));
  expect(await screen.findByTestId('cart-total')).toHaveTextContent('350 د.ل');
  await fireEvent.press(screen.getByTestId('cart-qty-Ring-plus'));
  expect(screen.getByTestId('cart-total')).toHaveTextContent('700 د.ل');
  expect(screen.getByTestId('cart-total-usd')).toHaveTextContent('$100.00 بسعر الصرف 7');

  // Credit needs a customer.
  await fireEvent.press(screen.getByTestId('cart-checkout'));
  expect(app.getPathname()).toBe('/jewelry/checkout');
  await fireEvent.press(await screen.findByText('آجل'));
  await fireEvent.press(screen.getByTestId('checkout-confirm'));
  expect(alert).toHaveBeenLastCalledWith(
    'لم يتم البيع',
    'البيع الآجل يحتاج اسم الزبون أو رقم هاتفه لتسجيل الدين عليه',
  );
  expect(listSales(ctx)).toHaveLength(0);

  await fireEvent.changeText(screen.getByTestId('checkout-name'), 'سارة');
  await fireEvent.changeText(screen.getByTestId('checkout-phone'), '٠٩١٢٣٤٥٦٧٨');
  await fireEvent.press(screen.getByTestId('checkout-confirm'));

  // Saved as one sale; stock went down; the cart is empty; the receipt was issued.
  expect(await screen.findByTestId('sold-title')).toHaveTextContent('تم البيع بنجاح');
  expect(app.getPathname()).toBe('/jewelry/sold/1');
  expect(screen.getByTestId('sold-total')).toHaveTextContent('700 د.ل');
  const [sale] = listSales(ctx);
  expect(sale).toMatchObject({ paymentMethod: 'credit', customerName: 'سارة', total: 700_000 });
  expect(getProduct(ctx, ring)?.stock).toBe(0);
  expect(getCart('jewelry')).toHaveLength(0);
  // The receipt opens in the studio, to print or share.
  await fireEvent.press(screen.getByTestId('sold-show-receipt'));
  expect(await screen.findByTestId('studio-number')).toHaveTextContent(/^GR-\d{4}-0001$/);
});

it('uses a customer’s credit (له رصيد) for a new piece', async () => {
  // Mona paid a credit sale in full, then returned the piece: the shop owes her 500.
  const ctx = ctxOf('jewelry');
  const bag = saveProduct(ctx, { name: 'Bracelet', category: 'أساور', price: 500_000, stock: 1 });
  const first = checkout(ctx, {
    cart: (addToCart([], getProduct(ctx, bag)!, 'Bracelet', 1) as { cart: CartLine[] }).cart,
    paymentMethod: 'credit',
    customer: { name: 'منى', phone: '0915555555' },
  });
  const mona = listCustomers(ctx).find((c) => c.name === 'منى')!.id;
  recordPayment(ctx, { customerId: mona, amount: 500_000, method: 'cash' });
  addReturn(ctx, {
    photo: 'p.jpg',
    answers: Object.fromEntries(getPolicies(ctx).returnConditions.map((c) => [c, true])),
    saleLineId: getSale(ctx, first.saleId)!.lines[0].id,
    quantity: 1,
  });
  expect(balance(ctx, mona)).toBe(-500_000);

  const pin = saveProduct(ctx, { name: 'Pin', category: 'دبابيس', price: 350_000, stock: 1 });
  putCart('jewelry', (addToCart([], getProduct(ctx, pin)!, 'Pin', 1) as { cart: CartLine[] }).cart);
  await renderRouter(routes, { initialUrl: '/jewelry/checkout' });
  await fireEvent.changeText(await screen.findByTestId('checkout-phone'), '0915555555');
  expect(screen.getByTestId('checkout-credit')).toHaveTextContent(/له رصيد 500 د\.ل/);
  await fireEvent.press(screen.getByTestId('checkout-use-credit'));
  expect(screen.getByTestId('checkout-credit-use')).toHaveTextContent(
    'يُخصم 350 د.ل من رصيده، ويبقى له 150 د.ل.',
  );
  await fireEvent.press(screen.getByTestId('checkout-confirm'));
  expect(await screen.findByTestId('sold-title')).toHaveTextContent('تم البيع بنجاح');
  expect(balance(ctx, mona)).toBe(-150_000);
});

it('asks about a price changed in a kept cart, and can keep a price agreed before the update', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const ctx = ctxOf('jewelry');
  const brooch = saveProduct(ctx, { name: 'Brooch', category: 'دبابيس', price: 400_000, stock: 3 });
  // A cart kept by the app before it remembered list prices: 350 may be agreed, or the old price.
  putCart('jewelry', [
    { key: 'k1', productId: brooch, name: 'Brooch', quantity: 1, unitPrice: 350_000 },
  ]);
  const sold = listSales(ctx).length;
  await renderRouter(routes, { initialUrl: '/jewelry/checkout' });
  await fireEvent.press(await screen.findByTestId('checkout-confirm'));
  expect(listSales(ctx)).toHaveLength(sold);
  const [title, message, buttons] = alert.mock.calls.at(-1)! as [
    string,
    string,
    { text: string; onPress?: () => void }[],
  ];
  expect(title).toBe('تغيّرت الأسعار');
  expect(message).toMatch(/في السلة بسعر 350 د\.ل وسعره الآن 400 د\.ل/);
  expect(buttons.map((b) => b.text)).toEqual(['رجوع', 'إبقاء السعر المتفق عليه', 'تحديث الأسعار']);
  await act(() => buttons[1].onPress!());
  expect(getCart('jewelry')).toMatchObject([{ unitPrice: 350_000, listPrice: 400_000 }]);
  // The owner sells at the kept price; the discount is recorded against today's price.
  await fireEvent.press(screen.getByTestId('checkout-confirm'));
  expect(await screen.findByTestId('sold-title')).toHaveTextContent('تم البيع بنجاح');
  expect(listSales(ctx)).toHaveLength(sold + 1);
  expect(listSales(ctx)[0]).toMatchObject({ total: 350_000, discount: 50_000 });
});

it('adds a scarf by its size', async () => {
  mockUnlocked = 'scarves';
  const ctx = ctxOf('scarves');
  const designId = saveScarfDesign(ctx, {
    name: 'Silk',
    category: 'حرير',
    sizes: [
      { size: '90×90', price: 90_000, cost: 30_000, stock: 3 },
      { size: '120×120', price: 120_000, cost: 40_000, stock: 1 },
    ],
  });
  const app = await renderRouter(routes, { initialUrl: '/scarves/sale' });
  await layoutGrid();
  expect(screen.getByText('90 – 120 د.ل')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('sale-tile-Silk'));
  expect(app.getPathname()).toBe(`/scarves/sizes/${designId}`);
  await fireEvent.press(await screen.findByTestId('size-120×120'));
  expect(getCart('scarves')).toMatchObject([{ name: 'Silk — 120×120', unitPrice: 120_000 }]);
});

it('adds a whole set at its price, shown as one group in the cart', async () => {
  const ctx = ctxOf('jewelry');
  const ring = saveProduct(ctx, {
    name: 'Bride Ring',
    category: 'خواتم',
    price: 300_000,
    stock: 2,
  });
  const chain = saveProduct(ctx, {
    name: 'Bride Chain',
    category: 'سلاسل',
    price: 200_000,
    stock: 2,
  });
  saveSet(ctx, {
    name: 'العروس',
    discount: 50_000,
    items: [
      { productId: ring, quantity: 1 },
      { productId: chain, quantity: 1 },
    ],
  });
  await renderRouter(routes, { initialUrl: '/jewelry/sets' });
  expect(await screen.findByText('450 د.ل')).toBeOnTheScreen();
  expect(screen.getByText('متوفر طقمان')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('set-العروس'));
  expect(getCart('jewelry').map((l) => l.lineTotal)).toEqual([270_000, 180_000]);

  await act(() => router.push('/jewelry/cart'));
  expect(await screen.findByText('طقم «العروس»')).toBeOnTheScreen();
  expect(screen.getByTestId('cart-total')).toHaveTextContent('450 د.ل');
  // Removing the set removes all its pieces.
  await fireEvent.press(screen.getByTestId('cart-remove-العروس'));
  expect(getCart('jewelry')).toHaveLength(0);
});

it('adds with a chosen quantity and a negotiated price from the long-press sheet', async () => {
  const ctx = ctxOf('jewelry');
  const ring = saveProduct(ctx, { name: 'Gold Ring', category: 'خواتم', price: 350_000, stock: 3 });
  await renderRouter(routes, { initialUrl: `/jewelry/add/${ring}` });
  expect(await screen.findByDisplayValue('350')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('add-quantity-plus'));
  await fireEvent.changeText(screen.getByTestId('add-price'), '300');
  expect(screen.getByTestId('add-total')).toHaveTextContent('المجموع: 600 د.ل');
  await fireEvent.press(screen.getByTestId('add-confirm'));
  expect(getCart('jewelry')).toMatchObject([{ quantity: 2, unitPrice: 300_000 }]);
});

it('on iPad keeps the cart beside the products', async () => {
  mockIpad = true;
  const ctx = ctxOf('jewelry');
  saveProduct(ctx, { name: 'Pearl', category: 'أقراط', price: 120_000, stock: 1 });
  await renderRouter(routes, { initialUrl: '/jewelry/sale' });
  expect(await screen.findByText('السلة فارغة')).toBeOnTheScreen();
  await layoutGrid();
  await fireEvent.press(screen.getByTestId('sale-tile-Pearl'));
  expect(await screen.findByText('السلة (1)')).toBeOnTheScreen();
  expect(screen.getByTestId('cart-total')).toHaveTextContent('120 د.ل');
});

it('warns about a piece whose stock went down while it was in the cart, and blocks checkout', async () => {
  const ctx = ctxOf('jewelry');
  const id = saveProduct(ctx, { name: 'Bangle', category: 'أساور', price: 80_000, stock: 2 });
  await renderRouter(routes, { initialUrl: '/jewelry/sale' });
  await layoutGrid();
  await fireEvent.press(screen.getByTestId('sale-tile-Bangle'));
  await fireEvent.press(screen.getByTestId('sale-tile-Bangle'));
  adjustStock(ctx, id, -1, 'كسر');
  await act(() => router.push('/jewelry/cart'));
  expect(await screen.findByTestId('cart-warning')).toHaveTextContent(
    '«Bangle»: المطلوب 2 والمتوفر 1 فقط',
  );
  expect(screen.getByTestId('cart-checkout')).toBeDisabled();
  await fireEvent.press(screen.getByTestId('cart-qty-Bangle-minus'));
  expect(screen.queryByTestId('cart-warning')).toBeNull();
  expect(screen.getByTestId('cart-checkout')).toBeEnabled();
});
