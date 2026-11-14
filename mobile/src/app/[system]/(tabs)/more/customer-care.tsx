import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { Card, EmptyState, ListGroup, ListRow, Page, Segmented, Stat, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  birthdayMessage,
  birthdaysThisWeek,
  customerReport,
  duplicateCustomers,
  mergeCustomers,
  missYouMessage,
  notBack,
  waLink,
} from '@/domain/customer-care';
import { sinceText } from '@/domain/customer-stats';
import {
  birthdayText,
  HEARD_LABELS,
  shownName,
  shownPhone,
  type Customer,
} from '@/domain/customers';
import { birthdayOn, getBirthday, windowEnd, windowText } from '@/domain/birthday';
import { showError } from '@/features/products/actions';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { useCan } from '@/staff/use-can';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { spacing } from '@/theme';

type Tab = 'birthdays' | 'away' | 'duplicates' | 'report';

/**
 * Management → Customers → متابعة الزبائن (G3): birthdays this week, customers who haven't come
 * back in 90 days, each with a WhatsApp message for those who accept offers (the owner, or an
 * employee who sees the phones), duplicate customers with their merge (owner), and the owner's
 * customer report.
 */
export default function CustomerCareRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(params.tab ?? 'birthdays');
  const phones = useCan('customers.phones');
  const mayMerge = useCan('customers.merge');
  const mayReport = useCan('reports.view');
  const read = useCallback(
    () => ({
      birthdays: birthdaysThisWeek(ctx),
      away: notBack(ctx, 90),
      duplicates: mayMerge ? duplicateCustomers(ctx) : [],
      report: mayReport ? customerReport(ctx) : null,
      gift: getBirthday(ctx),
    }),
    [ctx, mayMerge, mayReport],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  const open = (c: Customer) =>
    router.push({ pathname: '/[system]/more/customer/[id]', params: { system, id: String(c.id) } });
  /** A tap: the customer's page, or a WhatsApp message when allowed. */
  const choose = (c: Customer, message: string) => {
    const link = phones && c.offers ? waLink(c.phone, message) : null;
    if (!link) return open(c);
    Alert.alert(shownName(c.name, phones), undefined, [
      { text: 'رسالة واتساب', onPress: () => Linking.openURL(link).catch(() => {}) },
      { text: 'صفحة الزبون', onPress: () => open(c) },
      { text: 'إلغاء', style: 'cancel' },
    ]);
  };
  const merge = (keep: Customer, drop: Customer) =>
    Alert.alert(
      `دمج «${drop.name}» في «${keep.name}»؟`,
      `تنتقل مشتريات ${shownPhone(drop.phone, true) ?? 'الثاني'} ودفعاته ونقاطه إلى ${shownPhone(keep.phone, true) ?? 'الأول'}، ويُحذف المكرر.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'دمج',
          style: 'destructive',
          onPress: () => {
            try {
              mergeCustomers(ctx, keep.id, drop.id);
            } catch (error) {
              showError(error);
              return;
            }
            haptic.success();
            notifyDataChanged();
          },
        },
      ],
    );

  const tabs: { value: Tab; label: string }[] = [
    { value: 'birthdays', label: 'أعياد الميلاد' },
    { value: 'away', label: 'لم يعودوا' },
    ...(mayMerge ? [{ value: 'duplicates' as const, label: 'المكررون' }] : []),
    ...(mayReport ? [{ value: 'report' as const, label: 'التقرير' }] : []),
  ];
  const offersHint = phones
    ? 'اضغط على زبون يقبل رسائل العروض لإرسال رسالة واتساب جاهزة.'
    : undefined;
  return (
    <>
      <Stack.Title>متابعة الزبائن</Stack.Title>
      <Page>
        <Segmented<Tab> options={tabs} value={tab} onChange={setTab} testID="care-tab" />
        {tab === 'birthdays' ? (
          data.birthdays.length ? (
            <ListGroup header="أعياد الميلاد: آخر 3 أيام والأسبوع القادم" footer={offersHint}>
              {data.birthdays.map(({ customer: c, days, window }) => (
                <ListRow
                  key={c.id}
                  icon="gift"
                  title={shownName(c.name, phones)}
                  subtitle={[
                    birthdayText(c.birthMonth, c.birthDay),
                    days === 0
                      ? 'اليوم 🎂'
                      : days === 1
                        ? 'غداً'
                        : days === -1
                          ? 'كان أمس'
                          : days < 0
                            ? `كان قبل ${days === -2 ? 'يومين' : `${-days} أيام`}`
                            : `بعد ${days === 2 ? 'يومين' : `${days} أيام`}`,
                    birthdayOn(data.gift) ? `الخصم حتى ${windowEnd(window)}` : null,
                    c.offers ? 'يقبل العروض' : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                  onPress={() =>
                    choose(
                      c,
                      birthdayMessage(
                        c,
                        birthdayOn(data.gift)
                          ? { percent: data.gift.percent, when: windowText(window) }
                          : null,
                      ),
                    )
                  }
                  testID={`care-birthday-${c.id}`}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState icon="gift" title="لا أعياد ميلاد هذا الأسبوع" />
          )
        ) : null}
        {tab === 'away' ? (
          data.away.length ? (
            <ListGroup header={`لم يشتروا منذ 90 يوماً (${data.away.length})`} footer={offersHint}>
              {data.away.map(({ customer: c, last }) => (
                <ListRow
                  key={c.id}
                  icon="clock"
                  title={shownName(c.name, phones)}
                  subtitle={[
                    `آخر شراء ${sinceText(last, ctx.now())}`,
                    c.offers ? 'يقبل العروض' : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                  onPress={() => choose(c, missYouMessage(c))}
                  testID={`care-away-${c.id}`}
                />
              ))}
            </ListGroup>
          ) : (
            <EmptyState icon="checkmark.circle" title="كل الزبائن زاروا المحل في آخر 90 يوماً" />
          )
        ) : null}
        {tab === 'duplicates' ? (
          data.duplicates.length ? (
            data.duplicates.map((group) => (
              <ListGroup
                key={group[0].id}
                header={`«${group[0].name}» برقمين`}
                footer="اضغط على الزبون الذي تريد إبقاءه، ثم اختر من يُدمج فيه.">
                {group.map((c) => (
                  <ListRow
                    key={c.id}
                    icon="person.2"
                    title={shownPhone(c.phone, true) ?? 'بدون هاتف'}
                    subtitle={[c.area, c.notes].filter(Boolean).join(' • ') || undefined}
                    onPress={() =>
                      Alert.alert(
                        `إبقاء ${shownPhone(c.phone, true) ?? 'هذا الزبون'}`,
                        'اختر الزبون الذي يُدمج فيه:',
                        [
                          ...group
                            .filter((o) => o.id !== c.id)
                            .map((o) => ({
                              text: shownPhone(o.phone, true) ?? 'بدون هاتف',
                              onPress: () => merge(c, o),
                            })),
                          { text: 'إلغاء', style: 'cancel' as const },
                        ],
                      )
                    }
                    testID={`care-duplicate-${c.id}`}
                  />
                ))}
              </ListGroup>
            ))
          ) : (
            <EmptyState icon="person.2" title="لا يوجد زبائن مكررون" />
          )
        ) : null}
        {tab === 'report' && data.report ? (
          <>
            <Card>
              <Text variant="subhead" tone="secondary">
                {`هذه السنة: ${data.report.buyers} زبون اشترى`}
              </Text>
              <Stat
                label="الزبائن العائدون"
                value={
                  data.report.buyers
                    ? `${Math.round((data.report.returning / data.report.buyers) * 100)}% (${data.report.returning})`
                    : '—'
                }
              />
              <Text variant="caption" tone="secondary">
                {`مكافآت الزيارة: ${data.report.rewards.count} • ${formatLyd(data.report.rewards.off)} — خصومات عيد الميلاد: ${data.report.birthdays.count} • ${formatLyd(data.report.birthdays.off)} — النقاط المكتسبة: ${data.report.points.earned} • مدفوع بالنقاط ${formatLyd(data.report.points.paid)}`}
              </Text>
            </Card>
            <ListGroup header="من أين يأتي الزبائن">
              {data.report.bySource
                .filter((s) => s.customers > 0)
                .map((s) => (
                  <ListRow
                    key={s.heard ?? 'none'}
                    icon="megaphone"
                    title={s.heard ? HEARD_LABELS[s.heard] : 'غير محدد'}
                    subtitle={`${s.customers} زبون`}
                    value={formatLyd(s.spent)}
                  />
                ))}
            </ListGroup>
            {(['topMonth', 'topYear'] as const).map((k) =>
              data.report![k].length ? (
                <ListGroup
                  key={k}
                  header={k === 'topMonth' ? 'أفضل الزبائن هذا الشهر' : 'أفضل الزبائن هذه السنة'}>
                  {data.report![k].map(({ customer: c, spent }) => (
                    <ListRow
                      key={c.id}
                      icon="star"
                      title={c.name}
                      value={formatLyd(spent)}
                      onPress={() => open(c)}
                    />
                  ))}
                </ListGroup>
              ) : null,
            )}
          </>
        ) : null}
        <Text variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          رسائل واتساب تُفتح في تطبيق واتساب؛ لا يُرسل SALFORD شيئاً بنفسه.
        </Text>
      </Page>
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/customer-care');
