import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Text } from '@/components';
import type { Ctx } from '@/domain/context';
import {
  AUTO_NOTE,
  birthdayText,
  HEARD_LABELS,
  shownName,
  type Customer,
} from '@/domain/customers';
import { birthdayNote, customerStats, sinceText } from '@/domain/customer-stats';
import { balance } from '@/domain/debts';
import { getLoyalty, pointsBalance } from '@/domain/loyalty';
import { birthdayStatus, getBirthday, windowEnd } from '@/domain/birthday';
import { getRewards } from '@/domain/rewards';
import { rewardStatus } from '@/domain/visit-reward';
import { formatLyd } from '@/lib/money';
import { useLayout } from '@/hooks/use-layout';
import { haptic } from '@/lib/haptics';
import { useCan } from '@/staff/use-can';
import { spacing } from '@/theme';

import { MemberCard } from './member-card';
import { spendText, visitsText } from './model';

/**
 * The customer at checkout (G1; I3 design B): the membership card (tier, photo, name, points and
 * visit dots), then the things to act on in rows under it: visits, last visit and spending as this
 * person may see it, the visit reward, a debt, a birthday this week, the note and, under "المزيد",
 * their last purchases (pieces only, no amounts) and the details they gave.
 */
export function CustomerCard({
  ctx,
  customer: c,
  testID = 'customer-card',
}: {
  ctx: Ctx;
  customer: Customer;
  testID?: string;
}) {
  const [more, setMore] = useState(false);
  const fullName = useCan('customers.phones');
  const exact = useCan('customers.spend');
  const wide = useLayout().split;
  const id = c.id;
  // Worked out once per customer, not on every key press at checkout.
  const { rules, s, owes, reward, points, gift, giftRules } = useMemo(() => {
    const rules = getRewards(ctx);
    const giftRules = getBirthday(ctx);
    return {
      rules,
      giftRules,
      gift: birthdayStatus(ctx, id, giftRules),
      s: customerStats(ctx, id, rules),
      owes: balance(ctx, id),
      reward: rewardStatus(ctx, id, rules),
      points: getLoyalty(ctx).enabled ? pointsBalance(ctx, id) : null,
    };
  }, [ctx, id]);
  const birthday = birthdayNote(c, ctx.now());
  const note = c.notes && c.notes !== AUTO_NOTE ? c.notes : null;
  const facts = [
    visitsText(s.visits),
    s.lastVisit ? `آخر زيارة ${sinceText(s.lastVisit, ctx.now())}` : null,
    spendText(s.spent, exact, rules.ranges),
  ].filter(Boolean);
  const details = [
    c.area,
    birthdayText(c.birthMonth, c.birthDay) && `الميلاد: ${birthdayText(c.birthMonth, c.birthDay)}`,
    c.heard && `عرفنا من: ${HEARD_LABELS[c.heard]}`,
    c.ringSize && `مقاس الخاتم: ${c.ringSize}`,
    c.metal && `المعدن: ${c.metal}`,
    c.colours && `الألوان: ${c.colours}`,
    c.offers ? 'يقبل رسائل العروض' : null,
  ].filter((t): t is string => !!t);
  const hasMore = s.lastPurchases.length > 0 || details.length > 0;
  return (
    <View testID={testID} style={{ gap: spacing.sm }}>
      <MemberCard
        system={ctx.system}
        name={shownName(c.name, fullName)}
        gender={c.gender}
        imageFile={c.imageFile}
        badge={s.badge}
        points={points}
        dots={reward ? reward.dots : null}
        avatarTestID="checkout-avatar"
        testID={`${testID}-member`}
      />
      <Text variant="caption" tone="secondary" testID={`${testID}-facts`}>
        {facts.join(' • ')}
      </Text>
      {reward ? (
        <Text variant="caption" tone="accent" testID={`${testID}-reward`}>
          {reward.ready
            ? `مكافأة ${rules.percent}% جاهزة 🎁`
            : `مكافأة الزيارة ${reward.count} من ${reward.every}`}
        </Text>
      ) : null}
      {owes > 0 ? (
        <Text variant="caption" tone="warning" testID={`${testID}-owes`}>
          {`عليه دين ${formatLyd(owes)}`}
        </Text>
      ) : null}
      {birthday ? (
        <Text variant="caption" tone="accent" testID={`${testID}-birthday`}>
          {gift
            ? [
                birthday,
                gift.used
                  ? 'استُخدم خصم عيد الميلاد هذه السنة'
                  : `خصم ${giftRules.percent}% متاح حتى ${windowEnd(gift)}`,
                // The owner's own sale needs no approval: shown to the staff only.
                !gift.used && gift.needsOwner && ctx.actor?.kind !== 'owner'
                  ? 'يحتاج موافقة المالك'
                  : null,
              ]
                .filter(Boolean)
                .join(' • ')
            : birthday}
        </Text>
      ) : null}
      {note ? (
        <Text variant="caption" tone="secondary" numberOfLines={more ? undefined : 2}>
          {`ملاحظة: ${note}`}
        </Text>
      ) : null}
      {hasMore ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: more }}
          hitSlop={8}
          onPress={() => {
            haptic.tap();
            setMore((m) => !m);
          }}
          testID={`${testID}-more`}>
          <Text variant="caption" tone="accent">
            {more ? 'إخفاء' : 'المزيد'}
          </Text>
        </Pressable>
      ) : null}
      {more ? (
        <View style={{ flexDirection: wide ? 'row' : 'column', gap: spacing.ms }}>
          {s.lastPurchases.length ? (
            <View style={{ flex: wide ? 1 : undefined, gap: spacing.xxs }}>
              <Text variant="caption" tone="secondary">
                آخر المشتريات
              </Text>
              {s.lastPurchases.map((p) => (
                <Text key={p.id} variant="caption" numberOfLines={2}>
                  {`${sinceText(p.createdAt, ctx.now())}: ${p.pieces}`}
                </Text>
              ))}
            </View>
          ) : null}
          {details.length ? (
            <View style={{ flex: wide ? 1 : undefined, gap: spacing.xxs }}>
              <Text variant="caption" tone="secondary">
                تفاصيل
              </Text>
              {details.map((d) => (
                <Text key={d} variant="caption">
                  {d}
                </Text>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
