import { useState } from 'react';
import { Alert, View } from 'react-native';

import { ListGroup, ListRow } from '@/components';
import type { Ctx } from '@/domain/context';
import {
  activeOffer,
  deleteGift,
  firstPurchase,
  friendOn,
  friendsOf,
  friendStatus,
  listGifts,
  setReferrer,
} from '@/domain/marketing';
import { ReferrerPicker } from '@/features/sale/checkout-extras';
import { showError } from '@/features/products/actions';
import { haptic } from '@/lib/haptics';
import { formatDayKey } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';
import { spacing } from '@/theme';

/**
 * A customer's marketing facts (I4): her «نفتقدك» offer, who sent her (or «من أرسلها؟» before
 * her first purchase), the friends she sent with the points they brought, and the gifts she is
 * reminded of each year (a tap deletes one). Hidden when there is nothing to show.
 */
export function MarketingCard({ ctx, customerId }: { ctx: Ctx; customerId: number }) {
  const mayEdit = useCan('customers.edit');
  const fullNames = useCan('customers.phones');
  const [asking, setAsking] = useState(false);
  const offer = activeOffer(ctx, customerId);
  const status = friendStatus(ctx, customerId);
  const friends = friendOn(ctx) ? friendsOf(ctx, customerId) : [];
  const gifts = listGifts(ctx, customerId);
  const mayAsk = mayEdit && !status && friendOn(ctx) && firstPurchase(ctx, customerId);
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
  if (!offer && !status && !friends.length && !gifts.length && !mayAsk) return null;
  return (
    <ListGroup header="التسويق">
      {offer ? (
        <ListRow
          icon="gift.fill"
          title={`عرض «نفتقدك» ${offer.percent}% بحد أقصى ${formatLyd(offer.cap)} للخصم`}
          subtitle={`صالح حتى ${formatDayKey(offer.expiresAt)} • يُختار عند البيع`}
          testID="customer-offer"
        />
      ) : null}
      {status ? (
        <ListRow
          icon="heart"
          title={`أرسلتها: ${status.referrerName}`}
          subtitle={status.ready ? `هدية أول شراء ${status.percent}% تنتظرها` : undefined}
          testID="customer-referrer"
        />
      ) : mayAsk ? (
        asking ? (
          <View style={{ padding: spacing.md }}>
            <ReferrerPicker
              ctx={ctx}
              exclude={customerId}
              value={null}
              onChange={(c) => {
                if (!c) return;
                run(() => setReferrer(ctx, customerId, c.id));
                setAsking(false);
              }}
              fullNames={fullNames}
            />
          </View>
        ) : (
          <ListRow
            icon="heart"
            title="من أرسلها؟"
            subtitle="قبل أول شراء فقط"
            onPress={() => setAsking(true)}
            testID="customer-ask-referrer"
          />
        )
      ) : null}
      {friends.map((f) => (
        <ListRow
          key={`f${f.id}`}
          icon="person.2"
          title={`أرسلت: ${f.name}`}
          value={f.points ? `${f.points} نقطة` : undefined}
          subtitle={f.waiting ? 'تُضاف النقاط بعد أن تسدد دينها' : undefined}
          testID={`customer-friend-${f.id}`}
        />
      ))}
      {gifts.map((g) => (
        <ListRow
          key={`g${g.id}`}
          icon="gift"
          title={`هدية لـ${g.forWhom}`}
          subtitle={[g.occasion, `${g.day}/${g.month}`].filter(Boolean).join(' • ')}
          onPress={
            mayEdit
              ? () =>
                  Alert.alert(
                    `حذف تذكير هدية ${g.forWhom}؟`,
                    'لن يُذكَّر بها في السنوات القادمة.',
                    [
                      { text: 'إلغاء', style: 'cancel' },
                      {
                        text: 'حذف',
                        style: 'destructive',
                        onPress: () => run(() => deleteGift(ctx, g.id)),
                      },
                    ],
                  )
              : undefined
          }
          testID={`customer-gift-${g.id}`}
        />
      ))}
    </ListGroup>
  );
}
