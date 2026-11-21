import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button, EmptyState, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { getRepair, getRepairRules, repairLines } from '@/domain/repairs';
import { repairTicketData } from '@/features/repairs/model';
import { logError } from '@/lib/error-log';
import { cardFontCss } from '@/receipts/fonts';
import { printTicket, shareTicket, ticketPhoto } from '@/receipts/repair-ticket-output';
import { PAGE } from '@/receipts/templates/html';
import { repairTicketHtml } from '@/receipts/templates/repair-ticket';
import { useCtx } from '@/state/system-db';
import { useCan } from '@/staff/use-can';
import { radius, spacing, useTheme } from '@/theme';

/** /jewelry/repair-ticket/3: the repair ticket she shows to collect her piece, to print or share. */
export default function RepairTicketRoute() {
  const ctx = useCtx();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const phones = useCan('customers.phones');
  const repair = getRepair(ctx, Number(id));
  const [busy, setBusy] = useState(false);
  const [width, setWidth] = useState(0);
  const [fontCss, setFontCss] = useState('');
  const [photo, setPhoto] = useState<string | null>(null);
  const firstPhoto = repair?.photos[0];
  useEffect(() => {
    let live = true;
    cardFontCss(ctx.system).then((css) => live && setFontCss(css));
    ticketPhoto(ctx.system, firstPhoto).then((p) => live && setPhoto(p));
    return () => {
      live = false;
    };
  }, [ctx.system, firstPhoto]);
  const ticket = useMemo(
    () =>
      repair
        ? {
            ...repairTicketData(
              repair,
              repairLines(ctx, repair.id),
              ctx.system,
              getRepairRules(ctx).note,
              phones,
            ),
            photo,
          }
        : null,
    [ctx, repair, phones, photo],
  );
  if (!repair || !ticket)
    return <EmptyState icon="wrench.and.screwdriver" title="الصيانة غير موجودة" />;
  const output = async (kind: 'print' | 'share') => {
    setBusy(true);
    try {
      if (kind === 'print') await printTicket(ticket);
      else await shareTicket(ticket);
    } catch (error) {
      logError('إيصال الصيانة', error);
      Alert.alert('لم يُطبع الإيصال', 'حدث خطأ أثناء تجهيز الملف. حاول مرة أخرى.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Stack.Title>{repair.ticketNo}</Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" onPress={() => router.back()}>
          تم
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
        <Text variant="caption" tone="secondary">
          تستلم الزبون قطعتها بهذا الإيصال.
        </Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            title="طباعة"
            icon="printer"
            disabled={busy}
            onPress={() => output('print')}
            testID="repair-ticket-print"
          />
          <Button
            title="مشاركة PDF"
            icon="square.and.arrow.up"
            variant="secondary"
            disabled={busy}
            onPress={() => output('share')}
            testID="repair-ticket-share"
          />
        </View>
        <View
          onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
          accessibilityLabel="معاينة الإيصال كما سيُطبع"
          style={{
            height: width ? (width * PAGE.height) / PAGE.width : 400,
            borderRadius: radius.md,
            borderCurve: 'continuous',
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.separator,
            backgroundColor: '#fff',
          }}>
          {width ? (
            <WebView
              testID="receipt-preview"
              originWhitelist={['*']}
              // Plain HTML: no scripts run, and it never opens anything else.
              javaScriptEnabled={false}
              onShouldStartLoadWithRequest={(r) =>
                r.url === 'about:blank' || r.url.startsWith('data:')
              }
              source={{ html: repairTicketHtml(ticket, { previewWidth: width, fontCss }) }}
              style={{ backgroundColor: '#fff' }}
              scrollEnabled
              bounces={false}
              automaticallyAdjustContentInsets={false}
              contentInsetAdjustmentBehavior="never"
            />
          ) : null}
        </View>
      </ScrollView>
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('repair-ticket/[id]');
