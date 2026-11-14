import { Alert } from 'react-native';

import { ListGroup, ListRow } from '@/components';
import type { Ctx } from '@/domain/context';
import { addWanted, deleteWanted, listWanted, setWantedDone } from '@/domain/customer-care';
import { showError } from '@/features/products/actions';
import { formatDate } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';

/**
 * The pieces a customer asked for (G3): "تريد سوار ذهب عيار 21". When a matching product is
 * added, the product form reminds who wanted it. Tap one to mark it found or delete it.
 */
export function WantedCard({ ctx, customerId }: { ctx: Ctx; customerId: number }) {
  const mayEdit = useCan('customers.edit');
  const pieces = listWanted(ctx, customerId);
  const run = (f: () => void) => {
    try {
      f();
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
  };
  const add = () =>
    Alert.prompt('قطعة يطلبها الزبون', 'مثلاً: سوار ذهب عيار 21، مقاس 17', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حفظ',
        onPress: (text?: string) => run(() => addWanted(ctx, customerId, text ?? '')),
      },
    ]);
  return (
    <ListGroup
      header={`قطع يطلبها (${pieces.filter((p) => !p.doneAt).length})`}
      footer={mayEdit ? 'عند إضافة قطعة مشابهة، يذكّرك SALFORD بمن طلبها.' : undefined}>
      {pieces.map((p) => (
        <ListRow
          key={p.id}
          icon={p.doneAt ? 'checkmark.circle.fill' : 'sparkles'}
          title={p.text}
          subtitle={
            p.doneAt
              ? `وُجدت • ${formatDate(new Date(p.doneAt))}`
              : formatDate(new Date(p.createdAt))
          }
          onPress={
            mayEdit
              ? () =>
                  Alert.alert(p.text, undefined, [
                    {
                      text: p.doneAt ? 'لم تُوجد بعد' : 'وُجدت القطعة',
                      onPress: () => run(() => setWantedDone(ctx, p.id, !p.doneAt)),
                    },
                    {
                      text: 'حذف',
                      style: 'destructive',
                      onPress: () => run(() => deleteWanted(ctx, p.id)),
                    },
                    { text: 'إلغاء', style: 'cancel' },
                  ])
              : undefined
          }
          chevron={false}
          testID={`wanted-${p.id}`}
        />
      ))}
      {mayEdit ? (
        <ListRow icon="plus.circle" title="إضافة قطعة يطلبها" onPress={add} testID="wanted-add" />
      ) : null}
    </ListGroup>
  );
}
