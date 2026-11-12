import { Alert, Linking, Pressable, View } from 'react-native';

import { Button, Card, EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import { PAYMENT_LABELS } from '@/domain/checkout';
import type { Ctx } from '@/domain/context';
import type { Customer } from '@/domain/customers';
import { deleteCustomer, deletePayment, type Payment, type StatementLine } from '@/domain/debts';
import type { Sale } from '@/domain/sales';
import { showError } from '@/features/products/actions';
import { saleSummary } from '@/features/sales/model';
import { formatDate } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { balanceText, paymentWayLabel } from './model';
import { haptic } from '@/lib/haptics';

const LINE_LABEL: Record<StatementLine['kind'], string> = {
  sale: 'بيع آجل',
  refund: 'مرتجع',
  payment: 'دفعة',
};

/**
 * A customer: contact, what they owe (or are owed), the statement of their credit sales, returns
 * and payments with the balance after each, every purchase, and their payments (a payment
 * recorded by mistake can be deleted). A customer can be deleted only when nothing links them to
 * money owed either way.
 */
export function CustomerDetail({
  ctx,
  customer: c,
  balance,
  lines,
  sales,
  payments,
  onEdit,
  onPay,
  onSale,
  onDeleted,
}: {
  ctx: Ctx;
  customer: Customer | undefined;
  balance: number;
  lines: StatementLine[];
  sales: Sale[];
  payments: Payment[];
  onEdit: () => void;
  onPay: () => void;
  onSale: (saleId: number) => void;
  onDeleted: () => void;
}) {
  const { colors } = useTheme();
  if (!c) return <EmptyState icon="person" title="الزبون غير موجود" />;
  const owed = balanceText(balance);

  const removePayment = (p: Payment) =>
    Alert.alert(
      'حذف الدفعة؟',
      `${formatLyd(p.amount)} بتاريخ ${formatDate(new Date(p.createdAt))}. يعود المبلغ ديناً على الزبون.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            deletePayment(ctx, p.id);
            notifyDataChanged();
          },
        },
      ],
    );

  const remove = () =>
    Alert.alert(`حذف «${c.name}»؟`, 'تبقى مبيعاته النقدية باسمه في السجل.', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: () => {
          try {
            deleteCustomer(ctx, c.id);
          } catch (error) {
            showError(error);
            return;
          }
          haptic.success();
          notifyDataChanged();
          onDeleted();
        },
      },
    ]);

  return (
    <Page>
      <Card>
        <Text variant="title">{c.name}</Text>
        {c.phone ? (
          <Pressable
            onPress={() => Linking.openURL(`tel:${c.phone}`).catch(() => {})}
            accessibilityRole="link"
            accessibilityLabel={`اتصال ${c.phone}`}>
            <Text variant="body" tone="accent">
              {c.phone}
            </Text>
          </Pressable>
        ) : null}
        {c.area ? (
          <Text variant="subhead" tone="secondary">
            {c.area}
          </Text>
        ) : null}
        {c.notes ? (
          <Text variant="subhead" tone="secondary">
            {c.notes}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text variant="subhead" tone="secondary">
          الرصيد
        </Text>
        <Text variant="hero" tone={balance > 0 ? 'warning' : 'accent'} testID="customer-balance">
          {owed ?? 'لا ديون'}
        </Text>
        {balance > 0 ? (
          <Button
            title="تسجيل دفعة"
            icon="banknote"
            fullWidth
            onPress={onPay}
            testID="customer-pay"
          />
        ) : null}
      </Card>

      {lines.length ? (
        <>
          <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
            كشف الحساب
          </Text>
          <Card padded={false} style={{ gap: 0 }}>
            {lines.map((l, i) => (
              <View
                key={`${l.kind}-${l.id}`}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: spacing.sm,
                  padding: spacing.ms,
                  borderTopWidth: i === 0 ? 0 : 1,
                  borderTopColor: colors.separator,
                }}>
                <View style={{ flex: 1 }}>
                  <Text variant="body">
                    {l.kind === 'sale' ? `${LINE_LABEL.sale} رقم ${l.saleId}` : LINE_LABEL[l.kind]}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {[
                      formatDate(new Date(l.createdAt)),
                      l.kind === 'payment' ? paymentWayLabel(l.note ?? '') : l.note,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text variant="bodyStrong" tone={l.amount > 0 ? 'warning' : 'accent'}>
                    {`${l.amount > 0 ? '+' : '−'}${formatLyd(Math.abs(l.amount))}`}
                  </Text>
                  <Text variant="caption" tone="secondary">
                    {`الرصيد ${formatLyd(l.balance)}`}
                  </Text>
                </View>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {payments.length ? (
        <ListGroup header="الدفعات" footer="اضغط على دفعة لحذفها إن سُجلت بالخطأ.">
          {payments.map((p) => (
            <ListRow
              key={p.id}
              icon="banknote"
              title={formatLyd(p.amount)}
              subtitle={[formatDate(new Date(p.createdAt)), paymentWayLabel(p.method), p.note]
                .filter(Boolean)
                .join(' • ')}
              onPress={() => removePayment(p)}
              chevron={false}
              testID={`payment-${p.id}`}
            />
          ))}
        </ListGroup>
      ) : null}

      <ListGroup header={`المشتريات (${sales.length})`}>
        {sales.length === 0 ? (
          <ListRow icon="cart" title="لا توجد مشتريات" />
        ) : (
          sales.map((s) => (
            <ListRow
              key={s.id}
              icon="cart"
              title={`بيعة رقم ${s.id} • ${formatLyd(s.total)}`}
              subtitle={`${formatDate(new Date(s.createdAt))} • ${PAYMENT_LABELS[s.paymentMethod]} • ${saleSummary(s)}`}
              onPress={() => onSale(s.id)}
            />
          ))
        )}
      </ListGroup>

      <Button
        title="تعديل بيانات الزبون"
        icon="pencil"
        variant="secondary"
        fullWidth
        onPress={onEdit}
      />
      <Button
        title="حذف الزبون"
        icon="trash"
        variant="destructive"
        fullWidth
        onPress={remove}
        testID="customer-delete"
      />
    </Page>
  );
}
