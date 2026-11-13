import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  EmptyState,
  KEYBOARD_GAP,
  ListGroup,
  ListRow,
  Text,
  TextField,
} from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { getPolicies } from '@/domain/policies';
import { findSaleForReturn, hoursSince, type ReturnableSale } from '@/domain/sales';
import { useReadable } from '@/hooks/use-readable';
import { formatDate, formatTime } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { spacing, useTheme } from '@/theme';

/**
 * Management → Return or exchange (phase S4): the sale is found by its number or its receipt
 * number (whoever sold it), then a piece of it is chosen. Only pieces sold in it can come back.
 */
function ReturnFindScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const [text, setText] = useState('');
  const [found, setFound] = useState<ReturnableSale | null | undefined>();
  const hours = getPolicies(ctx).returnHours;

  const find = () => setFound(text.trim() ? (findSaleForReturn(ctx, text) ?? null) : undefined);
  const age = found ? hoursSince(found.createdAt, ctx.now()) : 0;

  return (
    <>
      <Stack.Title>مرتجع أو استبدال</Stack.Title>
      <KeyboardAwareScrollView
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
        <Card>
          <TextField
            label="رقم البيعة أو رقم الإيصال"
            value={text}
            onChangeText={setText}
            placeholder="12 أو JW-2026-0012"
            autoCapitalize="characters"
            returnKeyType="search"
            onSubmitEditing={find}
            testID="return-find-text"
          />
          <Button
            title="بحث"
            icon="magnifyingglass"
            fullWidth
            onPress={find}
            testID="return-find"
          />
          <Text variant="caption" tone="secondary">
            {`يُقبل المرتجع خلال ${hours} ساعة من البيع، مع صورة القطعة وتحقق الشروط. لإضافة قطعة بدلاً منها، ضعها في السلة أولاً.`}
          </Text>
        </Card>
        {found === null ? (
          <EmptyState icon="magnifyingglass" title="لا توجد بيعة بهذا الرقم" />
        ) : found ? (
          <ListGroup
            header={`بيعة رقم ${found.saleId}${found.receiptNo ? ` • ${found.receiptNo}` : ''}`}
            footer={`${formatDate(new Date(found.createdAt))} ${formatTime(new Date(found.createdAt))} • البائع: ${found.sellerName}${
              age > hours ? ` • مرّت أكثر من ${hours} ساعة: يحتاج موافقة المالك` : ''
            }`}>
            {found.lines.map((l) => {
              const left = l.quantity - l.returned;
              return (
                <ListRow
                  key={l.id}
                  icon="arrow.uturn.backward"
                  title={l.name}
                  subtitle={`بيعت ${l.quantity} • أُرجع ${l.returned} • دفع ${formatLyd(l.lineTotal)}`}
                  onPress={
                    left > 0
                      ? () =>
                          router.push({
                            pathname: '/[system]/return/[id]',
                            params: { system: ctx.system, id: String(l.id) },
                          })
                      : undefined
                  }
                  chevron={left > 0}
                  testID={`return-line-${l.id}`}
                />
              );
            })}
          </ListGroup>
        ) : (
          <View />
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

/** Anyone who may take returns (employees too, within the rules). */
export default function ReturnFindRoute() {
  return (
    <Allowed permission="returns.create" title="مرتجع أو استبدال">
      <ReturnFindScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/return-find');
