import * as SecureStore from 'expo-secure-store';
import { useEffect } from 'react';
import { View } from 'react-native';

import { Appear, Badge, Card, Meter, Text } from '@/components';
import type { MyGoal } from '@/domain/staff-goals';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { spacing, useTheme } from '@/theme';

/** Whether this month's «you reached it» was already shown to this person on this device. */
const celebratedKey = (who: string) => `goal-celebrated-${who.replace(/[^A-Za-z0-9._-]/g, '_')}`;
function celebratedOnce(who: string, month: string): boolean {
  try {
    if (SecureStore.getItem(celebratedKey(who)) === month) return false;
    SecureStore.setItem(celebratedKey(who), month);
  } catch {
    // Only a convenience: at worst the celebration shows again.
  }
  return true;
}

/**
 * The employee's month (phase L1): their target and what is left, then the ranking by % of the
 * target (no one else's amounts), then the bonus on slow pieces. Reaching the target shows once a
 * month, with a haptic.
 */
export function GoalCard({ goal, who, month }: { goal: MyGoal; who: string; month: string }) {
  const { colors } = useTheme();
  useEffect(() => {
    if (goal.reached && celebratedOnce(who, month)) haptic.success();
  }, [goal.reached, who, month]);
  const hasTarget = goal.target > 0;
  return (
    <View style={{ gap: spacing.lg }}>
      {hasTarget ? (
        <Card style={{ gap: spacing.sm }} testID="my-goal">
          <Text variant="subhead" tone="secondary">
            هدفي هذا الشهر
          </Text>
          <Text variant="title">{`${goal.percent}% من ${formatLyd(goal.target)}`}</Text>
          <Meter share={goal.percent / 100} color={goal.reached ? colors.positive : undefined} />
          {goal.reached ? (
            <Appear kind="pop">
              <Text
                variant="bodyStrong"
                testID="my-goal-reached"
                style={{ color: colors.positive }}>
                تحقق الهدف! عمل رائع
              </Text>
            </Appear>
          ) : (
            <Text variant="body" testID="my-goal-left">
              {`باقي ${formatLyd(goal.left)} · ${goal.daysLeft} يوم · ${formatLyd(goal.perDay)} في اليوم`}
            </Text>
          )}
        </Card>
      ) : null}
      {goal.of > 1 ? (
        <Card style={{ gap: spacing.sm }} testID="my-ranking">
          <Text variant="subhead" tone="secondary">
            {`الترتيب هذا الشهر · أنا ${goal.place} من ${goal.of}`}
          </Text>
          {goal.ranking.map((r, i) => (
            <View key={r.key} style={{ gap: spacing.xs }} testID={`rank-${r.key}`}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text variant="bodyStrong">{`${i + 1}. ${r.name}`}</Text>
                {r.best ? <Badge label="الأفضل" tone="accent" /> : null}
              </View>
              {hasTarget ? (
                <Meter share={r.percent / 100} value={`${r.percent}%`} height={6} />
              ) : null}
            </View>
          ))}
        </Card>
      ) : null}
      {goal.bonus.earned || goal.bonus.returned ? (
        <Card style={{ gap: spacing.xs }} testID="my-bonus">
          <Text variant="subhead" tone="secondary">
            مكافأة القطع الراكدة هذا الشهر
          </Text>
          <Text variant="title" tone={goal.bonus.net < 0 ? 'negative' : 'primary'}>
            {formatLyd(goal.bonus.net)}
          </Text>
          {goal.bonus.returned ? (
            <Text variant="caption" tone="secondary">
              {`كسبت ${formatLyd(goal.bonus.earned)} · رجعت ${formatLyd(goal.bonus.returned)} بالإرجاع`}
            </Text>
          ) : null}
          <Text variant="caption" tone="secondary">
            تضاف إلى حسابي بعد نهاية الشهر
          </Text>
        </Card>
      ) : null}
    </View>
  );
}
