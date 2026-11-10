import { router } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';
import { I18nManager } from 'react-native';

import { cartPieces, cartTotal } from '@/domain/cart';
import { CartAccessory } from '@/features/sale/cart-accessory';
import { useLayout } from '@/hooks/use-layout';
import { useCart } from '@/state/cart';
import { useCtx } from '@/state/system-db';
import { useTheme } from '@/theme';

/**
 * The five tabs, as native iOS 26 Liquid Glass tabs in the system's accent colour. While a sale
 * is open, the Sale tab shows how many pieces are in the cart, and the cart bar sits above the
 * tabs (on a wide iPad the cart is beside the products instead).
 */
export default function TabsLayout() {
  const { colors } = useTheme();
  const { system } = useCtx();
  const { cart } = useCart(system);
  const { cartBeside } = useLayout();
  const pieces = cartPieces(cart);
  return (
    <NativeTabs
      tintColor={colors.accent}
      minimizeBehavior="onScrollDown"
      // iOS lays the tab bar out in the device's own direction, not the app's forced Arabic
      // direction (Expo Go, or a device set to English): الرئيسية must be on the right.
      unstable_nativeProps={{ direction: I18nManager.isRTL ? 'rtl' : 'ltr' }}>
      {pieces > 0 && !cartBeside ? (
        <NativeTabs.BottomAccessory>
          <CartAccessory
            pieces={pieces}
            total={cartTotal(cart)}
            onOpen={() => router.push({ pathname: '/[system]/cart', params: { system } })}
          />
        </NativeTabs.BottomAccessory>
      ) : null}
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>الرئيسية</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="sale">
        <NativeTabs.Trigger.Label>بيع</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'cart', selected: 'cart.fill' }} />
        {pieces > 0 ? <NativeTabs.Trigger.Badge>{String(pieces)}</NativeTabs.Trigger.Badge> : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="products">
        <NativeTabs.Trigger.Label>المنتجات</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'shippingbox', selected: 'shippingbox.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="receipts">
        <NativeTabs.Trigger.Label>الإيصالات</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'doc.text', selected: 'doc.text.fill' }} />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Label>الإدارة</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'gearshape', selected: 'gearshape.fill' }} />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
