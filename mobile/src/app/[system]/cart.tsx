import { router, Stack } from 'expo-router';

import { CartView } from '@/features/sale/cart-view';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** The cart sheet (iPhone, and iPad when the cart is not beside the products). */
export default function CartRoute() {
  const ctx = useCtx();
  return (
    <>
      <Stack.Title>السلة</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={() => router.back()}>إغلاق</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <CartView
        ctx={ctx}
        onCheckout={() =>
          router.replace({ pathname: '/[system]/checkout', params: { system: ctx.system } })
        }
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('cart');
