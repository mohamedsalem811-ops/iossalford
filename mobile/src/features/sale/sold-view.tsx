import { Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { Button, Card, EmptyState, Icon, Text } from '@/components';
import { PAYMENT_LABELS } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import { receiptForSale } from '@/domain/receipts';
import { getSale } from '@/domain/sales';
import { formatLyd } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

/**
 * After checkout: the sale is saved and its receipt issued. Shows the receipt number and what
 * was sold; "بيع جديد" goes back to selling.
 */
export function SoldView({
  ctx,
  saleId,
  onNewSale,
}: {
  ctx: Ctx;
  saleId: number;
  onNewSale: () => void;
}) {
  const { colors } = useTheme();
  const [sale] = useState(() => getSale(ctx, saleId));
  const [receipt] = useState(() => receiptForSale(ctx, saleId));
  const [showReceipt, setShowReceipt] = useState(false);
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
          <Icon name="checkmark.circle.fill" size={64} color={colors.accent} />
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

        {showReceipt && receipt ? (
          <Card testID="sold-receipt">
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="headline">{receipt.receiptNo}</Text>
              <Text variant="subhead" tone="secondary">
                {`${receipt.date} ${receipt.time}`}
              </Text>
            </View>
            <Text variant="subhead" tone="secondary">
              {receipt.customer}
            </Text>
            {receipt.items.map((it, i) => (
              <View
                key={i}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  gap: spacing.sm,
                  paddingTop: spacing.sm,
                  borderTopWidth: 1,
                  borderTopColor: colors.separator,
                }}>
                <View style={{ flex: 1 }}>
                  <Text variant="body">{`${it.name} × ${it.quantity}`}</Text>
                  {it.brand || it.code ? (
                    <Text variant="caption" tone="secondary">
                      {[it.brand, it.code].filter(Boolean).join(' • ')}
                    </Text>
                  ) : null}
                </View>
                <Text variant="body">{formatLyd(it.price * it.quantity)}</Text>
              </View>
            ))}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text variant="headline">المجموع</Text>
              <Text variant="headline" tone="accent">
                {formatLyd(receipt.total)}
              </Text>
            </View>
            <Text variant="caption" tone="secondary">
              الطباعة ومشاركة الإيصال PDF تأتي في مرحلة الإيصالات.
            </Text>
          </Card>
        ) : null}

        {receipt ? (
          <Button
            title={showReceipt ? 'إخفاء الإيصال' : 'الإيصال'}
            icon="doc.text"
            variant="secondary"
            fullWidth
            onPress={() => setShowReceipt((v) => !v)}
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
