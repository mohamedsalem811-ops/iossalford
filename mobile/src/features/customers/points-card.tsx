import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, Card, Text } from '@/components';
import type { Ctx } from '@/domain/context';
import {
  adjustPoints,
  getLoyalty,
  LOYALTY_LABELS,
  loyaltyMoves,
  pointsBalance,
  pointsText,
} from '@/domain/loyalty';
import { showError } from '@/features/products/actions';
import { formatDate } from '@/lib/dates';
import { latinDigits } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCan } from '@/staff/use-can';
import { spacing } from '@/theme';

/**
 * A customer's loyalty points (feature 34): the balance, the last moves, and for the owner an
 * adjustment with a reason. Hidden while points are off and the customer has none.
 */
export function PointsCard({ ctx, customerId }: { ctx: Ctx; customerId: number }) {
  const mayAdjust = useCan('loyalty.adjust');
  const read = useCallback(
    () => ({
      rules: getLoyalty(ctx),
      balance: pointsBalance(ctx, customerId),
      moves: loyaltyMoves(ctx, customerId, 5),
    }),
    [ctx, customerId],
  );
  const [data, setData] = useState(read);
  useOnDataChanged(useCallback(() => setData(read()), [read]));
  const { rules, balance, moves } = data;
  if (!rules.enabled && balance === 0 && moves.length === 0) return null;

  const adjust = () =>
    Alert.prompt(
      'تعديل النقاط',
      `الرصيد ${balance} نقطة. اكتب العدد المضاف، أو بعلامة − للخصم (مثلاً −20).`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'التالي',
          onPress: (text?: string) => {
            const t = latinDigits(text ?? '')
              .replace(/\s/g, '')
              .replace('−', '-');
            const delta = Number(t);
            if (!t || !Number.isInteger(delta) || delta === 0) {
              haptic.error();
              Alert.alert('لم يتم الحفظ', 'اكتب عدد النقاط رقماً صحيحاً.');
              return;
            }
            Alert.prompt('سبب التعديل', 'يُسجَّل في سجل النشاط.', [
              { text: 'إلغاء', style: 'cancel' },
              {
                text: 'حفظ',
                onPress: (reason?: string) => {
                  try {
                    adjustPoints(ctx, customerId, delta, reason ?? '');
                  } catch (error) {
                    showError(error);
                    return;
                  }
                  haptic.success();
                  notifyDataChanged();
                },
              },
            ]);
          },
        },
      ],
      'plain-text',
      '',
      'numbers-and-punctuation',
    );

  return (
    <Card>
      <Text variant="subhead" tone="secondary">
        {rules.enabled ? 'نقاط الولاء' : 'نقاط الولاء (متوقفة)'}
      </Text>
      <Text variant="title" tone="accent" testID="customer-points">
        {pointsText(balance, rules)}
      </Text>
      {moves.map((m) => (
        <View
          key={m.id}
          style={{ flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm }}>
          <Text variant="caption" tone="secondary" style={{ flex: 1 }} numberOfLines={1}>
            {`${formatDate(new Date(m.createdAt))} • ${LOYALTY_LABELS[m.kind]}${
              m.kind === 'adjust' && m.note ? `: ${m.note}` : ''
            }`}
          </Text>
          <Text variant="caption" tone={m.points > 0 ? 'accent' : 'secondary'}>
            {m.points > 0 ? `+${m.points}` : `−${-m.points}`}
          </Text>
        </View>
      ))}
      {mayAdjust ? (
        <Button
          title="تعديل النقاط"
          icon="plusminus.circle"
          variant="secondary"
          fullWidth
          onPress={adjust}
          testID="customer-points-adjust"
        />
      ) : null}
    </Card>
  );
}
