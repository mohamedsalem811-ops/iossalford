import { router } from 'expo-router';

import { ListGroup, ListRow } from '@/components';
import type { Ctx } from '@/domain/context';
import { listOrders, STATUS_LABELS } from '@/domain/orders';
import { dayKey } from '@/lib/dates';
import { useCan } from '@/staff/use-can';
import { useRead } from '@/state/data-events';

import { moneyLine, needsAttention, statusLine } from './model';

/**
 * A customer's deposit orders and holds (I2) on their page: the open ones first, then the last
 * few done, and a button for a new one.
 */
export function CustomerOrders({ ctx, customerId }: { ctx: Ctx; customerId: number }) {
  const mayTake = useCan('orders.take');
  // Read again after each change (useRead): a deposit taken for her shows when her page is back.
  const { open, done } = useRead(() =>
    mayTake
      ? {
          open: listOrders(ctx, { customerId, show: 'open' }),
          done: listOrders(ctx, { customerId, show: 'done' }, { limit: 5, offset: 0 }),
        }
      : { open: [], done: [] },
  );
  if (!mayTake) return null;
  const system = ctx.system;
  const today = dayKey(ctx.now());
  const isOpen = (status: string) => status !== 'delivered' && status !== 'cancelled';
  return (
    <ListGroup header={`الطلبات بعربون (${open.length})`}>
      {[...open, ...done].map((o) => (
        <ListRow
          key={o.id}
          icon={o.kind === 'hold' ? 'lock.fill' : 'shippingbox'}
          title={`${o.description} • رقم ${o.id}`}
          subtitle={`${isOpen(o.status) ? statusLine(o, today) : STATUS_LABELS[o.status]} • ${moneyLine(o)}`}
          tone={isOpen(o.status) && needsAttention(o, today) ? 'warning' : undefined}
          onPress={() =>
            router.push({
              pathname: '/[system]/more/order/[id]',
              params: { system, id: String(o.id) },
            })
          }
          testID={`customer-order-${o.id}`}
        />
      ))}
      <ListRow
        icon="plus.circle"
        title="طلب أو حجز جديد"
        onPress={() =>
          router.push({
            pathname: '/[system]/order-form',
            params: { system, customer: String(customerId) },
          })
        }
        testID="customer-new-order"
      />
    </ListGroup>
  );
}
