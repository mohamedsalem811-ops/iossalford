import { isRunningInExpoGo } from 'expo';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button, Card, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { getBirthday } from '@/domain/birthday';
import { getContact } from '@/domain/contact';
import { getLoyalty } from '@/domain/loyalty';
import { getRewards } from '@/domain/rewards';
import { dismissedSetup, dismissSetup } from '@/domain/setup';
import { useReadable } from '@/hooks/use-readable';
import { haptic } from '@/lib/haptics';
import { logError } from '@/lib/error-log';
import { printCard, saveCardToFiles, shareCard } from '@/receipts/card-output';
import { cardFontCss } from '@/receipts/fonts';
import { cardSections, rewardCardHtml, type CardInput } from '@/receipts/reward-card';
import { Allowed } from '@/staff/allowed';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { radius, spacing, useTheme } from '@/theme';

/**
 * Settings → الولاء والمكافآت → بطاقة المكافآت (H3, the owner): the card for customers as it is
 * now, from the rules that are on; the print shop's PDF (3 mm bleed and crop marks), a test print
 * on A6, share and save to Files. Printing, saving or sending it marks "راجع البطاقة" as done.
 */
function RewardCardScreen() {
  const ctx = useCtx();
  const { colors } = useTheme();
  const readable = useReadable();
  const read = useCallback(
    (): CardInput => ({
      system: ctx.system,
      loyalty: getLoyalty(ctx),
      rewards: getRewards(ctx),
      birthday: getBirthday(ctx),
      contact: getContact(ctx),
    }),
    [ctx],
  );
  const [input, setInput] = useState(read);
  const refresh = useCallback(() => setInput(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const [fontCss, setFontCss] = useState('');
  useFocusEffect(
    useCallback(() => {
      let live = true;
      cardFontCss(ctx.system).then((css) => live && setFontCss(css));
      return () => {
        live = false;
      };
    }, [ctx.system]),
  );
  const [width, setWidth] = useState(0);
  const [busy, setBusy] = useState(false);
  const parts = cardSections(input);

  /** "راجع البطاقة" is done once the card was printed, saved or sent. */
  const reviewed = () => {
    dismissSetup(ctx, 'card-review');
    notifyDataChanged();
  };
  const run = async (kind: 'share' | 'save' | 'print') => {
    if (busy) return;
    setBusy(true);
    try {
      if (kind === 'print') {
        if (!(await printCard(input))) return; // closed without printing
        reviewed();
      } else if (kind === 'share') {
        await shareCard(input);
        // iOS can't tell a sent file from a closed share sheet: ask, only while it's still to do.
        if (!dismissedSetup(ctx).includes('card-review'))
          Alert.alert(
            'هل أرسلت ملف البطاقة؟',
            'إن أرسلته، تُزال «راجع بطاقة المكافآت» من «يحتاج إعداد».',
            [
              { text: 'ليس بعد', style: 'cancel' },
              { text: 'نعم، أرسلته', onPress: reviewed },
            ],
          );
      } else {
        const name = await saveCardToFiles(input);
        reviewed();
        Alert.alert(
          'حُفظ في الملفات',
          isRunningInExpoGo()
            ? `${name}\nفي Expo Go يُحفظ داخل Expo Go.`
            : `${name}\nتجده في تطبيق الملفات ← على الـ iPhone (أو الـ iPad) ← SALFORD POS ← Receipts.`,
        );
      }
      haptic.success();
    } catch (error) {
      logError('بطاقة المكافآت', error);
      Alert.alert('تعذّر إنشاء ملف البطاقة', 'حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };
  const openSettings = () => router.back();

  const cardHeight = width ? (width * 148) / 105 : 0;
  return (
    <>
      <Stack.Title>بطاقة المكافآت</Stack.Title>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        onLayout={readable.onLayout}
        contentContainerStyle={{
          ...readable.padding,
          paddingVertical: spacing.md,
          gap: spacing.md,
        }}
        contentInsetAdjustmentBehavior="automatic">
        {!parts.length ? (
          <Card testID="card-empty">
            <Text variant="bodyStrong" tone="warning">
              لا مكافآت مفعّلة بعد
            </Text>
            <Text variant="caption" tone="secondary">
              شغّل مكافأة الزيارة أو النقاط أو خصم عيد الميلاد أولاً، لتظهر على البطاقة.
            </Text>
            <Button
              title="الإعدادات"
              variant="secondary"
              onPress={openSettings}
              testID="card-empty-settings"
            />
          </Card>
        ) : null}
        {!input.contact.whatsapp ? (
          <Card testID="card-no-whatsapp">
            <Text variant="caption" tone="warning">
              لم يُكتب رقم واتساب المحل: لن يظهر رمز QR ولا الرقم على البطاقة.
            </Text>
            <Button
              title="إضافة الرقم"
              variant="ghost"
              size="sm"
              onPress={openSettings}
              testID="card-add-whatsapp"
            />
          </Card>
        ) : null}
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityLabel="معاينة بطاقة المكافآت: الوجه الأمامي ثم الخلفي"
          style={{
            height: cardHeight ? cardHeight * 2 + 16 : 400,
            borderRadius: radius.md,
            overflow: 'hidden',
          }}>
          {width ? (
            <WebView
              testID="card-preview"
              originWhitelist={['*']}
              javaScriptEnabled={false}
              onShouldStartLoadWithRequest={(r) =>
                r.url === 'about:blank' || r.url.startsWith('data:')
              }
              source={{ html: rewardCardHtml(input, { previewWidth: width, fontCss }) }}
              style={{ backgroundColor: 'transparent' }}
              scrollEnabled={false}
              automaticallyAdjustContentInsets={false}
              contentInsetAdjustmentBehavior="never"
            />
          ) : null}
        </View>
        <Button
          title="ملف المطبعة (PDF)"
          icon="square.and.arrow.up"
          size="lg"
          fullWidth
          loading={busy}
          disabled={!parts.length}
          onPress={() => void run('share')}
          testID="card-share"
        />
        <Button
          title="حفظ في الملفات"
          icon="folder"
          variant="secondary"
          fullWidth
          disabled={busy || !parts.length}
          onPress={() => void run('save')}
          testID="card-save"
        />
        <Button
          title="طباعة تجريبية على A6"
          icon="printer"
          variant="secondary"
          fullWidth
          disabled={busy || !parts.length}
          onPress={() => void run('print')}
          testID="card-print"
        />
        <Text variant="caption" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          ملف المطبعة بحجم A6 (105 × 148 مم) مع 3 مم زيادة حول البطاقة وعلامات القص، والنصوص داخل
          البطاقة بـ 5 مم على الأقل. الصفحة الأولى هي الوجه الأمامي والثانية الخلفي. اطلب نسخة
          تجريبية واحدة قبل الطباعة الكاملة. البطاقة تُكتب من إعداداتك الحالية: إن غيّرتها، أرسل
          ملفاً جديداً.
        </Text>
      </ScrollView>
    </>
  );
}

/** The owner only (`settings.edit`). */
export default function RewardCardRoute() {
  return (
    <Allowed permission="settings.edit" title="بطاقة المكافآت">
      <RewardCardScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/reward-card');
