import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { Button, EmptyState, Text } from '@/components';
import { getRepair, getRepairRules } from '@/domain/repairs';
import { repairTicketDoc } from '@/features/repairs/model';
import { ReceiptPreview } from '@/features/receipts/receipt-preview';
import { logError } from '@/lib/error-log';
import { printReceipt, shareReceipt } from '@/receipts/output';
import { useCtx } from '@/state/system-db';
import { spacing, useTheme } from '@/theme';
import { errorBoundary } from '@/components/error-screen';

/** /jewelry/repair-ticket/3: the repair ticket she shows to collect her piece, to print or share. */
export default function RepairTicketRoute() {
  const ctx = useCtx();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const repair = getRepair(ctx, Number(id));
  const [busy, setBusy] = useState(false);
  if (!repair) return <EmptyState icon="wrench.and.screwdriver" title="الصيانة غير موجودة" />;
  const doc = repairTicketDoc(repair, ctx.system, getRepairRules(ctx).note);
  const output = async (kind: 'print' | 'share') => {
    setBusy(true);
    try {
      if (kind === 'print') await printReceipt(doc);
      else await shareReceipt(doc);
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
        <ReceiptPreview doc={doc} />
      </ScrollView>
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('repair-ticket/[id]');
