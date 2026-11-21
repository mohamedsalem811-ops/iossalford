import { Image } from 'expo-image';
import { useState } from 'react';
import { ActionSheetIOS, Alert, ScrollView, useWindowDimensions, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Button, Card, EmptyState, ListGroup, ListRow, Text } from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import {
  invoicesOf,
  listOriginalInvoices,
  setInvoiceProducts,
  type InvoiceListing,
} from '@/domain/original-invoices';
import { getProduct } from '@/domain/products';
import { haptic } from '@/lib/haptics';
import { useCan } from '@/staff/use-can';
import { notifyDataChanged } from '@/state/data-events';
import { radius, spacing, useTheme } from '@/theme';

import {
  addInvoiceFlow,
  openInvoiceFlow,
  printInvoice,
  removeInvoiceFlow,
  type OpenedInvoice,
} from './actions';

const label = (i: Pick<InvoiceListing, 'id' | 'title' | 'kind'>) =>
  i.title ?? `فاتورة رقم ${i.id}${i.kind === 'pdf' ? ' (PDF)' : ''}`;

/**
 * A piece's original invoices (jewelry): open one to show or print it (an employee types the
 * owner's invoice code; every opening is logged and alerts the owner). The owner adds one, links
 * an invoice already added to this piece too, unlinks or removes it. Nothing here shares or saves
 * the file.
 */
export function PieceInvoices({ ctx, productId }: { ctx: Ctx; productId: number }) {
  const { colors } = useTheme();
  const { width, height } = useWindowDimensions();
  const manage = useCan('invoices.manage');
  const [product] = useState(() => getProduct(ctx, productId));
  const [list, setList] = useState(() => invoicesOf(ctx, productId));
  const [opened, setOpened] = useState<OpenedInvoice | null>(null);
  const refresh = () => setList(invoicesOf(ctx, productId));
  if (!product || ctx.system !== 'jewelry')
    return <EmptyState icon="doc.text" title="القطعة غير موجودة" />;

  if (opened) {
    const w = Math.min(width - spacing.md * 2, 800);
    const h = Math.max(320, Math.min(height * 0.7, w * 1.414));
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.background,
          padding: spacing.md,
          gap: spacing.md,
        }}>
        {opened.kind === 'pdf' ? (
          <WebView
            source={{ uri: opened.uri }}
            originWhitelist={['file://*']}
            allowingReadAccessToURL={opened.uri}
            style={{ width: w, height: h, alignSelf: 'center', borderRadius: radius.md }}
            testID="invoice-pdf"
          />
        ) : (
          <ScrollView
            maximumZoomScale={4}
            minimumZoomScale={1}
            centerContent
            style={{
              width: w,
              height: h,
              alignSelf: 'center',
              backgroundColor: colors.surface,
              borderRadius: radius.md,
            }}>
            <Image
              source={{ uri: opened.uri }}
              style={{ width: w, height: h }}
              contentFit="contain"
              accessibilityLabel="الفاتورة الأصلية"
              testID="invoice-image"
            />
          </ScrollView>
        )}
        <Button
          title="طباعة"
          icon="printer"
          size="lg"
          fullWidth
          onPress={() => void printInvoice(opened)}
          testID="invoice-print"
        />
        <Button
          title="إغلاق الفاتورة"
          variant="secondary"
          fullWidth
          onPress={() => setOpened(null)}
          testID="invoice-close"
        />
      </View>
    );
  }

  const open = async (i: InvoiceListing) => {
    haptic.medium();
    const r = await openInvoiceFlow(ctx, i.id, productId, product.name);
    if (r) setOpened(r);
  };

  const link = () => {
    const others = listOriginalInvoices(ctx)
      .filter((i) => !i.productIds.includes(productId))
      .slice(0, 12);
    if (!others.length) return Alert.alert('لا توجد فواتير أخرى', 'أضف فاتورة جديدة لهذه القطعة.');
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'ربط فاتورة موجودة بهذه القطعة',
        options: [...others.map((i) => `${label(i)} • ${i.productIds.length} قطعة`), 'إلغاء'],
        cancelButtonIndex: others.length,
      },
      (n) => {
        const inv = others[n];
        if (!inv) return;
        change(() => setInvoiceProducts(ctx, inv.id, [...inv.productIds, productId]));
      },
    );
  };

  const change = (run: () => void) => {
    try {
      run();
    } catch (error) {
      haptic.error();
      Alert.alert('لم يُحفظ', error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع.');
      return;
    }
    haptic.success();
    notifyDataChanged();
    refresh();
  };

  const more = (i: InvoiceListing) => {
    const full = listOriginalInvoices(ctx).find((x) => x.id === i.id);
    if (!full) return;
    const shared = full.productIds.length > 1;
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: label(i),
        message: shared ? `مرتبطة بـ ${full.productIds.length} قطعة` : undefined,
        options: ['فتح', ...(shared ? ['إزالتها من هذه القطعة فقط'] : []), 'حذف الفاتورة', 'إلغاء'],
        destructiveButtonIndex: shared ? 2 : 1,
        cancelButtonIndex: shared ? 3 : 2,
      },
      (n) => {
        if (n === 0) void open(i);
        else if (shared && n === 1)
          change(() =>
            setInvoiceProducts(
              ctx,
              i.id,
              full.productIds.filter((p) => p !== productId),
            ),
          );
        else if (n === (shared ? 2 : 1)) removeInvoiceFlow(ctx, i.id, refresh);
      },
    );
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}
      contentInsetAdjustmentBehavior="automatic">
      <Text variant="title">{product.name}</Text>
      {list.length ? (
        <ListGroup
          header="الفواتير الأصلية"
          footer={
            manage
              ? 'تفتحها الموظفة برمز الفواتير الذي تعطيها إياه، وكل فتح يصلك تنبيهاً.'
              : 'تحتاج رمز الفواتير من المالك. كل فتح يُسجَّل ويصل المالك.'
          }>
          {list.map((i) => (
            <ListRow
              key={i.id}
              icon={i.kind === 'pdf' ? 'doc.richtext' : 'doc.text.image'}
              title={label(i)}
              value="عرض وطباعة"
              onPress={() => (manage ? more(i) : void open(i))}
              testID={`invoice-${i.id}`}
            />
          ))}
        </ListGroup>
      ) : (
        <Card>
          <Text variant="body" tone="secondary">
            لا توجد فاتورة أصلية لهذه القطعة.
          </Text>
        </Card>
      )}
      {manage ? (
        <View style={{ gap: spacing.sm }}>
          <Button
            title="إضافة فاتورة أصلية"
            icon="plus"
            fullWidth
            onPress={() => void addInvoiceFlow(ctx, productId).then((ok) => ok && refresh())}
            testID="invoice-add"
          />
          <Button
            title="ربط فاتورة موجودة"
            icon="link"
            variant="secondary"
            fullWidth
            onPress={link}
            testID="invoice-link"
          />
        </View>
      ) : null}
    </ScrollView>
  );
}
