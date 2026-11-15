/**
 * Marketing (I4) on the real route files and a real (in-memory) database: a new customer named by
 * who sent her gets the friend's gift at checkout and saves a gift to remember; the thank-you
 * message after the sale; «نفتقدك» given to a regular who stopped coming, then used at checkout;
 * the occasion sender one message at a time; the customer's page; the home gift reminder.
 */
import { OWNER } from '@/staff/model';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { router } from 'expo-router';
import { Alert, Linking } from 'react-native';

import RootLayout from '@/app/_layout';
import SystemLayout from '@/app/[system]/_layout';
import TabsLayout from '@/app/[system]/(tabs)/_layout';
import ManagementLayout from '@/app/[system]/(tabs)/more/_layout';
import CheckoutRoute from '@/app/[system]/checkout';
import SoldRoute from '@/app/[system]/sold/[id]';
import SendRoute from '@/app/[system]/send';
import MarketingRoute from '@/app/[system]/(tabs)/more/marketing';
import CustomerRoute from '@/app/[system]/(tabs)/more/customer/[id]';
import type { Ctx } from '@/domain/context';
import { addToCart, type CartLine } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import { saveCustomer } from '@/domain/customers';
import { setLoyalty } from '@/domain/loyalty';
import {
  activeOffer,
  friendStatus,
  getMarketing,
  listGifts,
  offersReport,
  setMarketing,
} from '@/domain/marketing';
import { lastMessage } from '@/domain/messages';
import { getProduct, saveProduct } from '@/domain/products';
import { getSale, listSales } from '@/domain/sales';
import { putCart } from '@/state/cart';
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

let today = new Date();
const ctx = (): Ctx => ({
  db: jest.requireMock('@/db/manager').openSystemDb('jewelry').db,
  system: 'jewelry',
  now: () => today,
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
  '[system]/(tabs)/more/marketing': MarketingRoute,
  '[system]/(tabs)/more/customer/[id]': CustomerRoute,
  '[system]/checkout': CheckoutRoute,
  '[system]/sold/[id]': SoldRoute,
  '[system]/send': SendRoute,
};

async function answer(alert: jest.SpyInstance, text: string) {
  const buttons = alert.mock.lastCall![2] as { text: string; onPress?: () => void }[];
  await act(async () => buttons.find((b) => b.text === text)!.onPress!());
}
/** One piece in a cart (the stock covers it). */
const line = (productId: number): CartLine[] => {
  const r = addToCart([], getProduct(ctx(), productId)!, 'Ring', 1);
  if (!('cart' in r)) throw new Error('no stock');
  return r.cart;
};
const cartOf = (productId: number) => putCart('jewelry', line(productId));

let sara = 0;
let ring = 0;
beforeAll(() => {
  setLoyalty(ctx(), { enabled: true });
  setMarketing(ctx(), { friendEnabled: true, friendPercent: 2, friendTimes: 2 });
  sara = saveCustomer(ctx(), { name: 'سارة', phone: '0911111111', offers: true });
  ring = saveProduct(ctx(), { name: 'Ring', category: 'خواتم', price: 1_000_000, stock: 20 });
});
beforeEach(() => {
  today = new Date();
  jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(undefined);
});
afterEach(() => jest.restoreAllMocks());

it('gives a new friend her gift, remembers her gift, and sends the thank-you', async () => {
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  cartOf(ring);
  await renderRouter(routes, { initialUrl: '/jewelry/checkout' });
  await fireEvent.changeText(await screen.findByTestId('checkout-name'), 'منى');
  await fireEvent.changeText(screen.getByTestId('checkout-phone'), '0922222222');
  // A new customer: who sent her?
  await fireEvent.changeText(screen.getByTestId('checkout-referrer-search'), 'سارة');
  await fireEvent.press(await screen.findByTestId(`checkout-referrer-${sara}`));
  expect(screen.getByTestId('checkout-referrer')).toHaveTextContent(/سارة/);
  await fireEvent.press(screen.getByTestId('checkout-friend'));
  expect(screen.getByTestId('checkout-friend-off')).toHaveTextContent(/20 د.ل/);
  expect(screen.getByTestId('checkout-total')).toHaveTextContent(/980 د.ل/);
  // A gift to remember next year.
  await fireEvent.press(screen.getByTestId('checkout-gift-toggle'));
  await fireEvent.changeText(screen.getByTestId('checkout-gift-for'), 'أمها');
  await fireEvent.changeText(screen.getByTestId('checkout-gift-occasion'), 'عيد الأم');
  await fireEvent.changeText(screen.getByTestId('checkout-gift-day'), '21');
  await fireEvent.changeText(screen.getByTestId('checkout-gift-month'), '3');
  await fireEvent.press(screen.getByTestId('checkout-confirm'));

  expect(await screen.findByTestId('sold-title')).toBeOnTheScreen();
  const [sale] = listSales(ctx());
  expect(sale).toMatchObject({ total: 980_000, friendOff: 20_000, customerName: 'منى' });
  expect(friendStatus(ctx(), sale.customerId)).toMatchObject({ referrerId: sara, ready: false });
  expect(listGifts(ctx(), sale.customerId!)).toMatchObject([
    { forWhom: 'أمها', occasion: 'عيد الأم', month: 3, day: 21 },
  ]);

  // The thank-you, once per sale (remembered).
  await fireEvent.press(screen.getByTestId('sold-thanks'));
  expect(Linking.openURL).toHaveBeenCalledWith(
    expect.stringMatching(/^https:\/\/wa\.me\/218922222222\?text=/),
  );
  expect(lastMessage(ctx(), sale.customerId!, 'thanks', sale.id)).not.toBeNull();
  expect(screen.getByTestId('sold-thanks-sent')).toBeOnTheScreen();
});

it("shows who sent her, her friends and her gifts on the customers' pages", async () => {
  const [sale] = listSales(ctx());
  await renderRouter(routes, { initialUrl: `/jewelry/more/customer/${sale.customerId}` });
  expect(await screen.findByTestId('customer-referrer')).toHaveTextContent(/سارة/);
  const [gift] = listGifts(ctx(), sale.customerId!);
  expect(screen.getByTestId(`customer-gift-${gift.id}`)).toHaveTextContent(/أمها/);
  await renderRouter(routes, { initialUrl: `/jewelry/more/customer/${sara}` });
  expect(await screen.findByTestId(`customer-friend-${sale.customerId}`)).toHaveTextContent(/منى/);
});

it('gives «نفتقدك» to a regular who stopped coming, and it is used at checkout', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  // Hala bought on three days half a year ago.
  const hala = saveCustomer(ctx(), { name: 'هالة', phone: '0933333333', offers: true });
  for (const d of [1, 2, 3]) {
    today = new Date(Date.now() - (200 - d) * 86_400_000);
    checkout(ctx(), {
      cart: line(ring),
      paymentMethod: 'cash',
      customer: { name: 'هالة', phone: '0933333333' },
    });
  }
  today = new Date();
  await renderRouter(routes, { initialUrl: '/jewelry/more/marketing' });
  await fireEvent.press(await screen.findByText('نفتقدك'));
  await fireEvent.press(await screen.findByTestId(`marketing-miss-${hala}`));
  await fireEvent.press(screen.getByTestId('marketing-miss-give'));
  await answer(alert, 'إعطاء وإرسال');
  const offer = activeOffer(ctx(), hala)!;
  expect(offer).toMatchObject({ percent: 10, cap: 50_000 });

  // The step-by-step sender: one message, then the end.
  expect(await screen.findByTestId('send-count')).toHaveTextContent('1 من 1');
  expect(screen.getByTestId('send-name')).toHaveTextContent('هالة');
  await fireEvent.press(screen.getByTestId('send-open'));
  expect(Linking.openURL).toHaveBeenCalledWith(expect.stringContaining('wa.me/218933333333'));
  expect(lastMessage(ctx(), hala, 'miss-you', offer.id)).not.toBeNull();
  expect(await screen.findByTestId('send-done')).toHaveTextContent(/1 من 1/);

  // She comes back: the offer is at checkout (10%, at most 50).
  cartOf(ring);
  await act(async () => router.push('/jewelry/checkout'));
  await fireEvent.changeText(await screen.findByTestId('checkout-phone'), '0933333333');
  await fireEvent.press(await screen.findByTestId('checkout-offer'));
  expect(screen.getByTestId('checkout-offer-off')).toHaveTextContent(/50 د.ل/);
  await fireEvent.press(screen.getByTestId('checkout-confirm'));
  expect(await screen.findByTestId('sold-title')).toBeOnTheScreen();
  const [last] = listSales(ctx());
  expect(getSale(ctx(), last.id)).toMatchObject({ offerOff: 50_000, total: 950_000 });
  expect(activeOffer(ctx(), hala)).toBeUndefined();
  expect(offersReport(ctx())).toMatchObject({ given: 1, used: 1, off: 50_000 });
});

it('sends an occasion one message at a time, only to customers who accept offers', async () => {
  saveCustomer(ctx(), { name: 'لا تريد', phone: '0944444444', offers: false });
  await renderRouter(routes, { initialUrl: '/jewelry/more/marketing' });
  await fireEvent.press(await screen.findByTestId('marketing-occasion-valentine'));
  expect(screen.getByTestId(`marketing-pick-${sara}`)).toBeOnTheScreen();
  expect(screen.queryByText('لا تريد')).toBeNull();
  await fireEvent.press(screen.getByTestId('marketing-send'));
  const total = Number(
    (await screen.findByTestId('send-count')).props.children.toString().split(' من ')[1],
  );
  expect(total).toBeGreaterThanOrEqual(2);
  expect(screen.getByTestId('send-text').props.value).toMatch(/عيد الحب \(14\/2\)/);
  for (let i = 0; i < total; i++) await fireEvent.press(screen.getByTestId('send-skip'));
  expect(await screen.findByTestId('send-done')).toHaveTextContent(/فُتحت 0 من/);
  expect(Linking.openURL).not.toHaveBeenCalled();
});

it('asks for the moving dates before sending', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await renderRouter(routes, { initialUrl: '/jewelry/more/marketing' });
  await fireEvent.press(await screen.findByTestId('marketing-occasion-fitr'));
  expect(alert).toHaveBeenCalledWith('اكتب التاريخ أولاً', expect.stringContaining('عيد الفطر'));
  await fireEvent.press(screen.getByTestId('marketing-date-fitr'));
  await fireEvent.changeText(screen.getByTestId('marketing-date-day'), '20');
  await fireEvent.changeText(screen.getByTestId('marketing-date-month'), '3');
  await fireEvent.press(screen.getByTestId('marketing-date-save'));
  const fitr = getMarketing(ctx()).occasions.find((o) => o.key === 'fitr')!;
  expect(fitr).toMatchObject({ day: 20, month: 3, year: today.getFullYear() });
  expect(screen.getByTestId('marketing-occasion-fitr')).toHaveTextContent(/20\/3/);
});
