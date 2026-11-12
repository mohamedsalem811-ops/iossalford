import { ScrollView, View } from 'react-native';

import { Button, Text } from '@/components';
import { TAB_BAR_CLEARANCE } from '@/components/screen';
import type { Receipt } from '@/domain/receipts';
import { formatLyd } from '@/lib/money';
import { spacing } from '@/theme';

import { receiptDoc, templateName } from './model';
import { ReceiptPreview } from './receipt-preview';

/**
 * iPad: the receipt chosen in the list, beside it: its number, customer and total, the actions,
 * and the receipt as it prints.
 */
export function ReceiptPane({
  receipt,
  onEdit,
  onPrint,
  onShare,
}: {
  receipt: Receipt;
  onEdit: () => void;
  onPrint: () => void;
  onShare: () => void;
}) {
  return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{
        padding: spacing.lg,
        paddingBottom: TAB_BAR_CLEARANCE + spacing.lg,
        gap: spacing.md,
      }}
      testID="receipt-pane">
      <View style={{ gap: spacing.xs }}>
        <Text variant="title">{receipt.receiptNo}</Text>
        <Text variant="caption" tone="secondary">
          {`${receipt.customer || 'بدون اسم'} • ${receipt.date} ${receipt.time} • ${templateName(receipt.template)}${receipt.showPrices ? ` • ${formatLyd(receipt.total)}` : ''}`}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        <Button title="تعديل" icon="pencil" onPress={onEdit} testID="receipt-pane-edit" />
        <Button title="طباعة" icon="printer" variant="secondary" onPress={onPrint} />
        <Button
          title="مشاركة PDF"
          icon="square.and.arrow.up"
          variant="secondary"
          onPress={onShare}
        />
      </View>
      <ReceiptPreview doc={receiptDoc(receipt)} />
    </ScrollView>
  );
}
