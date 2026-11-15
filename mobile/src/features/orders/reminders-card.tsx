import { Card, ListGroup, ListRow, Text } from '@/components';
import { shownName } from '@/domain/customers';
import type { Order, OrderReminders } from '@/domain/orders';
import { spacing } from '@/theme';

import { reminderRows } from './model';

/**
 * The home screen's deposit reminders (I2): orders not bought yet (the owner's), late ones, and
 * pieces waiting to be collected. A row with one order opens it; more open the list.
 */
export type OrderRemindersProps = {
  reminders: OrderReminders;
  /** The owner buys from the supplier, so only she is reminded of what is not bought yet. */
  owner: boolean;
  phones: boolean;
  onOpenOrder: (id: number) => void;
  onOpenOrders: () => void;
};

export function OrderRemindersCard({
  reminders,
  owner,
  phones,
  onOpenOrder,
  onOpenOrders,
}: OrderRemindersProps) {
  const rows = reminderRows(reminders, owner);
  if (rows.length === 0) return null;
  const names = (list: Order[]) =>
    list
      .slice(0, 3)
      .map((o) => `${o.description} (${shownName(o.customerName, phones)})`)
      .join('، ');
  return (
    <Card style={{ gap: spacing.sm }} testID="order-reminders">
      <Text variant="headline">الطلبات بعربون</Text>
      <ListGroup>
        {rows.map((r) => (
          <ListRow
            key={r.key}
            icon={r.icon}
            tone={r.key === 'late' ? 'danger' : 'warning'}
            title={r.title}
            subtitle={names(r.orders)}
            onPress={() => (r.orders.length === 1 ? onOpenOrder(r.orders[0].id) : onOpenOrders())}
            testID={`order-reminder-${r.key}`}
          />
        ))}
      </ListGroup>
    </Card>
  );
}
