import { router } from 'expo-router';

import { ListGroup, ListRow } from '@/components';
import type { Ctx } from '@/domain/context';
import { listRepairs } from '@/domain/repairs';
import { dayKey } from '@/lib/dates';
import { useCan } from '@/staff/use-can';
import { useRead } from '@/state/data-events';

import { moneyLine, needsAttention, statusLine } from './model';

/**
 * A customer's repairs (J3) on her page: the ones in the shop first, then the last few done, and
 * a button for a new one.
 */
export function CustomerRepairs({ ctx, customerId }: { ctx: Ctx; customerId: number }) {
  const mayTake = useCan('repairs.take');
  const { open, done } = useRead(() =>
    mayTake
      ? {
          open: listRepairs(ctx, { customerId, show: 'open' }),
          done: listRepairs(ctx, { customerId, show: 'done' }, { limit: 5, offset: 0 }),
        }
      : { open: [], done: [] },
  );
  if (!mayTake) return null;
  const system = ctx.system;
  const today = dayKey(ctx.now());
  return (
    <ListGroup header={`الصيانة (${open.length})`}>
      {[...open, ...done].map((r) => (
        <ListRow
          key={r.id}
          icon="wrench.and.screwdriver"
          title={`${r.description} • ${r.ticketNo}`}
          subtitle={`${statusLine(r, today)} • ${moneyLine(r)}`}
          tone={needsAttention(r, today) ? 'warning' : undefined}
          onPress={() =>
            router.push({
              pathname: '/[system]/more/repair/[id]',
              params: { system, id: String(r.id) },
            })
          }
          testID={`customer-repair-${r.id}`}
        />
      ))}
      <ListRow
        icon="plus.circle"
        title="صيانة جديدة"
        onPress={() =>
          router.push({
            pathname: '/[system]/repair-form',
            params: { system, customer: String(customerId) },
          })
        }
        testID="customer-new-repair"
      />
    </ListGroup>
  );
}
