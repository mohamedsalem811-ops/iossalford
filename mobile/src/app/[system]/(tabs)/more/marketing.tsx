import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  EmptyState,
  FilterChip,
  KEYBOARD_GAP,
  ListGroup,
  ListRow,
  NumberField,
  Segmented,
  Stat,
  Text,
  TextField,
} from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { sinceText } from '@/domain/customer-stats';
import type { Customer } from '@/domain/customers';
import { getLoyalty } from '@/domain/loyalty';
import {
  cancelOffer,
  FILL_INS,
  fill,
  CANCELLED,
  getMarketing,
  giveOffers,
  missYouCandidates,
  missYouText,
  MOVING,
  occasionDate,
  offerCustomers,
  offersReport,
  setMarketing,
  setOccasionDate,
  TEMPLATE_KINDS,
  TEMPLATE_LABELS,
  type MarketingRules,
  type Occasion,
} from '@/domain/marketing';
import { Recipients } from '@/features/marketing/recipients';
import { setQueue, type QueuedMessage } from '@/features/marketing/send-queue';
import { showError } from '@/features/products/actions';
import { useReadable } from '@/hooks/use-readable';
import { countText, CUSTOMERS, DAYS, VISITS } from '@/lib/arabic-count';
import { dayKey, formatDayKey } from '@/lib/dates';
import { latinDigits, parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars, formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, useTheme } from '@/theme';

type Tab = 'occasions' | 'missYou' | 'friend' | 'templates' | 'report';
const TABS: { value: Tab; label: string }[] = [
  { value: 'occasions', label: 'مناسبات' },
  { value: 'missYou', label: 'نفتقدك' },
  { value: 'friend', label: 'صديقة' },
  { value: 'templates', label: 'رسائل' },
  { value: 'report', label: 'تقرير' },
];

/** A whole number typed in a field (Arabic digits read too), or NaN. */
const int = (t: string) => {
  const s = latinDigits(t).trim();
  return /^\d+$/.test(s) ? Number(s) : NaN;
};

/** Who an occasion or VIP message is going to, before the sender opens. */
type Picking = {
  title: string;
  kind: 'occasion' | 'vip';
  ref: string;
  customers: Customer[];
  text: (c: Customer) => string;
};

/**
 * Management → التسويق (I4, the owner): the occasion calendar and VIP first look (the owner ticks
 * who gets each message, only customers who accept offers), «نفتقدك» with a real one-time offer,
 * bring a friend, the message templates, and who came back with an offer. Messages go one at a
 * time through the step-by-step sender; SALFORD never sends anything itself.
 */
function MarketingScreen() {
  const ctx = useCtx();
  const system = ctx.system;
  const readable = useReadable();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: Tab }>();
  const [tab, setTab] = useState<Tab>(
    TABS.some((t) => t.value === params.tab) ? params.tab! : 'occasions',
  );
  const [rules, setRules] = useState<MarketingRules>(() => getMarketing(ctx));
  const [picking, setPicking] = useState<Picking | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const read = useCallback(
    () => ({
      candidates: missYouCandidates(ctx, getMarketing(ctx)),
      report: offersReport(ctx),
      loyalty: getLoyalty(ctx).enabled,
    }),
    [ctx],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => {
    setData(read());
    setRules(getMarketing(ctx));
  }, [ctx, read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);

  const year = ctx.now().getFullYear();
  /** Saves part of the rules; false when refused (the reason is shown). */
  const save = (changes: Partial<MarketingRules>) => {
    try {
      setRules(setMarketing(ctx, changes));
    } catch (error) {
      showError(error);
      return false;
    }
    haptic.success();
    notifyDataChanged();
    return true;
  };
  const send = (messages: QueuedMessage[], title: string) => {
    if (!messages.length) {
      haptic.error();
      Alert.alert('لم يُختر أحد', 'اختر زبوناً واحداً على الأقل.');
      return;
    }
    setQueue(messages, title);
    router.push({ pathname: '/[system]/send', params: { system } });
  };
  const pick = (p: Picking) => {
    setPicking(p);
    setChosen(new Set(p.customers.map((c) => c.id)));
  };

  const occasionPick = (o: Occasion) => {
    const date = occasionDate(o, year);
    if (!date) {
      haptic.error();
      Alert.alert('اكتب التاريخ أولاً', `اكتب تاريخ «${o.name}» لهذه السنة.`);
      return;
    }
    pick({
      title: o.name,
      kind: 'occasion',
      ref: `${o.key}-${year}`,
      customers: offerCustomers(ctx),
      text: (c) =>
        fill(rules.templates.occasion, { الاسم: c.name, المناسبة: o.name, التاريخ: date }),
    });
  };
  const vipPick = () =>
    pick({
      title: 'VIP: أول من يرى',
      kind: 'vip',
      ref: `vip-${dayKey(ctx.now())}`,
      customers: offerCustomers(ctx, true),
      text: (c) => fill(rules.templates.vip, { الاسم: c.name }),
    });

  const content = picking ? (
    <>
      <Card>
        <Text variant="headline">{picking.title}</Text>
        <Text variant="caption" tone="secondary">
          الزبائن الذين يقبلون رسائل العروض ولهم رقم هاتف. اختر من تصله الرسالة.
        </Text>
      </Card>
      <Recipients
        customers={picking.customers}
        chosen={chosen}
        onChange={setChosen}
        header="المستلمون"
        testID="marketing-pick"
      />
      <Button
        title={`إرسال (${chosen.size})`}
        icon="paperplane.fill"
        size="lg"
        fullWidth
        onPress={() => {
          const p = picking;
          send(
            p.customers
              .filter((c) => chosen.has(c.id))
              .map((c) => ({
                customerId: c.id,
                name: c.name,
                phone: c.phone ?? '',
                text: p.text(c),
                kind: p.kind,
                ref: p.ref,
              })),
            p.title,
          );
          setPicking(null);
        }}
        testID="marketing-send"
      />
      <Button
        title="رجوع"
        variant="secondary"
        fullWidth
        onPress={() => setPicking(null)}
        testID="marketing-pick-back"
      />
    </>
  ) : (
    <>
      <Segmented<Tab> options={TABS} value={tab} onChange={setTab} testID="marketing-tab" />
      {tab === 'occasions' ? (
        <Occasions rules={rules} year={year} onPick={occasionPick} onVip={vipPick} />
      ) : null}
      {tab === 'missYou' ? (
        <MissYou
          rules={rules}
          candidates={data.candidates}
          onSave={save}
          onGive={(ids) => {
            let given;
            try {
              given = giveOffers(ctx, ids);
            } catch (error) {
              showError(error);
              return;
            }
            haptic.success();
            notifyDataChanged();
            send(
              given.map((o) => ({
                customerId: o.customerId,
                name: o.customerName,
                phone: o.customerPhone ?? '',
                text: missYouText(rules.templates.missYou, o),
                kind: 'miss-you' as const,
                ref: o.id,
              })),
              'نفتقدك',
            );
          }}
        />
      ) : null}
      {tab === 'friend' ? <Friend rules={rules} loyalty={data.loyalty} onSave={save} /> : null}
      {tab === 'templates' ? <Templates rules={rules} onSave={save} /> : null}
      {tab === 'report' ? (
        <Report
          report={data.report}
          now={ctx.now()}
          onCancel={(id) => {
            try {
              cancelOffer(ctx, id);
            } catch (error) {
              showError(error);
              return;
            }
            haptic.success();
            notifyDataChanged();
          }}
        />
      ) : null}
      <Text variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
        رسائل واتساب تُفتح في تطبيق واتساب واحدة بعد الأخرى؛ لا يُرسل SALFORD شيئاً بنفسه.
      </Text>
    </>
  );

  return (
    <>
      <Stack.Title>التسويق</Stack.Title>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        {content}
      </KeyboardAwareScrollView>
    </>
  );
}

/** The calendar: each occasion with its date (moving ones typed for this year), and VIP. */
function Occasions({
  rules,
  year,
  onPick,
  onVip,
}: {
  rules: MarketingRules;
  year: number;
  onPick: (o: Occasion) => void;
  onVip: () => void;
}) {
  const ctx = useCtx();
  const [editing, setEditing] = useState<string | null>(null);
  const [day, setDay] = useState('');
  const [month, setMonth] = useState('');
  const saveDate = (o: Occasion) => {
    try {
      setOccasionDate(ctx, o.key, int(month), int(day));
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    setEditing(null);
  };
  return (
    <>
      <ListGroup
        header="المناسبات"
        footer="رمضان والعيدين: اكتب تاريخها كل سنة. ثم اضغط على المناسبة لاختيار من تصله الرسالة.">
        {rules.occasions.map((o) => {
          const date = occasionDate(o, year);
          return (
            <ListRow
              key={o.key}
              icon="calendar"
              title={o.name}
              subtitle={
                date ? (MOVING.has(o.key) ? `${date} (هذه السنة)` : date) : 'التاريخ غير مكتوب'
              }
              tone={date ? 'normal' : 'warning'}
              onPress={() => onPick(o)}
              testID={`marketing-occasion-${o.key}`}
            />
          );
        })}
      </ListGroup>
      <Card>
        <Text variant="headline">تاريخ هذه السنة</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {rules.occasions
            .filter((o) => MOVING.has(o.key))
            .map((o) => (
              <FilterChip
                key={o.key}
                label={o.name}
                selected={editing === o.key}
                onPress={() => {
                  setEditing(editing === o.key ? null : o.key);
                  const typed = o.year === year && o.month;
                  setDay(typed ? String(o.day) : '');
                  setMonth(typed ? String(o.month) : '');
                }}
                testID={`marketing-date-${o.key}`}
              />
            ))}
        </View>
        {editing ? (
          <>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <NumberField
                  label="اليوم"
                  value={day}
                  onChangeText={setDay}
                  kind="integer"
                  testID="marketing-date-day"
                />
              </View>
              <View style={{ flex: 1 }}>
                <NumberField
                  label="الشهر"
                  value={month}
                  onChangeText={setMonth}
                  kind="integer"
                  testID="marketing-date-month"
                />
              </View>
            </View>
            <Button
              title="حفظ التاريخ"
              onPress={() => {
                const o = rules.occasions.find((x) => x.key === editing);
                if (o) saveDate(o);
              }}
              testID="marketing-date-save"
            />
          </>
        ) : null}
      </Card>
      <ListGroup header="VIP" footer="رسالة لزبائن VIP الذين يقبلون العروض: وصلت قطع جديدة.">
        <ListRow icon="sparkles" title="VIP: أول من يرى" onPress={onVip} testID="marketing-vip" />
      </ListGroup>
    </>
  );
}

/** نفتقدك: the offer's rules, then the suggested customers to tick and give it to. */
function MissYou({
  rules,
  candidates,
  onSave,
  onGive,
}: {
  rules: MarketingRules;
  candidates: ReturnType<typeof missYouCandidates>;
  onSave: (changes: Partial<MarketingRules>) => boolean;
  onGive: (ids: number[]) => void;
}) {
  const ctx = useCtx();
  const [percent, setPercent] = useState(String(rules.offerPercent));
  const [cap, setCap] = useState(editableDinars(rules.offerCap));
  const [days, setDays] = useState(String(rules.offerDays));
  const [visits, setVisits] = useState(String(rules.missVisits));
  const [away, setAway] = useState(String(rules.missDays));
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const saveRules = () => {
    const offerCap = parseThousandths(latinDigits(cap).trim());
    if (offerCap === null) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'اكتب أقصى خصم بالدينار.');
      return;
    }
    if (
      onSave({
        offerPercent: int(percent),
        offerCap,
        offerDays: int(days),
        missVisits: int(visits),
        missDays: int(away),
      })
    )
      Alert.alert('تم الحفظ', 'تُطبَّق على العروض الجديدة من الآن.');
  };
  const list = candidates.map((x) => x.customer);
  const facts = new Map(candidates.map((x) => [x.customer.id, x]));
  return (
    <>
      <Card>
        <Text variant="headline">العرض</Text>
        <NumberField
          label="الخصم"
          value={percent}
          onChangeText={setPercent}
          suffix="٪"
          kind="integer"
          testID="marketing-offer-percent"
        />
        <NumberField
          label="بحد أقصى"
          value={cap}
          onChangeText={setCap}
          suffix="د.ل"
          testID="marketing-offer-cap"
        />
        <NumberField
          label="صالح لمدة"
          value={days}
          onChangeText={setDays}
          suffix="يوم"
          kind="integer"
          testID="marketing-offer-days"
        />
        <Text variant="subhead" tone="secondary">
          من يُقترح
        </Text>
        <NumberField
          label="اشترى في أيام لا تقل عن"
          value={visits}
          onChangeText={setVisits}
          kind="integer"
          testID="marketing-miss-visits"
        />
        <NumberField
          label="ولم يشترِ منذ"
          value={away}
          onChangeText={setAway}
          suffix="يوم"
          kind="integer"
          testID="marketing-miss-days"
        />
        <Button
          title="حفظ القواعد"
          variant="secondary"
          onPress={saveRules}
          testID="marketing-offer-save"
        />
      </Card>
      {list.length ? (
        <>
          <Recipients
            customers={list}
            chosen={chosen}
            onChange={setChosen}
            header="زبائن دائمون لم يعودوا"
            subtitle={(c) => {
              const f = facts.get(c.id);
              return f
                ? `${countText(f.visits, VISITS)} • آخر شراء ${sinceText(f.last, ctx.now())}`
                : undefined;
            }}
            testID="marketing-miss"
          />
          <Button
            title={`إعطاء العرض وإرسال (${chosen.size})`}
            icon="gift.fill"
            size="lg"
            fullWidth
            onPress={() => {
              if (!chosen.size) {
                haptic.error();
                Alert.alert('لم يُختر أحد', 'اختر زبوناً واحداً على الأقل.');
                return;
              }
              Alert.alert(
                `إعطاء العرض لـ${countText(chosen.size, CUSTOMERS)}؟`,
                `خصم ${rules.offerPercent}% بحد أقصى ${formatLyd(rules.offerCap)} للخصم، لمرة واحدة، صالح ${countText(rules.offerDays, DAYS)}. يظهر عند البيع لكل منهم.`,
                [
                  { text: 'إلغاء', style: 'cancel' },
                  {
                    text: 'إعطاء وإرسال',
                    onPress: () => {
                      onGive([...chosen]);
                      setChosen(new Set());
                    },
                  },
                ],
              );
            }}
            testID="marketing-miss-give"
          />
        </>
      ) : (
        <EmptyState icon="checkmark.circle" title="لا يوجد زبائن دائمون غائبون الآن" />
      )}
    </>
  );
}

/** Bring a friend: on/off (needs points), the friend's discount and the sender's points. */
function Friend({
  rules,
  loyalty,
  onSave,
}: {
  rules: MarketingRules;
  loyalty: boolean;
  onSave: (changes: Partial<MarketingRules>) => boolean;
}) {
  const [percent, setPercent] = useState(String(rules.friendPercent));
  const [times, setTimes] = useState(String(rules.friendTimes));
  return (
    <Card>
      <Text variant="headline">أرسلي صديقة</Text>
      <Text variant="caption" tone="secondary">
        الزبونة الجديدة تختار من أرسلها عند أول شراء، فتأخذ خصماً على أول مشترياتها (بدون حد أدنى،
        ولا يجتمع مع خصم آخر)، ويأخذ من أرسلها نقاطاً مضاعفة عن تلك البيعة، وتُسترجع إن أُرجعت
        البيعة كاملة. يُطبع على بطاقة المكافآت.
      </Text>
      {!loyalty ? (
        <Text variant="caption" tone="warning" testID="marketing-friend-needs">
          يحتاج نقاط الولاء: شغّلها أولاً من «الولاء والمكافآت».
        </Text>
      ) : null}
      <FilterChip
        label={rules.friendEnabled ? '✓ مُفعّل' : 'متوقف'}
        selected={rules.friendEnabled}
        onPress={() => onSave({ friendEnabled: !rules.friendEnabled })}
        testID="marketing-friend-toggle"
      />
      <NumberField
        label="خصم الصديقة على أول شراء"
        value={percent}
        onChangeText={setPercent}
        suffix="٪"
        kind="integer"
        testID="marketing-friend-percent"
      />
      <NumberField
        label="نقاط من أرسلها"
        value={times}
        onChangeText={setTimes}
        suffix="× نقاط البيعة"
        kind="integer"
        testID="marketing-friend-times"
      />
      <Button
        title="حفظ"
        variant="secondary"
        onPress={() => {
          if (onSave({ friendPercent: int(percent), friendTimes: int(times) }))
            Alert.alert('تم الحفظ');
        }}
        testID="marketing-friend-save"
      />
    </Card>
  );
}

/** The message templates, each with the fill-ins it may use. */
function Templates({
  rules,
  onSave,
}: {
  rules: MarketingRules;
  onSave: (changes: Partial<MarketingRules>) => boolean;
}) {
  const [texts, setTexts] = useState(rules.templates);
  return (
    <>
      {TEMPLATE_KINDS.map((k) => (
        <Card key={k}>
          <Text variant="headline">{TEMPLATE_LABELS[k]}</Text>
          <TextField
            value={texts[k]}
            onChangeText={(t) => setTexts((x) => ({ ...x, [k]: t }))}
            multiline
            maxLength={600}
            hint={`يمكن استخدام: ${FILL_INS[k].join(' ')}`}
            testID={`marketing-template-${k}`}
          />
        </Card>
      ))}
      <Button
        title="حفظ الرسائل"
        icon="checkmark.circle.fill"
        size="lg"
        fullWidth
        onPress={() => {
          if (onSave({ templates: texts })) Alert.alert('تم الحفظ');
        }}
        testID="marketing-templates-save"
      />
    </>
  );
}

/** Who got «نفتقدك» and who came back with it. */
function Report({
  report,
  now,
  onCancel,
}: {
  report: ReturnType<typeof offersReport>;
  now: Date;
  onCancel: (offerId: number) => void;
}) {
  const today = dayKey(now);
  return (
    <>
      <Card testID="marketing-report">
        <Stat label="أُعطي العرض" value={String(report.given)} />
        <Stat
          label="عادوا واستخدموه"
          value={
            report.given
              ? `${report.used} (${Math.round((report.used / report.given) * 100)}%)`
              : '0'
          }
        />
        <Text variant="caption" tone="secondary">
          {`مبيعاتهم ${formatLyd(report.sales)} • الخصم ${formatLyd(report.off)}`}
        </Text>
      </Card>
      {report.offers.length ? (
        <ListGroup header="العروض">
          {report.offers.map((o) => {
            const open = !o.usedAt && o.expiresAt >= today;
            return (
              <ListRow
                key={o.id}
                icon={o.usedAt ? 'checkmark.circle.fill' : open ? 'clock' : 'xmark.circle'}
                title={o.customerName}
                subtitle={`${o.percent}% بحد أقصى ${formatLyd(o.cap)} • ${
                  o.usedAt
                    ? `عاد ${formatDayKey(o.usedAt.slice(0, 10))}`
                    : o.expiresAt === CANCELLED
                      ? 'أُلغي'
                      : open
                        ? `صالح حتى ${formatDayKey(o.expiresAt)}`
                        : 'انتهى'
                }`}
                onPress={
                  open
                    ? () =>
                        Alert.alert(`إلغاء عرض ${o.customerName}؟`, undefined, [
                          { text: 'رجوع', style: 'cancel' },
                          {
                            text: 'إلغاء العرض',
                            style: 'destructive',
                            onPress: () => onCancel(o.id),
                          },
                        ])
                    : undefined
                }
                testID={`marketing-offer-${o.id}`}
              />
            );
          })}
        </ListGroup>
      ) : (
        <EmptyState icon="gift" title="لم يُعطَ عرض «نفتقدك» بعد" />
      )}
    </>
  );
}

/** The owner only (`marketing.manage`). */
export default function MarketingRoute() {
  return (
    <Allowed permission="marketing.manage" title="التسويق">
      <MarketingScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/marketing');
