import { Alert, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import { PAYMENT_LABELS } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import type { Receipt } from '@/domain/receipts';
import { deleteSale, type Sale } from '@/domain/sales';
import { showError } from '@/features/products/actions';
import { formatDate, formatTime } from '@/lib/dates';
import { formatLyd, formatRate } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { returnable, saleReturned } from './model';
import { haptic } from '@/lib/haptics';
import { useCan } from '@/staff/use-can';

/**
 * One sale: when, how it was paid, who bought, every line (its set, price, and how many came back),
 * the totals; a return per line, the receipt, and delete (stock not already returned goes back).
 */
export function SaleDetail({
  ctx,
  sale,
  receipt,
  onReturn,
  onReceipt,
  onCustomer,
  onDeleted,
}: {
  ctx: Ctx;
  sale: Sale | undefined;
  receipt: Receipt | undefined;
  onReturn: (lineId: number) => void;
  onReceipt: (receiptId: number) => void;
  onCustomer?: (customerId: number) => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  const seesCost = useCan('costs.view');
  const mayReturn = useCan('returns.create');
  const mayDelete = useCan('sales.delete');
  const seesSellers = useCan('sales.viewAll');
  if (!sale) return <EmptyState icon="cart" title="البيعة غير موجودة" />;
  const when = new Date(sale.createdAt);
  const profit = sale.total - sale.totalCost;
  const returned = saleReturned(sale);

  const remove = () =>
    Alert.alert(
      `حذف البيعة رقم ${sale.id}؟`,
      [
        'للبيعة المسجلة بالخطأ. تعود للمخزون القطع التي لم تُرجع بعد، وتُحذف مرتجعات هذه البيعة.',
        receipt ? `الإيصال ${receipt.receiptNo} يبقى في سجل الإيصالات برقمه.` : null,
        sale.paymentMethod === 'credit' ? 'ويُلغى دين هذه البيعة على الزبون.' : null,
      ]
        .filter(Boolean)
        .join('\n'),
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف البيعة',
          style: 'destructive',
          onPress: () => {
            try {
              deleteSale(ctx, sale.id);
            } catch (error) {
              showError(error);
              return;
            }
            haptic.success();
            notifyDataChanged();
            onDeleted();
          },
        },
      ],
    );

  return (
    <Page>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <Text variant="title" style={{ flex: 1 }}>
            {formatLyd(sale.total)}
          </Text>
          <Badge
            label={PAYMENT_LABELS[sale.paymentMethod]}
            tone={sale.paymentMethod === 'credit' ? 'warning' : 'accent'}
          />
        </View>
        <Text variant="subhead" tone="secondary">
          {`${formatDate(when)} • ${formatTime(when)} • سعر الصرف ${formatRate(sale.rate)}`}
        </Text>
        {sale.note ? <Text variant="body">{`ملاحظة: ${sale.note}`}</Text> : null}
        {seesSellers && sale.seller !== 'owner' ? (
          <Text variant="subhead" testID="sale-seller">{`البائع: ${sale.sellerName}`}</Text>
        ) : null}
      </Card>

      <ListGroup header="الزبون">
        <ListRow
          icon="person"
          title={sale.customerName ?? 'بدون زبون'}
          onPress={sale.customerId && onCustomer ? () => onCustomer(sale.customerId!) : undefined}
        />
      </ListGroup>

      <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
        {`القطع${returned ? ` • مرتجع ${returned}` : ''}`}
      </Text>
      <Card padded={false} style={{ gap: 0 }}>
        {sale.lines.map((l, i) => {
          const left = returnable(l);
          return (
            <View
              key={l.id}
              testID={`sale-line-${l.id}`}
              style={{
                padding: spacing.md,
                gap: spacing.xxs,
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: colors.separator,
              }}>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Text variant="bodyStrong" style={{ flex: 1 }}>
                  {`${l.name} × ${l.quantity}`}
                </Text>
                <Text variant="bodyStrong">{formatLyd(l.lineTotal)}</Text>
              </View>
              <Text variant="caption" tone="secondary">
                {[
                  l.sku,
                  l.brand,
                  l.setName ? `طقم ${l.setName}` : null,
                  `${formatLyd(l.unitPrice)} للقطعة`,
                  l.unitPrice !== l.listPrice ? `السعر المسجل ${formatLyd(l.listPrice)}` : null,
                ]
                  .filter(Boolean)
                  .join(' • ')}
              </Text>
              {l.returned ? (
                <Text
                  variant="caption"
                  tone="warning">{`أُرجع ${l.returned} من ${l.quantity}`}</Text>
              ) : null}
              {left > 0 && mayReturn ? (
                <Button
                  title="إرجاع"
                  icon="arrow.uturn.backward"
                  variant="ghost"
                  size="sm"
                  style={{ alignSelf: 'flex-start' }}
                  onPress={() => onReturn(l.id)}
                  testID={`sale-return-${l.id}`}
                />
              ) : null}
            </View>
          );
        })}
      </Card>

      {seesCost ? (
        <Card>
          <Row label="المجموع" value={formatLyd(sale.total)} />
          <Row label="التكلفة" value={formatLyd(sale.totalCost)} />
          <Row label="الربح" value={formatLyd(profit)} strong />
        </Card>
      ) : null}

      {receipt ? (
        <Button
          title={`الإيصال ${receipt.receiptNo}`}
          icon="doc.text"
          variant="secondary"
          fullWidth
          onPress={() => onReceipt(receipt.id)}
          testID="sale-receipt"
        />
      ) : null}
      {mayDelete ? (
        <Button
          title="حذف البيعة"
          icon="trash"
          variant="destructive"
          fullWidth
          onPress={remove}
          testID="sale-delete"
        />
      ) : null}
    </Page>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Text variant={strong ? 'headline' : 'subhead'} tone={strong ? 'primary' : 'secondary'}>
        {label}
      </Text>
      <Text variant={strong ? 'headline' : 'subhead'} tone={strong ? 'accent' : 'primary'}>
        {value}
      </Text>
    </View>
  );
}
