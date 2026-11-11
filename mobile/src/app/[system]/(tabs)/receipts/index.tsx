import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import {
  countReceipts,
  deleteReceipt,
  listReceipts,
  receiptMonths,
  templatesFor,
  type ReceiptQuery,
  type TemplateId,
} from '@/domain/receipts';
import { receiptDoc, templateName } from '@/features/receipts/model';
import { usePaged } from '@/hooks/use-paged';
import { ReceiptsList } from '@/features/receipts/receipts-list';
import { monthTitle } from '@/lib/dates';
import { printReceipt, shareReceipt } from '@/receipts/output';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';

/**
 * The receipts tab: every receipt, newest first. Search by number, customer or piece; filter by
 * month or design; open to edit or reprint; a new receipt made by hand.
 */
export default function ReceiptsRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const [query, setQuery] = useState<ReceiptQuery>({});
  const shown = usePaged(
    useCallback(
      (limit: number, offset: number) => listReceipts(ctx, query, { limit, offset }),
      [ctx, query],
    ),
  );
  const readFacts = useCallback(
    () => ({ months: receiptMonths(ctx), count: countReceipts(ctx, query) }),
    [ctx, query],
  );
  const [facts, setFacts] = useState(readFacts);
  const refreshFacts = useCallback(() => setFacts(readFacts()), [readFacts]);
  useFocusEffect(refreshFacts);
  useOnDataChanged(refreshFacts);
  const data = { shown: shown.items };

  const open = (id: number | 'new') =>
    router.push({ pathname: '/[system]/receipt/[id]', params: { system, id: String(id) } });
  const fail = () => Alert.alert('تعذّر إنشاء ملف الإيصال', 'حاول مرة أخرى.');
  const months = facts.months;
  const filtered = !!(query.search || query.month || query.template);

  return (
    <>
      <Stack.Title>الإيصالات</Stack.Title>
      <Stack.SearchBar
        placeholder="رقم الإيصال أو الزبون أو القطعة"
        cancelButtonText="إلغاء"
        hideWhenScrolling={false}
        onChangeText={(e) => setQuery((q) => ({ ...q, search: e.nativeEvent.text }))}
        onCancelButtonPress={() => setQuery((q) => ({ ...q, search: '' }))}
      />
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={
            query.month || query.template
              ? 'line.3.horizontal.decrease.circle.fill'
              : 'line.3.horizontal.decrease.circle'
          }
          title="فلترة"
          accessibilityLabel="فلترة الإيصالات">
          <Stack.Toolbar.Menu inline title="الشهر">
            <Stack.Toolbar.MenuAction
              isOn={!query.month}
              onPress={() => setQuery((q) => ({ ...q, month: undefined }))}>
              كل الأشهر
            </Stack.Toolbar.MenuAction>
            {months.map((m) => (
              <Stack.Toolbar.MenuAction
                key={m}
                isOn={query.month === m}
                onPress={() => setQuery((q) => ({ ...q, month: m }))}>
                {monthTitle(m)}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
          <Stack.Toolbar.Menu inline title="التصميم">
            <Stack.Toolbar.MenuAction
              isOn={!query.template}
              onPress={() => setQuery((q) => ({ ...q, template: undefined }))}>
              كل التصاميم
            </Stack.Toolbar.MenuAction>
            {templatesFor(system).map((t: TemplateId) => (
              <Stack.Toolbar.MenuAction
                key={t}
                isOn={query.template === t}
                onPress={() => setQuery((q) => ({ ...q, template: t }))}>
                {templateName(t)}
              </Stack.Toolbar.MenuAction>
            ))}
          </Stack.Toolbar.Menu>
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Button
          icon="plus"
          accessibilityLabel="إيصال جديد"
          onPress={() => open('new')}
        />
      </Stack.Toolbar>
      <ReceiptsList
        receipts={data.shown}
        total={facts.count}
        onEndReached={shown.loadMore}
        filtered={filtered}
        onNew={() => open('new')}
        actions={{
          onOpen: (r) => open(r.id),
          onPrint: (r) => printReceipt(receiptDoc(r)).catch(fail),
          onShare: (r) => shareReceipt(receiptDoc(r)).catch(fail),
          onDelete: (r) =>
            Alert.alert(
              `حذف الإيصال ${r.receiptNo}؟`,
              'لا يتأثر البيع ولا المخزون، ولا يُعطى رقمه لإيصال آخر.',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'حذف',
                  style: 'destructive',
                  onPress: () => {
                    deleteReceipt(ctx, r.id);
                    notifyDataChanged();
                  },
                },
              ],
            ),
        }}
      />
    </>
  );
}
