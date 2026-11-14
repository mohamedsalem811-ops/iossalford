import { router, Stack } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import {
  KeyboardAwareScrollView,
  type KeyboardAwareScrollViewRef,
} from 'react-native-keyboard-controller';

import { Button, Card, FilterChip, KEYBOARD_GAP, NumberField, Text, TextField } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { getLoyalty, setLoyalty, type LoyaltyRules } from '@/domain/loyalty';
import { getRewards, setRewards, type RewardRules } from '@/domain/rewards';
import { getBirthday, setBirthday, type BirthdayRules } from '@/domain/birthday';
import { getContact, setContact, SOCIAL_LABELS, SOCIALS, type Social } from '@/domain/contact';
import { dismissedSetup, dismissSetup, restoreSetup, type SetupItem } from '@/domain/setup';
import { SetupCard } from '@/features/setup/setup-card';
import { useSetup } from '@/features/setup/use-setup';
import { showError } from '@/features/products/actions';
import { useReadable } from '@/hooks/use-readable';
import { useSaveOnce } from '@/hooks/use-save-once';
import { latinDigits, parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { editableDinars, formatLyd } from '@/lib/money';
import { notifyDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, useTheme } from '@/theme';

/**
 * Settings → الولاء والمكافآت (the owner), in sections: the points (feature 34): on or off, how
 * much a customer pays for one point, what a point pays, the fewest points that can be used and
 * the largest share of a sale points may pay; the visit reward (G2); VIP; and the spending ranges
 * an employee sees. Points and the reward are off until the owner turns them on; every change is
 * logged.
 */
const int = (t: string) => Number(latinDigits(t).trim());

function LoyaltyScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const once = useSaveOnce(true);
  const [saved, setSaved] = useState<LoyaltyRules>(() => getLoyalty(ctx));
  const [enabled, setEnabled] = useState(saved.enabled);
  const [spend, setSpend] = useState(editableDinars(saved.spendPerPoint));
  const [value, setValue] = useState(editableDinars(saved.pointValue));
  const [min, setMin] = useState(String(saved.minRedeem));
  const [share, setShare] = useState(String(saved.maxShare));
  const [rewards, setRewardsSaved] = useState<RewardRules>(() => getRewards(ctx));
  const [rewardOn, setRewardOn] = useState(rewards.enabled);
  const [minPurchase, setMinPurchase] = useState(editableDinars(rewards.minPurchase));
  const [every, setEvery] = useState(String(rewards.every));
  const [percent, setPercent] = useState(String(rewards.percent));
  const [maxOff, setMaxOff] = useState(editableDinars(rewards.maxOff));
  const [minRewardSale, setMinRewardSale] = useState(editableDinars(rewards.minRewardSale));
  const [vipSpend, setVipSpend] = useState(editableDinars(rewards.vipSpend));
  const [vipMonths, setVipMonths] = useState(String(rewards.vipMonths));
  const [vipTimes, setVipTimes] = useState(String(rewards.vipPointsTimes));
  const [birthday, setBirthdaySaved] = useState<BirthdayRules>(() => getBirthday(ctx));
  const [giftOn, setGiftOn] = useState(birthday.enabled);
  const [giftPercent, setGiftPercent] = useState(String(birthday.percent));
  const [giftMax, setGiftMax] = useState(birthday.maxOff ? editableDinars(birthday.maxOff) : '');
  const [giftMin, setGiftMin] = useState(birthday.minSale ? editableDinars(birthday.minSale) : '');
  const [contact, setContactForm] = useState(() => {
    const c = getContact(ctx);
    return {
      whatsapp: c.whatsapp ?? '',
      instagram: c.instagram ?? '',
      facebook: c.facebook ?? '',
      tiktok: c.tiktok ?? '',
    };
  });
  const setup = useSetup();
  const scroll = useRef<KeyboardAwareScrollViewRef>(null);
  /** Where each section starts, to scroll to it from "يحتاج إعداد". */
  // A plain object kept for the screen's life: written by onLayout, read on a tap.
  const [at] = useState<Partial<Record<SetupItem['goes'], number>>>(() => ({}));
  const mark = (k: SetupItem['goes']) => ({
    onLayout: (e: { nativeEvent: { layout: { y: number } } }) => {
      at[k] = e.nativeEvent.layout.y;
    },
  });
  const openCard = () =>
    router.push({ pathname: '/[system]/more/reward-card', params: { system: ctx.system } });
  const go = (item: SetupItem) => {
    if (item.goes === 'card') return openCard();
    scroll.current?.scrollTo({ y: Math.max(0, (at[item.goes] ?? 0) - spacing.md) });
  };
  const putAside = (item: SetupItem) => {
    try {
      dismissSetup(ctx, item.id);
    } catch (error) {
      showError(error);
      return;
    }
    haptic.tap();
    notifyDataChanged();
  };
  const showAll = () => {
    try {
      restoreSetup(ctx);
    } catch (error) {
      showError(error);
      return;
    }
    notifyDataChanged();
  };
  const [ranges, setRanges] = useState(rewards.ranges.map(editableDinars).join('، '));

  const save = () => {
    const spendPerPoint = parseThousandths(spend);
    const pointValue = parseThousandths(value);
    const minRedeem = int(min);
    const maxShare = int(share);
    const money = [minPurchase, maxOff, minRewardSale, vipSpend].map(parseThousandths);
    // Empty: not set (the cap) or any purchase (the minimum).
    const giftMoney = [giftMax, giftMin].map((t) => (t.trim() ? parseThousandths(t) : 0));
    const rangeList = ranges
      .split(/[,،\s]+/)
      .filter(Boolean)
      .map(parseThousandths);
    if (
      spendPerPoint === null ||
      pointValue === null ||
      money.some((m) => m === null) ||
      giftMoney.some((m) => m === null) ||
      rangeList.some((m) => m === null)
    ) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', 'اكتب المبالغ بالدينار.');
      return;
    }
    try {
      ctx.db.transaction(() => {
        setSaved(setLoyalty(ctx, { enabled, spendPerPoint, pointValue, minRedeem, maxShare }));
        setRewardsSaved(
          setRewards(ctx, {
            enabled: rewardOn,
            minPurchase: money[0]!,
            every: int(every),
            percent: int(percent),
            maxOff: money[1]!,
            minRewardSale: money[2]!,
            vipSpend: money[3]!,
            vipMonths: int(vipMonths),
            vipPointsTimes: int(vipTimes),
            ranges: rangeList as number[],
          }),
        );
        const saved = setContact(ctx, contact);
        setContactForm({
          whatsapp: saved.whatsapp ?? '',
          instagram: saved.instagram ?? '',
          facebook: saved.facebook ?? '',
          tiktok: saved.tiktok ?? '',
        });
        setBirthdaySaved(
          setBirthday(ctx, {
            enabled: giftOn,
            percent: int(giftPercent),
            maxOff: giftMoney[0]!,
            minSale: giftMoney[1]!,
          }),
        );
      });
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    notifyDataChanged();
    Alert.alert(
      'تم الحفظ',
      [
        enabled ? 'تعمل نقاط الولاء من الآن.' : 'نقاط الولاء متوقفة.',
        rewardOn && !rewards.enabled ? 'تبدأ مكافأة الزيارة بالعدّ من اليوم.' : null,
        giftOn && !birthday.enabled ? 'يعمل خصم عيد الميلاد من اليوم.' : null,
      ]
        .filter(Boolean)
        .join('\n'),
    );
    return true;
  };

  const example = parseThousandths(spend);
  const worth = parseThousandths(value);
  return (
    <>
      <Stack.Title>الولاء والمكافآت</Stack.Title>
      <KeyboardAwareScrollView
        ref={scroll}
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
        <SetupCard
          items={setup.items}
          onGo={go}
          onDismiss={putAside}
          onRestore={dismissedSetup(ctx).length ? showAll : undefined}
        />
        <Button
          title="بطاقة المكافآت للزبائن"
          icon="rectangle.portrait.on.rectangle.portrait"
          variant="secondary"
          fullWidth
          onPress={openCard}
          testID="loyalty-card"
        />
        <Text
          variant="subhead"
          tone="secondary"
          style={{ paddingHorizontal: spacing.xs }}
          {...mark('points')}>
          نقاط الولاء
        </Text>
        <Card>
          <FilterChip
            label={enabled ? '✓ نقاط الولاء تعمل' : 'نقاط الولاء متوقفة: اضغط للتشغيل'}
            selected={enabled}
            onPress={() => setEnabled((e) => !e)}
            testID="loyalty-enabled"
          />
          <Text variant="caption" tone="secondary">
            يكسب الزبون المسجل نقاطاً على ما يدفعه، ويدفع بها جزءاً من بيعة نقدية أو ببطاقة لاحقاً.
            في البيع الآجل تُكتسب النقاط عند سداد الدين، والمرتجع يسترجع حصته منها.
          </Text>
        </Card>
        <Card>
          <NumberField
            label="نقطة واحدة لكل"
            value={spend}
            onChangeText={setSpend}
            suffix="د.ل"
            testID="loyalty-spend"
          />
          <NumberField
            label="قيمة النقطة الواحدة"
            value={value}
            onChangeText={setValue}
            suffix="د.ل"
            testID="loyalty-value"
          />
          {example && worth ? (
            <Text variant="caption" tone="secondary">
              {`مثال: بيعة 1000 د.ل تكسب ${Math.floor(1_000_000 / example)} نقطة، قيمتها ${formatLyd(Math.floor(1_000_000 / example) * worth)}.`}
            </Text>
          ) : null}
          <NumberField
            label="أقل عدد نقاط للاستخدام"
            value={min}
            onChangeText={setMin}
            suffix="نقطة"
            kind="integer"
            testID="loyalty-min"
          />
          <NumberField
            label="أكبر نسبة من البيعة تُدفع بالنقاط"
            value={share}
            onChangeText={setShare}
            suffix="%"
            kind="integer"
            testID="loyalty-share"
          />
        </Card>
        <Text
          variant="subhead"
          tone="secondary"
          style={{ paddingHorizontal: spacing.xs }}
          {...mark('rewards')}>
          مكافأة الزيارة
        </Text>
        <Card>
          <FilterChip
            label={rewardOn ? '✓ مكافأة الزيارة تعمل' : 'مكافأة الزيارة متوقفة: اضغط للتشغيل'}
            selected={rewardOn}
            onPress={() => setRewardOn((e) => !e)}
            testID="rewards-enabled"
          />
          <Text variant="caption" tone="secondary">
            {`بعد عدد من المشتريات يحصل الزبون على خصم في الشراء التالي. مشتريات اليوم الواحد تُجمع شراءً واحداً، والمكافأة التي لم تُستخدم تنتظر ولا تنتهي. ${
              rewards.enabled && rewards.startedAt
                ? `تُحسب المشتريات من ${rewards.startedAt.slice(0, 10)}.`
                : 'يبدأ العدّ من يوم التشغيل.'
            }`}
          </Text>
          <NumberField
            label="يُحسب الشراء من"
            value={minPurchase}
            onChangeText={setMinPurchase}
            suffix="د.ل"
            testID="rewards-min-purchase"
          />
          <NumberField
            label="عدد المشتريات قبل المكافأة"
            value={every}
            onChangeText={setEvery}
            kind="integer"
            testID="rewards-every"
          />
          <NumberField
            label="نسبة المكافأة"
            value={percent}
            onChangeText={setPercent}
            suffix="%"
            kind="integer"
            testID="rewards-percent"
          />
          <NumberField
            label="أكبر مبلغ للمكافأة"
            value={maxOff}
            onChangeText={setMaxOff}
            suffix="د.ل"
            testID="rewards-max-off"
          />
          <NumberField
            label="أقل مبلغ لبيعة المكافأة"
            value={minRewardSale}
            onChangeText={setMinRewardSale}
            suffix="د.ل"
            testID="rewards-min-sale"
          />
        </Card>
        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          VIP
        </Text>
        <Card>
          <NumberField
            label="VIP لمن اشترى بأكثر من"
            value={vipSpend}
            onChangeText={setVipSpend}
            suffix="د.ل"
            testID="rewards-vip-spend"
          />
          <NumberField
            label="خلال آخر (عدد الأشهر)"
            value={vipMonths}
            onChangeText={setVipMonths}
            kind="integer"
            testID="rewards-vip-months"
          />
          <NumberField
            label="نقاط VIP مضاعفة ×"
            value={vipTimes}
            onChangeText={setVipTimes}
            kind="integer"
            testID="rewards-vip-times"
          />
          <Text variant="caption" tone="secondary">
            يمكنك أيضاً جعل زبون VIP دائماً أو ليس VIP من صفحته.
          </Text>
        </Card>
        <Text
          variant="subhead"
          tone="secondary"
          style={{ paddingHorizontal: spacing.xs }}
          {...mark('birthday')}>
          خصم عيد الميلاد
        </Text>
        <Card>
          <FilterChip
            label={giftOn ? '✓ خصم عيد الميلاد يعمل' : 'خصم عيد الميلاد متوقف: اضغط للتشغيل'}
            selected={giftOn}
            onPress={() => setGiftOn((e) => !e)}
            testID="birthday-enabled"
          />
          <Text variant="caption" tone="secondary">
            خصم على شراء الزبون من 3 أيام قبل عيد ميلاده إلى 3 أيام بعده، مرة واحدة في السنة، لزبون
            مسجل برقم هاتف. لا يُجمع مع مكافأة الزيارة أو أي خصم آخر. تاريخ ميلاد سُجّل قبل أقل من
            30 يوماً من عيد الميلاد يحتاج موافقتك.
          </Text>
          <NumberField
            label="نسبة الخصم"
            value={giftPercent}
            onChangeText={setGiftPercent}
            suffix="%"
            kind="integer"
            testID="birthday-percent"
          />
          <NumberField
            label="أكبر مبلغ للخصم"
            value={giftMax}
            onChangeText={setGiftMax}
            suffix="د.ل"
            placeholder="مطلوب قبل التشغيل"
            testID="birthday-max-off"
          />
          <NumberField
            label="أقل مبلغ للشراء (اختياري)"
            value={giftMin}
            onChangeText={setGiftMin}
            suffix="د.ل"
            testID="birthday-min-sale"
          />
        </Card>
        <View {...mark('contact')}>
          <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
            بيانات التواصل على البطاقة
          </Text>
        </View>
        <Card>
          <NumberField
            label="رقم واتساب المحل"
            value={contact.whatsapp}
            onChangeText={(t) => setContactForm((c) => ({ ...c, whatsapp: t }))}
            kind="phone"
            placeholder="0912345678"
            testID="contact-whatsapp"
          />
          {SOCIALS.map((k: Social) => (
            <TextField
              key={k}
              label={`${SOCIAL_LABELS[k]} (اختياري)`}
              value={contact[k]}
              onChangeText={(t) => setContactForm((c) => ({ ...c, [k]: t }))}
              placeholder="اسم الحساب أو الرابط"
              autoCapitalize="none"
              testID={`contact-${k}`}
            />
          ))}
          <Text variant="caption" tone="secondary">
            تُطبع على بطاقة المكافآت، مع رمز QR يفتح محادثة واتساب. لكل محل بياناته.
          </Text>
        </Card>
        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          ما يراه الموظف
        </Text>
        <Card>
          <TextField
            label="حدود المشتريات (بالدينار، مفصولة بفاصلة)"
            value={ranges}
            onChangeText={setRanges}
            testID="rewards-ranges"
          />
          <Text variant="caption" tone="secondary">
            لا يرى الموظف مجموع مشتريات الزبون، بل «أكثر من 2,000 د.ل» مثلاً، إلا إن سمحت له بذلك من
            صفحة الموظفين.
          </Text>
        </Card>
        <Button
          title="حفظ"
          icon="checkmark.circle.fill"
          size="lg"
          fullWidth
          onPress={() => once(save)}
          testID="loyalty-save"
        />
      </KeyboardAwareScrollView>
    </>
  );
}

/** The owner only (`settings.edit`). */
export default function LoyaltyRoute() {
  return (
    <Allowed permission="settings.edit" title="الولاء والمكافآت">
      <LoyaltyScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/loyalty');
