import * as Haptics from 'expo-haptics';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  EmptyState,
  FilterChip,
  NumberField,
  Segmented,
  Text,
  TextField,
  KEYBOARD_GAP,
  useSheetBottomSpace,
} from '@/components';
import { RuleError, type Ctx } from '@/domain/context';
import { adjustStock, displayName, getProduct, stockHistory } from '@/domain/products';
import { formatDate, formatTime } from '@/lib/dates';
import { notifyDataChanged } from '@/state/data-events';
import { spacing, useTheme } from '@/theme';

import { checkAdjustment, moveLabel, REASONS, signed, type Direction } from './model';

/**
 * Adds or removes stock with a reason (a delivery, breakage, a count), and shows the piece's
 * stock history. Stock never goes below zero.
 */
export function StockSheet({
  ctx,
  productId,
  onDone,
}: {
  ctx: Ctx;
  productId: number;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const bottomSpace = useSheetBottomSpace();
  const [product] = useState(() => getProduct(ctx, productId));
  const [history] = useState(() => stockHistory(ctx, productId).slice(0, 30));
  const [direction, setDirection] = useState<Direction>('add');
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('');

  if (!product) {
    return <EmptyState icon="shippingbox" title="القطعة غير موجودة في المخزون" />;
  }
  const check = checkAdjustment(product.stock, direction, quantity, reason);

  const save = () => {
    if (!check.ok) {
      Alert.alert('لم يتم الحفظ', check.message);
      return;
    }
    try {
      adjustStock(ctx, product.id, check.delta, reason);
    } catch (error) {
      Alert.alert(
        'لم يتم الحفظ',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ أي تغيير.',
      );
      return;
    }
    notifyDataChanged();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onDone();
  };

  return (
    <>
      <Stack.Title>تعديل المخزون</Stack.Title>
      <Stack.Toolbar placement="left">
        <Stack.Toolbar.Button onPress={onDone}>إلغاء</Stack.Toolbar.Button>
      </Stack.Toolbar>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Button variant="done" onPress={save}>
          حفظ
        </Stack.Toolbar.Button>
      </Stack.Toolbar>
      <KeyboardAwareScrollView
        bottomOffset={KEYBOARD_GAP}
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ padding: spacing.md, paddingBottom: bottomSpace, gap: spacing.md }}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <Card>
          <Text variant="headline">{displayName(ctx, product)}</Text>
          <Text variant="subhead" tone="secondary">
            {`${product.sku} • المتوفر الآن: ${product.stock} قطعة`}
          </Text>
          <Segmented
            options={[
              { value: 'add', label: 'إضافة للمخزون' },
              { value: 'remove', label: 'إنقاص من المخزون' },
            ]}
            value={direction}
            onChange={(d) => {
              setDirection(d);
              setReason('');
            }}
          />
          <NumberField
            label="الكمية"
            kind="integer"
            value={quantity}
            onChangeText={setQuantity}
            suffix="قطع"
            testID="stock-quantity"
          />
          <View style={{ gap: spacing.xs }}>
            <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
              السبب
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {REASONS[direction].map((r) => (
                <FilterChip
                  key={r}
                  label={r}
                  selected={reason === r}
                  onPress={() => setReason(r)}
                />
              ))}
            </View>
            <TextField
              value={reason}
              onChangeText={setReason}
              placeholder="أو اكتب السبب"
              testID="stock-reason"
            />
          </View>
          {check.ok ? (
            <Text variant="bodyStrong" tone="accent" testID="stock-after">
              {`سيصبح المخزون: ${check.after} قطعة`}
            </Text>
          ) : null}
          <Button
            title="حفظ التعديل"
            icon="checkmark.circle.fill"
            fullWidth
            onPress={save}
            testID="stock-save"
          />
        </Card>

        <Text variant="subhead" tone="secondary" style={{ paddingHorizontal: spacing.xs }}>
          سجل المخزون
        </Text>
        <Card padded={false} style={{ gap: 0, paddingHorizontal: spacing.md }}>
          {history.length === 0 ? (
            <Text variant="subhead" tone="secondary" style={{ paddingVertical: spacing.md }}>
              لا توجد حركات بعد
            </Text>
          ) : (
            history.map((m, i) => {
              const date = new Date(m.createdAt);
              return (
                <View
                  key={m.id}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: spacing.ms,
                    paddingVertical: spacing.sm,
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: colors.separator,
                  }}>
                  <View style={{ flex: 1 }}>
                    <Text variant="body">{moveLabel(m.kind)}</Text>
                    <Text variant="caption" tone="secondary">
                      {[m.reason, `${formatDate(date)} ${formatTime(date)}`]
                        .filter(Boolean)
                        .join(' • ')}
                    </Text>
                  </View>
                  <Text variant="headline" tone={m.delta > 0 ? 'accent' : 'warning'}>
                    {signed(m.delta)}
                  </Text>
                </View>
              );
            })
          )}
        </Card>
      </KeyboardAwareScrollView>
    </>
  );
}
