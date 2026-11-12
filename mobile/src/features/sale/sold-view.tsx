import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Appear, Button, EmptyState, Icon, Text } from '@/components';
import { PAYMENT_LABELS } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { receiptForSale } from '@/domain/receipts';
import { getSale } from '@/domain/sales';
import { formatLyd } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

/**
 * After checkout: the sale is saved and its receipt issued. Shows the total and the receipt
 * number; "الإيصال" opens it to print or share, "بيع جديد" goes back to selling.
 */
export function SoldView({
  ctx,
  saleId,
  onNewSale,
  onReceipt,
}: {
  ctx: Ctx;
  saleId: number;
  onNewSale: () => void;
  /** Opens the sale's receipt in the receipt studio (print, share, edit). */
  onReceipt: (receiptId: number) => void;
}) {
  const { colors } = useTheme();
  const [sale] = useState(() => getSale(ctx, saleId));
  const [receipt] = useState(() => receiptForSale(ctx, saleId));
  if (!sale) return <EmptyState icon="cart" title="البيع غير موجود" />;

  return (
    <>
      <Stack.Title>تم البيع</Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" onPress={onNewSale}>
          تم
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic">
        <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
          <Appear kind="pop">
            <Icon name="checkmark.circle.fill" size={64} color={colors.accent} />
          </Appear>
          <Text variant="title" center testID="sold-title">
            تم البيع بنجاح
          </Text>
          <Text variant="hero" tone="accent" center testID="sold-total">
            {formatLyd(sale.total)}
          </Text>
          <Text variant="subhead" tone="secondary" center>
            {[
              PAYMENT_LABELS[sale.paymentMethod],
              sale.customerName,
              receipt ? `إيصال ${receipt.receiptNo}` : null,
            ]
              .filter(Boolean)
              .join(' • ')}
          </Text>
        </View>

        {receipt ? (
          <Button
            title="الإيصال: طباعة ومشاركة"
            icon="doc.text"
            variant="secondary"
            fullWidth
            onPress={() => onReceipt(receipt.id)}
            testID="sold-show-receipt"
          />
        ) : null}
        <Button
          title="بيع جديد"
          icon="cart.badge.plus"
          size="lg"
          fullWidth
          onPress={onNewSale}
          testID="sold-new-sale"
        />
      </ScrollView>
    </>
  );
}
