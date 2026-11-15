import { Alert, Linking, View } from 'react-native';

import { Badge, Button, Card, EmptyState, ListGroup, ListRow, Page, Text } from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import { waLink } from '@/domain/customer-care';
import { getCustomer, shownName } from '@/domain/customers';
import { lastMessage, recordMessage, type MessageKind } from '@/domain/messages';
import {
  arrivedMessage,
  CancelApprovalNeeded,
  cancelOrder,
  etaMessage,
  etaText,
  markArrived,
  OPEN_STATUSES,
  refundable,
  STATUS_LABELS,
  type CancelHow,
  type Order,
  type OrderPayment,
} from '@/domain/orders';
import { paymentWayLabel } from '@/features/customers/model';
import { ProductPhoto } from '@/features/products/product-photo';
import { dayKey, formatDate, formatTime } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { askOwner } from '@/staff/approvals';
import { useActor, useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';
import { radius, spacing } from '@/theme';

import { moneyLine, needsAttention, statusLine } from './model';

const when = (stamp: string) => `${formatDate(new Date(stamp))} ${formatTime(new Date(stamp))}`;

export type OrderActions = {
  onPay: () => void;
  onBuy: () => void;
  onDeliver: () => void;
  onReceipt: (receiptId: number) => void;
  onSale: (saleId: number) => void;
  onCustomer: (customerId: number) => void;
};

/**
 * One deposit order (I2): what was ordered and for whom, its stage and expected date, the money
 * (and the cost, for the owner), every payment with its receipt, and what can be done next by
 * whoever is signed in: a payment, تم الشراء and the date (the owner), وصلت, the delivery, the
 * WhatsApp messages, and cancelling.
 */
export function OrderDetail({
  ctx,
  order,
  payments,
  actions,
}: {
  ctx: Ctx;
  order: Order | undefined;
  payments: OrderPayment[];
  actions: OrderActions;
}) {
  const actor = useActor();
  const isOwner = actor?.kind === 'owner';
  const mayTake = useCan('orders.take');
  const mayDeliver = useCan('orders.deliver');
  const mayBuy = useCan('orders.purchase');
  const mayCancel = useCan('orders.cancel');
  const maySell = useCan('sales.create');
  const phones = useCan('customers.phones');
  const seesCost = useCan('costs.view');
  if (!order) return <EmptyState icon="shippingbox" title="الطلب غير موجود" />;
  const today = dayKey(ctx.now());
  const open = OPEN_STATUSES.includes(order.status);
  const early = refundable(order);
  const customer = getCustomer(ctx, order.customerId);
  const what = order.kind === 'hold' ? 'الحجز' : 'الطلب';

  /** The WhatsApp message for this stage, for someone who may see the number. */
  const message: { kind: MessageKind; text: string; title: string } | null =
    order.status === 'purchased'
      ? { kind: 'order-eta', text: etaMessage(order), title: 'إرسال موعد الوصول للزبون' }
      : order.status === 'arrived' || order.status === 'held'
        ? {
            kind: order.status === 'arrived' ? 'order-arrived' : 'order-waiting',
            text: arrivedMessage(order),
            title: 'رسالة: القطعة جاهزة للاستلام',
          }
        : null;
  const link = message && phones ? waLink(customer?.phone, message.text) : null;
  const sentAt = message ? lastMessage(ctx, order.customerId, message.kind, order.id) : null;
  const send = () => {
    if (!link || !message) return;
    try {
      recordMessage(ctx, { customerId: order.customerId, kind: message.kind, ref: order.id });
    } catch (error) {
      // Remembering it is a convenience: the message still opens.
      if (!(error instanceof RuleError)) throw error;
    }
    notifyDataChanged();
    Linking.openURL(link).catch(() => {});
  };

  const arrive = () =>
    Alert.alert(
      'وصلت القطعة؟',
      'تُضاف إلى المنتجات بالسعر المتفق عليه، محجوزة للزبون حتى تستلمها.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'وصلت',
          onPress: () => {
            try {
              markArrived(ctx, order.id);
            } catch (error) {
              haptic.error();
              Alert.alert('لم يُحفظ', error instanceof RuleError ? error.message : 'حدث خطأ.');
              return;
            }
            haptic.success();
            notifyDataChanged();
          },
        },
      ],
    );

  const cancel = (how: CancelHow, approval?: string) => {
    try {
      cancelOrder(ctx, order.id, { how, approval });
    } catch (error) {
      if (error instanceof CancelApprovalNeeded) {
        haptic.medium();
        askOwner(ctx.system, 'orderCancel', error.message).then((token) => {
          if (token) cancel(how, token);
        });
        return;
      }
      haptic.error();
      Alert.alert('لم يُلغَ', error instanceof RuleError ? error.message : 'حدث خطأ.');
      return;
    }
    haptic.success();
    notifyDataChanged();
  };
  const askCancel = () => {
    haptic.medium();
    const paid = formatLyd(order.paid);
    if (early)
      return Alert.alert(
        `إلغاء ${what} رقم ${order.id}؟`,
        `العربون ${paid} يُسترد${isOwner ? '' : ' بموافقة المالك'}: إلى رصيد الزبون، أو بطريقة الدفع.`,
        [
          { text: 'إلى رصيدها (له رصيد)', onPress: () => cancel('balance') },
          { text: 'استرداد بطريقة الدفع', onPress: () => cancel('refund') },
          { text: 'رجوع', style: 'cancel' },
        ],
      );
    Alert.alert(
      `إلغاء ${what} رقم ${order.id}؟`,
      `اشتُريت القطعة من المورد: العربون ${paid} لا يُسترد ويبقى للمحل، إلا إذا قررت نقله إلى رصيدها.`,
      [
        { text: 'يحتفظ المحل بالعربون', style: 'destructive', onPress: () => cancel('keep') },
        { text: 'إلى رصيدها (استثناء)', onPress: () => cancel('balance') },
        { text: 'رجوع', style: 'cancel' },
      ],
    );
  };

  const settledText =
    order.cancelHow === 'balance'
      ? `نُقل العربون ${formatLyd(order.settled)} إلى رصيد الزبون`
      : order.cancelHow === 'refund'
        ? `استُرد العربون ${formatLyd(order.settled)}`
        : order.cancelHow === 'keep'
          ? `احتفظ المحل بالعربون ${formatLyd(order.settled)}`
          : null;

  return (
    <Page>
      <Card>
        {order.imageFile ? (
          <View style={{ alignItems: 'center' }}>
            <ProductPhoto
              system={ctx.system}
              imageFile={order.imageFile}
              size={160}
              rounded={radius.lg}
            />
          </View>
        ) : null}
        <Text variant="title" testID="order-title">
          {order.description}
        </Text>
        <Text variant="subhead" tone="secondary">
          {[
            order.brand,
            order.category,
            order.size,
            order.color,
            order.quantity > 1 ? `× ${order.quantity}` : null,
          ]
            .filter(Boolean)
            .join(' • ') || (order.kind === 'hold' ? 'قطعة محجوزة من المخزون' : 'طلب من المورد')}
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.xs }}>
          <Badge label={order.kind === 'hold' ? 'حجز' : 'طلب'} />
          <Badge
            label={open ? statusLine(order, today) : STATUS_LABELS[order.status]}
            tone={needsAttention(order, today) ? 'warning' : 'accent'}
          />
        </View>
        {order.note ? <Text variant="body">{order.note}</Text> : null}
      </Card>

      <ListGroup header="الزبون">
        <ListRow
          icon="person"
          title={shownName(order.customerName, phones)}
          onPress={() => actions.onCustomer(order.customerId)}
          testID="order-customer"
        />
      </ListGroup>

      <Card>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body">السعر المتفق عليه</Text>
          <Text variant="headline">{formatLyd(order.price)}</Text>
        </View>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="body">المدفوع</Text>
          <Text variant="headline" tone="accent" testID="order-paid">
            {formatLyd(order.paid)}
          </Text>
        </View>
        {open ? (
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="body">الباقي عند الاستلام</Text>
            <Text variant="headline" testID="order-remaining">
              {formatLyd(order.remaining)}
            </Text>
          </View>
        ) : null}
        {seesCost && order.cost !== null ? (
          <Text variant="caption" tone="secondary">
            {`التكلفة ${formatLyd(order.cost)} • الربح ${formatLyd(order.price - order.cost)}`}
          </Text>
        ) : null}
        {order.eta ? (
          <Text variant="subhead" tone={needsAttention(order, today) ? 'warning' : 'secondary'}>
            {`الوصول المتوقع: ${etaText(order.eta)}`}
          </Text>
        ) : order.status === 'waiting' ? (
          <Text variant="caption" tone="secondary">
            يحدد المالك موعد الوصول عند شراء القطعة من المورد.
          </Text>
        ) : null}
        {settledText ? (
          <Text variant="subhead" tone="secondary" testID="order-settled">
            {settledText}
          </Text>
        ) : null}
        <Text variant="caption" tone="secondary">
          {open
            ? early
              ? 'العربون يُسترد قبل شراء القطعة من المورد.'
              : order.kind === 'order'
                ? 'اشتُريت القطعة: العربون لا يُسترد.'
                : ''
            : moneyLine(order)}
        </Text>
      </Card>

      {open ? (
        <View style={{ gap: spacing.sm }}>
          {mayDeliver && maySell && (order.status === 'arrived' || order.status === 'held') ? (
            <Button
              title={`تسليم للزبون • الباقي ${formatLyd(order.remaining)}`}
              icon="bag.fill"
              size="lg"
              fullWidth
              onPress={actions.onDeliver}
              testID="order-deliver"
            />
          ) : null}
          {mayBuy && order.status === 'waiting' ? (
            <Button
              title="تم الشراء من المورد"
              icon="cart.badge.plus"
              fullWidth
              onPress={actions.onBuy}
              testID="order-buy"
            />
          ) : null}
          {mayDeliver && order.status === 'purchased' ? (
            <Button
              title="وصلت القطعة"
              icon="shippingbox.fill"
              fullWidth
              onPress={arrive}
              testID="order-arrived"
            />
          ) : null}
          {mayBuy && order.status === 'purchased' ? (
            <Button
              title="تغيير موعد الوصول"
              icon="calendar"
              variant="secondary"
              fullWidth
              onPress={actions.onBuy}
              testID="order-eta"
            />
          ) : null}
          {link && message ? (
            <View style={{ gap: spacing.xxs }}>
              <Button
                title={message.title}
                icon="message"
                variant="secondary"
                fullWidth
                onPress={send}
                testID="order-whatsapp"
              />
              {sentAt ? (
                <Text variant="caption" tone="secondary" style={{ textAlign: 'center' }}>
                  {`فُتحت الرسالة ${when(sentAt)}`}
                </Text>
              ) : null}
            </View>
          ) : null}
          {mayTake && order.remaining > 0 ? (
            <Button
              title="دفعة على الطلب"
              icon="plus.circle"
              variant="secondary"
              fullWidth
              onPress={actions.onPay}
              testID="order-pay"
            />
          ) : null}
          {mayCancel && (early || mayBuy) ? (
            <Button
              title={`إلغاء ${what}`}
              icon="xmark.circle"
              variant="secondary"
              fullWidth
              onPress={askCancel}
              testID="order-cancel"
            />
          ) : null}
        </View>
      ) : order.saleId ? (
        <ListGroup>
          <ListRow
            icon="list.bullet.rectangle"
            title={`بيعة التسليم رقم ${order.saleId}`}
            onPress={() => actions.onSale(order.saleId!)}
            testID="order-sale"
          />
        </ListGroup>
      ) : null}

      <ListGroup header="الدفعات">
        {payments.map((p) => (
          <ListRow
            key={p.id}
            icon={p.kind === 'pay' ? 'arrow.down.circle' : 'arrow.up.circle'}
            title={`${p.kind === 'pay' ? 'عربون' : 'استرداد'} ${formatLyd(p.amount)} • ${paymentWayLabel(p.method)}`}
            subtitle={[when(p.createdAt), p.byName, p.receiptNo].filter(Boolean).join(' • ')}
            onPress={p.receiptId ? () => actions.onReceipt(p.receiptId!) : undefined}
            testID={`order-payment-${p.id}`}
          />
        ))}
      </ListGroup>

      <Text variant="caption" tone="secondary">
        {[
          `${order.kind === 'hold' ? 'حُجز' : 'طُلب'} ${when(order.createdAt)}${order.byName ? ` • ${order.byName}` : ''}`,
          order.approvedBy ? 'عربون أقل من الحد بموافقة المالك' : null,
          order.purchasedAt ? `اشتُري ${when(order.purchasedAt)}` : null,
          order.arrivedAt ? `وصل ${when(order.arrivedAt)}` : null,
          order.deliveredAt ? `سُلّم ${when(order.deliveredAt)}` : null,
          order.cancelledAt
            ? `أُلغي ${when(order.cancelledAt)}${order.cancelApprovedBy ? ' بموافقة المالك' : ''}`
            : null,
        ]
          .filter(Boolean)
          .join('\n')}
      </Text>
    </Page>
  );
}
