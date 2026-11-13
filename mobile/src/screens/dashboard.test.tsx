import { fireEvent, screen } from '@testing-library/react-native';
import { ActionSheetIOS } from 'react-native';

import { addToCart, type CartLine } from '@/domain/cart';
import { checkout, type PaymentMethod } from '@/domain/checkout';
import { addExpense } from '@/domain/expenses';
import { displayName, getProduct, saveProduct } from '@/domain/products';
import { setRate } from '@/domain/settings';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { readDashboard } from '@/features/dashboard/model';
import { renderScreen } from '@/testing/render';

import { DashboardScreen, type DashboardActions } from './dashboard';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-haptics', () => ({ selectionAsync: jest.fn(() => Promise.resolve()) }));
jest.mock('@expo/ui/swift-ui', () => ({ Host: () => null, Chart: () => null }));
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
let mockColumns = 1;
jest.mock('@/hooks/use-layout', () => ({
  ...jest.requireActual('@/hooks/use-layout'),
  useLayout: () => ({ dashboardColumns: mockColumns, split: mockColumns > 1 }),
}));

let ctx: TestCtx;
const actions = (): DashboardActions => ({
  onSystemMenu: jest.fn(),
  onEditRate: jest.fn(),
  onMonth: jest.fn(),
  onOpenSale: jest.fn(),
  onOpenAlert: jest.fn(),
  onOpenDebts: jest.fn(),
  onOpenBackup: jest.fn(),
  onOpenProducts: jest.fn(),
  onNewSale: jest.fn(),
  onNewReceipt: jest.fn(),
  onNewProduct: jest.fn(),
});
const noBackup = { lastCopied: null, firstBackup: null };

function sell(id: number, method: PaymentMethod, at: Date) {
  ctx.setNow(at);
  const p = getProduct(ctx, id)!;
  const cart = (addToCart([], p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart;
  checkout(ctx, {
    cart,
    paymentMethod: method,
    customer: method === 'credit' ? { name: 'سارة' } : undefined,
  });
}

beforeEach(() => {
  mockColumns = 1;
  ctx = makeCtx('jewelry', new Date(2026, 10, 9, 10));
  setRate(ctx, 7_000);
  const ring = saveProduct(ctx, {
    name: 'خاتم',
    brand: 'Pandora',
    category: 'خواتم',
    price: 350_000,
    cost: 200_000,
    stock: 6,
  });
  const neck = saveProduct(ctx, {
    name: 'قلادة',
    brand: 'Swarovski',
    category: 'قلادات',
    price: 600_000,
    cost: 300_000,
    stock: 1,
  });
  sell(ring, 'cash', new Date(2026, 10, 9, 11));
  sell(neck, 'credit', new Date(2026, 10, 9, 12));
  sell(ring, 'card', new Date(2026, 10, 3, 12));
  addExpense(ctx, { description: 'إيجار', amount: 100_000, month: '2026-11' });
  ctx.setNow(new Date(2026, 10, 9, 18));
});
afterEach(() => ctx.close());

describe('the dashboard', () => {
  it("shows today, cash against credit, and the month's figures", async () => {
    await renderScreen(
      <DashboardScreen
        system="jewelry"
        data={readDashboard(ctx, '2026-11', noBackup)}
        actions={actions()}
      />,
    );
    expect(screen.getByText('الإثنين 9 نوفمبر 2026')).toBeOnTheScreen();
    expect(screen.getByTestId('today-total')).toHaveTextContent('950 د.ل');
    expect(screen.getByTestId('today-cash-credit')).toHaveTextContent(
      'مدفوع 350 د.ل • آجل 600 د.ل',
    );
    expect(screen.getByTestId('month-title')).toHaveTextContent('نوفمبر 2026');
    // ملخص الشهر: net sales of the 3 sales, the count line, the margin, net profit in dollars.
    expect(screen.getByTestId('tile-net-sales')).toHaveTextContent(/1,300 د\.ل/);
    expect(screen.getByTestId('tile-net-sales')).toHaveTextContent(/3 عملية • 3 قطعة/);
    expect(screen.getByTestId('tile-profit')).toHaveTextContent(/الهامش \d+٪/);
    expect(screen.getByTestId('tile-out')).toHaveTextContent(/مصاريف .* • مرتجعات/);
    expect(screen.getByTestId('month-summary')).toHaveTextContent(/صافي الربح/);
    // Nothing sold the month before: every dot says "better" for sales.
    expect(screen.getByTestId('trend-net-sales-better')).toBeOnTheScreen();
    // VoiceOver reads each tile as one item.
    expect(screen.getByLabelText(/^صافي الربح، .*د\.ل، \$/)).toBeOnTheScreen();
    // One breakdown card: by category first, the switch shows the others.
    expect(screen.getByTestId('by-category')).toBeOnTheScreen();
    await fireEvent.press(screen.getByText('الماركة'));
    expect(screen.getByTestId('by-brand')).toHaveTextContent(/Swarovski/);
    await fireEvent.press(screen.getByText('الدفع'));
    expect(screen.getByTestId('by-payment')).toHaveTextContent(/آجل/);
    expect(screen.queryByTestId('by-brand')).toBeNull();
    expect(screen.getByTestId('latest-sales')).toHaveTextContent(/قلادة/);
    expect(screen.queryByTestId('empty-month')).toBeNull();
  });

  it('shows one empty card for a month without sales, and the stock still', async () => {
    await renderScreen(
      <DashboardScreen
        system="jewelry"
        data={readDashboard(ctx, '2026-10', noBackup)}
        actions={actions()}
      />,
    );
    expect(screen.getByTestId('empty-month')).toHaveTextContent(/لا مبيعات في أكتوبر 2026/);
    // The tiles stay (at zero, like the old app), with the chart and lists replaced by one card.
    expect(screen.getByTestId('tile-net-sales')).toHaveTextContent(/0 د\.ل/);
    expect(screen.queryByTestId('latest-sales')).toBeNull();
    expect(screen.getByTestId('stock-summary')).toBeOnTheScreen();
  });

  it('lists what needs attention: stock, debts and a backup reminder', async () => {
    const a = actions();
    await renderScreen(
      <DashboardScreen
        system="jewelry"
        data={readDashboard(ctx, '2026-11', {
          lastCopied: null,
          firstBackup: new Date(2026, 9, 1),
        })}
        actions={a}
      />,
    );
    // The necklace sold out; the debt is the credit sale.
    expect(screen.getByTestId('attention-stock')).toHaveTextContent(/نفد 1/);
    expect(screen.getByTestId('attention-debts')).toHaveTextContent(/600 د\.ل/);
    // The backup line comes first, with the days since a copy left the device.
    expect(screen.getByTestId('attention-backup')).toHaveTextContent(
      /لا نسخة خارج الجهاز منذ \d+ (أيام|يوماً)/,
    );
    await fireEvent.press(screen.getByTestId('attention-debts'));
    expect(a.onOpenDebts).toHaveBeenCalled();
  });

  it('warns when the weekly check found a problem in the data file', async () => {
    ctx.db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('health_problem', 'x')");
    const a = actions();
    await renderScreen(
      <DashboardScreen
        system="jewelry"
        data={readDashboard(ctx, '2026-11', noBackup)}
        actions={a}
      />,
    );
    await fireEvent.press(screen.getByTestId('attention-data'));
    expect(a.onOpenBackup).toHaveBeenCalled();
  });

  it('taps a day of the chart to see its total', async () => {
    await renderScreen(
      <DashboardScreen
        system="jewelry"
        data={readDashboard(ctx, '2026-11', noBackup)}
        actions={actions()}
      />,
    );
    expect(screen.getByTestId('daily-chart-value')).toHaveTextContent('1,300 د.ل');
    await fireEvent.press(screen.getByTestId('day-3'));
    expect(screen.getByTestId('daily-chart-label')).toHaveTextContent('3/11');
    expect(screen.getByTestId('daily-chart-value')).toHaveTextContent('350 د.ل');
    await fireEvent.press(screen.getByTestId('day-3'));
    expect(screen.getByTestId('daily-chart-value')).toHaveTextContent('1,300 د.ل');
  });

  it('moves between months, opens the rate editor and the system menu', async () => {
    const a = actions();
    const data = readDashboard(ctx, '2026-11', noBackup);
    await renderScreen(<DashboardScreen system="jewelry" data={data} actions={a} />);
    // The calendar chip lists the months; picking one shows it.
    const sheet = jest
      .spyOn(ActionSheetIOS, 'showActionSheetWithOptions')
      .mockImplementation((_o, pick) => pick(0));
    await fireEvent.press(screen.getByTestId('month-picker'));
    expect(a.onMonth).toHaveBeenCalledWith(data.months[0]);
    sheet.mockRestore();
    // The shortcuts at the top.
    await fireEvent.press(screen.getByTestId('quick-sale'));
    await fireEvent.press(screen.getByTestId('quick-receipt'));
    await fireEvent.press(screen.getByTestId('quick-product'));
    expect(a.onNewSale).toHaveBeenCalled();
    expect(a.onNewReceipt).toHaveBeenCalled();
    expect(a.onNewProduct).toHaveBeenCalled();
    expect(screen.getByText('قطعة جديدة')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('rate-row'));
    expect(a.onEditRate).toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('dashboard-system'));
    expect(a.onSystemMenu).toHaveBeenCalled();
  });

  it('shows the scarves breakdown by size, with stock per size', async () => {
    const sc = makeCtx('scarves', new Date(2026, 10, 9, 10));
    const id = saveProduct(sc, {
      name: 'وشاح حرير',
      category: 'حرير',
      size: '90×90',
      price: 120_000,
      cost: 50_000,
      stock: 4,
    });
    const p = getProduct(sc, id)!;
    checkout(sc, {
      cart: (addToCart([], p, displayName(sc, p), 1) as { cart: CartLine[] }).cart,
      paymentMethod: 'cash',
    });
    await renderScreen(
      <DashboardScreen
        system="scarves"
        data={readDashboard(sc, '2026-11', noBackup)}
        actions={actions()}
      />,
      'scarves',
    );
    // Scarves: the third shortcut adds a design, and the tile counts scarves.
    expect(screen.getByText('تصميم جديد')).toBeOnTheScreen();
    expect(screen.getByTestId('tile-net-sales')).toHaveTextContent(/1 عملية • 1 وشاح/);
    await fireEvent.press(screen.getByText('المقاس'));
    expect(screen.getByTestId('by-size')).toHaveTextContent(/90×90/);
    expect(screen.getByTestId('by-size')).toHaveTextContent(/في المخزون 3/);
    sc.close();
  });
});

it('lays the cards out in three columns on a wide iPad', async () => {
  mockColumns = 3;
  await renderScreen(
    <DashboardScreen
      system="jewelry"
      data={readDashboard(ctx, '2026-11', noBackup)}
      actions={actions()}
    />,
  );
  expect(screen.getByTestId('by-category')).toBeOnTheScreen();
  expect(screen.getByTestId('stock-summary')).toBeOnTheScreen();
});
