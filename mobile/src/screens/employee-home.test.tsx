/**
 * Phase L1 on the employee's home: their target and what is left, the ranking by % with no one
 * else's amounts, the bonus on slow pieces, and what the shop owes them on their account.
 */
import { screen } from '@testing-library/react-native';
import * as Haptics from 'expo-haptics';

import { addToCart } from '@/domain/cart';
import { checkout } from '@/domain/checkout';
import { getProduct, saveProduct } from '@/domain/products';
import { creditBonuses, setGoals, setProductBonus } from '@/domain/staff-goals';
import { EMPLOYEE, makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { readMySales } from '@/features/dashboard/my-sales';
import { OWNER, type Actor } from '@/staff/model';
import { renderScreen } from '@/testing/render';

import { EmployeeHomeScreen } from './employee-home';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
const mockStore = new Map<string, string>();
jest.mock('expo-secure-store', () => ({
  getItem: (k: string) => mockStore.get(k) ?? null,
  setItem: (k: string, v: string) => void mockStore.set(k, v),
}));
jest.mock('@/hooks/use-layout', () => ({
  ...jest.requireActual('@/hooks/use-layout'),
  useLayout: () => ({ dashboardColumns: 1, split: false }),
}));

const ALI: Actor = { kind: 'employee', id: 'e2', name: 'علي' };
const people = [
  { key: 'emp-e1', name: 'سارة' },
  { key: 'emp-e2', name: 'علي' },
];

let ctx: TestCtx;
let ring: number;
beforeEach(() => {
  mockStore.clear();
  ctx = makeCtx('jewelry', new Date(2026, 10, 10, 10));
  ring = saveProduct(ctx, { name: 'خاتم', category: 'خواتم', price: 300_000, cost: 1, stock: 20 });
});
afterEach(() => ctx.close());

function sell(as: Actor, qty: number) {
  ctx.setActor(as);
  const r = addToCart([], getProduct(ctx, ring)!, 'قطعة', qty);
  if ('problem' in r) throw new Error('cart');
  checkout(ctx, { cart: r.cart, paymentMethod: 'cash' });
  ctx.setActor(OWNER);
}

async function show() {
  ctx.setActor(EMPLOYEE);
  const data = readMySales(ctx, people);
  await renderScreen(
    <EmployeeHomeScreen
      system="jewelry"
      name="سارة"
      data={data}
      actions={{
        onSystemMenu: jest.fn(),
        onOpenSale: jest.fn(),
        onNewSale: jest.fn(),
        onOpenAccount: jest.fn(),
        onOpenShift: jest.fn(),
      }}
    />,
  );
}

it('shows the target, what is left a day, and the ranking without amounts', async () => {
  setGoals(ctx, { target: 1_000_000 });
  sell(EMPLOYEE, 1);
  sell(ALI, 3);
  await show();
  expect(screen.getByTestId('my-goal')).toHaveTextContent(/30%/);
  expect(screen.getByTestId('my-goal-left')).toHaveTextContent(/باقي 700/);
  expect(screen.getByTestId('my-ranking')).toHaveTextContent(/أنا 2 من 2/);
  expect(screen.getByTestId('rank-emp-e2')).toHaveTextContent(/علي.*الأفضل.*90%/);
  // Ali's 900 is never on her screen.
  expect(screen.getByTestId('my-ranking')).not.toHaveTextContent(/900/);
});

it('celebrates the target once a month, with a haptic', async () => {
  setGoals(ctx, { target: 300_000 });
  sell(EMPLOYEE, 1);
  await show();
  expect(screen.getByTestId('my-goal-reached')).toBeTruthy();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
  await screen.unmount();
  await show();
  expect(Haptics.notificationAsync).toHaveBeenCalledTimes(1);
});

it('shows no target card with no target, and the bonus and what the shop owes her', async () => {
  setProductBonus(ctx, ring, 20_000);
  sell(EMPLOYEE, 2);
  await show();
  expect(screen.queryByTestId('my-goal')).toBeNull();
  expect(screen.getByTestId('my-bonus')).toHaveTextContent(/40/);
  await screen.unmount();
  ctx.setNow(new Date(2026, 11, 2, 10));
  ctx.setActor(OWNER);
  creditBonuses(ctx, '2026-11', people);
  await show();
  expect(screen.getByTestId('my-account')).toHaveTextContent(/لي في حسابي 40/);
});
