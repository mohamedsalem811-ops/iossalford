import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import {
  countReceipts,
  deleteReceipt,
  getReceipt,
  listReceipts,
  receiptMonths,
  templatesFor,
  type ReceiptQuery,
  type TemplateId,
} from '@/domain/receipts';
import { EmptyState, SplitView } from '@/components';
import { BelowHeader } from '@/components/below-header';
import { receiptDoc, templateName } from '@/features/receipts/model';
import { ReceiptPane } from '@/features/receipts/receipt-pane';
import { ReceiptsList } from '@/features/receipts/receipts-list';
import { useLayout } from '@/hooks/use-layout';
import { usePaged } from '@/hooks/use-paged';
import { monthTitle } from '@/lib/dates';
import { printReceipt, shareReceipt } from '@/receipts/output';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { useSearchShortcut, useShortcut } from '@/lib/key-commands';

/**
 * The receipts tab: every receipt, newest first. Search by number, customer or piece; filter by
 * month or design; open to edit or reprint; a new receipt made by hand. iPad: the chosen receipt
 * shows beside the list, as it prints, with its actions.
 */
export default function ReceiptsRoute() {
  const ctx = useCtx();
  const system = ctx.system;
  const searchRef = useSearchShortcut();
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
  useShortcut('new', () => open('new'));
  const fail = () => Alert.alert('تعذّر إنشاء ملف الإيصال', 'حاول مرة أخرى.');
  // iPad: the receipt shown beside the list (read again with the list, so edits show at once).
  const { split } = useLayout();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = selectedId === null ? undefined : getReceipt(ctx, selectedId);
  const months = facts.months;
  const filtered = !!(query.search || query.month || query.template);

  return (
    <>
      <Stack.Title>الإيصالات</Stack.Title>
      <Stack.SearchBar
        ref={searchRef}
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
          onPress={() => open('new')}>
          إيصال جديد
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      {split ? (
        <BelowHeader>
          <SplitView
            list={
              <ReceiptsList
                receipts={data.shown}
                total={facts.count}
                onEndReached={shown.loadMore}
                filtered={filtered}
                onNew={() => open('new')}
                actions={{
                  onOpen: (r) => (split ? setSelectedId(r.id) : open(r.id)),
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
            }
            detail={
              selected ? (
                <ReceiptPane
                  receipt={selected}
                  onEdit={() => open(selected.id)}
                  onPrint={() => printReceipt(receiptDoc(selected)).catch(fail)}
                  onShare={() => shareReceipt(receiptDoc(selected)).catch(fail)}
                />
              ) : (
                <EmptyState
                  icon="doc.text"
                  title="اختر إيصالاً من القائمة"
                  message="يظهر هنا كما سيُطبع، مع الطباعة والمشاركة والتعديل."
                />
              )
            }
          />
        </BelowHeader>
      ) : (
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
      )}
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('receipts');
