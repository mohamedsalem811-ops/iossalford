import { Card, ListGroup, ListRow, Text } from '@/components';
import { shownName } from '@/domain/customers';
import type { Gift } from '@/domain/marketing';
import { spacing } from '@/theme';

export type GiftRemindersProps = {
  gifts: (Gift & { days: number })[];
  phones: boolean;
  onGift: (gift: Gift & { days: number }) => void;
};

const when = (days: number) =>
  days === 0 ? 'اليوم' : days === 1 ? 'غداً' : days === 2 ? 'بعد يومين' : `بعد ${days} أيام`;

/**
 * The home row a week before a gift's date (I4): what a customer bought last year for someone,
 * and when; a tap offers the WhatsApp reminder (only if she still accepts messages), «تم», or
 * her page.
 */
export function GiftRemindersCard({ gifts, phones, onGift }: GiftRemindersProps) {
  if (!gifts.length) return null;
  return (
    <Card style={{ gap: spacing.sm }} testID="gift-reminders">
      <Text variant="headline">تذكير الهدايا</Text>
      <ListGroup>
        {gifts.map((g) => (
          <ListRow
            key={g.id}
            icon="gift"
            tone="warning"
            title={`${shownName(g.customerName, phones)}: هدية لـ${g.forWhom}`}
            subtitle={[
              g.occasion,
              `${g.day}/${g.month}`,
              when(g.days),
              g.customerOffers ? null : 'لا تريد رسائل',
            ]
              .filter(Boolean)
              .join(' • ')}
            onPress={() => onGift(g)}
            testID={`gift-reminder-${g.id}`}
          />
        ))}
      </ListGroup>
    </Card>
  );
}
