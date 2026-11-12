import { fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { checkout } from '@/domain/checkout';
import { addToCart, type CartLine } from '@/domain/cart';
import {
  deleteProduct,
  displayName,
  getProduct,
  listProducts,
  saveProduct,
} from '@/domain/products';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { renderScreen } from '@/testing/render';

import { ArchivedScreen } from './archived-screen';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

let ctx: TestCtx;
beforeEach(() => {
  ctx = makeCtx('jewelry', new Date(2026, 10, 9, 10));
});
afterEach(() => ctx.close());

it('lists a piece deleted after it was sold, and brings it back to the products', async () => {
  const id = saveProduct(ctx, {
    name: 'بروش',
    category: 'دبابيس',
    price: 90_000,
    cost: 40_000,
    stock: 2,
  });
  const p = getProduct(ctx, id)!;
  checkout(ctx, {
    cart: (addToCart([], p, displayName(ctx, p), 1) as { cart: CartLine[] }).cart,
    paymentMethod: 'cash',
  });
  expect(deleteProduct(ctx, id)).toBe('archived');
  expect(listProducts(ctx)).toHaveLength(0);

  jest
    .spyOn(Alert, 'alert')
    .mockImplementation((_t, _m, buttons) => buttons?.find((b) => b.text === 'إعادة')?.onPress?.());
  await renderScreen(<ArchivedScreen ctx={ctx} products={listProducts(ctx, { archived: true })} />);
  await fireEvent.press(screen.getByTestId(`archived-${p.sku}`));
  expect(listProducts(ctx).map((x) => x.name)).toEqual(['بروش']);
});

it('says what the screen is for when nothing is archived', async () => {
  await renderScreen(<ArchivedScreen ctx={ctx} products={[]} />);
  expect(screen.getByText('لا توجد قطع مؤرشفة')).toBeOnTheScreen();
});
