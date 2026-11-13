import { FlashList } from '@shopify/flash-list';
import { ActionSheetIOS, Pressable, View } from 'react-native';

import { Badge, EmptyState, TAB_BAR_CLEARANCE, Text } from '@/components';
import type { Receipt } from '@/domain/receipts';
import { formatLyd } from '@/lib/money';
import { useReadable } from '@/hooks/use-readable';
import { radius, spacing, useTheme } from '@/theme';

import { receiptSummary, templateName } from './model';
import { useCan } from '@/staff/use-can';

export type ReceiptActions = {
  onOpen: (r: Receipt) => void;
  onPrint: (r: Receipt) => void;
  onShare: (r: Receipt) => void;
  onDelete: (r: Receipt) => void;
};

/** The receipt history, newest first. Tap opens it; a long press prints, shares or deletes. */
export function ReceiptsList({
  receipts,
  total,
  onEndReached,
  filtered,
  actions,
  onNew,
}: {
  receipts: Receipt[];
  /** How many receipts match (the list itself is read a page at a time). */
  total?: number;
  /** Reads the next page when the end of the list comes into view. */
  onEndReached?: () => void;
  /** A search or filter is on (the empty state says so). */
  filtered: boolean;
  actions: ReceiptActions;
  onNew: () => void;
}) {
  const { colors } = useTheme();
  const readable = useReadable();
  const mayDelete = useCan('receipts.delete');
  const menu = (r: Receipt) => {
    const items = [
      { title: 'فتح وتعديل', run: () => actions.onOpen(r) },
      { title: 'طباعة', run: () => actions.onPrint(r) },
      { title: 'مشاركة PDF', run: () => actions.onShare(r) },
      ...(mayDelete ? [{ title: 'حذف الإيصال', run: () => actions.onDelete(r) }] : []),
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: r.receiptNo,
        options: [...items.map((i) => i.title), 'إلغاء'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: mayDelete ? items.length - 1 : undefined,
      },
      (i) => items[i]?.run(),
    );
  };

  return (
    <FlashList
      data={receipts}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.5}
      keyExtractor={(r) => String(r.id)}
      contentInsetAdjustmentBehavior="automatic"
      keyboardDismissMode="on-drag"
      onLayout={readable.onLayout}
      contentContainerStyle={{
        paddingHorizontal: readable.side,
        paddingTop: spacing.sm,
        paddingBottom: TAB_BAR_CLEARANCE + spacing.lg,
      }}
      ListHeaderComponent={
        receipts.length > 0 ? (
          <Text
            variant="caption"
            tone="secondary"
            style={{ paddingBottom: spacing.sm }}
            testID="receipts-summary">
            {`${total ?? receipts.length} إيصال`}
          </Text>
        ) : null
      }
      ListEmptyComponent={
        filtered ? (
          <EmptyState
            icon="magnifyingglass"
            title="لا توجد نتائج"
            message="غيّر البحث أو الفلتر."
          />
        ) : (
          <EmptyState
            icon="doc.text"
            title="لا توجد إيصالات بعد"
            message="يُصدر إيصال تلقائياً مع كل بيع، ويمكنك إنشاء إيصال يدوي."
            action="إيصال جديد"
            onAction={onNew}
          />
        )
      }
      renderItem={({ item: r }) => (
        <Pressable
          onPress={() => actions.onOpen(r)}
          onLongPress={() => menu(r)}
          accessibilityRole="button"
          accessibilityHint="اضغط للفتح، أو اضغط مطولاً للطباعة أو المشاركة أو الحذف"
          testID={`receipt-${r.receiptNo}`}
          style={({ pressed }) => ({
            marginBottom: spacing.sm,
            padding: spacing.md,
            gap: spacing.xxs,
            borderRadius: radius.lg,
            borderCurve: 'continuous',
            backgroundColor: pressed ? colors.accentSoft : colors.surface,
          })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Text variant="headline" style={{ flex: 1 }}>
              {r.receiptNo}
            </Text>
            <Text variant="headline" tone="accent">
              {r.showPrices ? formatLyd(r.total) : 'هدية'}
            </Text>
          </View>
          <Text variant="subhead" tone="secondary" numberOfLines={1}>
            {`${r.customer} • ${r.date} ${r.time} • ${r.items.length} سطر`}
          </Text>
          <Text variant="caption" tone="secondary" numberOfLines={2}>
            {receiptSummary(r)}
          </Text>
          <View style={{ flexDirection: 'row', gap: spacing.xs, paddingTop: spacing.xxs }}>
            <Badge label={r.saleId ? `بيعة رقم ${r.saleId}` : 'إيصال يدوي'} />
            <Badge label={templateName(r.template)} />
          </View>
        </Pressable>
      )}
    />
  );
}
