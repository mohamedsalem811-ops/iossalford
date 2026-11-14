import { View } from 'react-native';

import { Badge, Card, Segmented, Text } from '@/components';
import type { Ctx } from '@/domain/context';
import {
  birthdayText,
  HEARD_LABELS,
  setVip,
  type Customer,
  type VipChoice,
} from '@/domain/customers';
import { BADGE_LABELS, birthdayNote, customerStats, sinceText } from '@/domain/customer-stats';
import { getRewards } from '@/domain/rewards';
import { showError } from '@/features/products/actions';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';
import { spacing } from '@/theme';

import { spendText, visitsText } from './model';

type VipPick = VipChoice | 'auto';

/**
 * On the customer page (G1): VIP, returning or new, visits, last visit, spending (a range for an
 * employee without the grant), the birthday and the details they gave; the owner sets VIP by hand.
 */
export function CustomerFacts({ ctx, customer: c }: { ctx: Ctx; customer: Customer }) {
  const exact = useCan('customers.spend');
  const mayVip = useCan('customers.vip');
  const rules = getRewards(ctx);
  const s = customerStats(ctx, c.id, rules, c);
  const birthday = birthdayText(c.birthMonth, c.birthDay);
  const soon = birthdayNote(c, ctx.now());
  const rows: [string, string][] = [
    ['الزيارات', visitsText(s.visits)],
    ...(s.lastVisit ? [['آخر زيارة', sinceText(s.lastVisit, ctx.now())] as [string, string]] : []),
    ['المشتريات', spendText(s.spent, exact, rules.ranges)],
    ...(exact
      ? [[`آخر ${rules.vipMonths} شهراً`, formatLyd(s.spentInWindow)] as [string, string]]
      : []),
    ...(birthday ? [['الميلاد', birthday] as [string, string]] : []),
    ...(c.heard ? [['عرفنا من', HEARD_LABELS[c.heard]] as [string, string]] : []),
    ...(c.ringSize ? [['مقاس الخاتم', c.ringSize] as [string, string]] : []),
    ...(c.metal ? [['المعدن', c.metal] as [string, string]] : []),
    ...(c.colours ? [['الألوان', c.colours] as [string, string]] : []),
    ['رسائل العروض', c.offers ? 'يقبل' : 'لا'],
  ];
  const changeVip = (v: VipPick) => {
    try {
      setVip(ctx, c.id, v === 'auto' ? null : v);
    } catch (error) {
      showError(error);
      return;
    }
    haptic.tap();
    notifyDataChanged();
  };
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Text variant="subhead" tone="secondary" style={{ flex: 1 }}>
          الزبون عندنا
        </Text>
        <Badge label={BADGE_LABELS[s.badge]} tone={s.badge === 'vip' ? 'warning' : 'accent'} />
      </View>
      {soon ? (
        <Text variant="bodyStrong" tone="accent" testID="customer-birthday-soon">
          {soon}
        </Text>
      ) : null}
      {rows.map(([label, value]) => (
        <View key={label} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text variant="subhead" tone="secondary">
            {label}
          </Text>
          <Text variant="subhead" testID={`customer-fact-${label}`}>
            {value}
          </Text>
        </View>
      ))}
      {mayVip ? (
        <>
          <Text variant="caption" tone="secondary">
            {`VIP تلقائياً لمن اشترى بأكثر من ${formatLyd(rules.vipSpend)} في آخر ${rules.vipMonths} شهراً، أو اختر:`}
          </Text>
          <Segmented<VipPick>
            options={[
              { value: 'auto', label: 'تلقائي' },
              { value: 'always', label: 'VIP دائماً' },
              { value: 'never', label: 'ليس VIP' },
            ]}
            value={c.vip ?? 'auto'}
            onChange={changeVip}
            testID="customer-vip"
          />
        </>
      ) : null}
    </Card>
  );
}
