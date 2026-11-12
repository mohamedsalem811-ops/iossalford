import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  ChipRow,
  EmptyState,
  KEYBOARD_GAP,
  ListGroup,
  ListRow,
  NumberField,
  Text,
  TextField,
} from '@/components';
import {
  addExpense,
  deleteExpense,
  expensesByMonth,
  isMonthClosed,
  type Expense,
} from '@/domain/expenses';
import { showError } from '@/features/products/actions';
import { checkExpense } from '@/features/money/model';
import { formatDate, monthKey, monthTitle, recentMonths } from '@/lib/dates';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { useReadable } from '@/hooks/use-readable';
import { spacing, useTheme } from '@/theme';
import { errorBoundary } from '@/components/error-screen';
import { haptic } from '@/lib/haptics';
import { useSaveOnce } from '@/hooks/use-save-once';

/**
 * Management → Expenses: add an expense booked to a chosen month (a warning when that month's
 * quarter is already closed), and every expense grouped by month with its total.
 */
export default function ExpensesRoute() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const once = useSaveOnce(true);
  const saveOnce = () => once(save);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [month, setMonth] = useState(() => monthKey(ctx.now()));
  const read = useCallback(() => expensesByMonth(ctx), [ctx]);
  const [groups, setGroups] = useState(read);
  const refresh = useCallback(() => setGroups(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const closed = isMonthClosed(ctx, month);
  const months = recentMonths(12, ctx.now()).map((m) => ({ value: m, label: monthTitle(m) }));

  const save = () => {
    const check = checkExpense(description, amount);
    if (!check.ok) {
      haptic.error();
      Alert.alert('لم يتم الحفظ', check.message);
      return;
    }
    try {
      addExpense(ctx, { description, amount: check.amount, month });
    } catch (error) {
      showError(error);
      return;
    }
    haptic.success();
    setDescription('');
    setAmount('');
    notifyDataChanged();
    return true;
  };

  const remove = (e: Expense) =>
    Alert.alert(
      'حذف المصروف؟',
      `${e.description} • ${formatLyd(e.amount)} • ${monthTitle(e.month)}`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف',
          style: 'destructive',
          onPress: () => {
            deleteExpense(ctx, e.id);
            notifyDataChanged();
          },
        },
      ],
    );

  return (
    <>
      <Stack.Title>المصروفات</Stack.Title>
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
            label="الوصف"
            value={description}
            onChangeText={setDescription}
            placeholder="إيجار، كهرباء، أكياس…"
            testID="expense-description"
          />
          <NumberField
            label="المبلغ"
            value={amount}
            onChangeText={setAmount}
            suffix="د.ل"
            testID="expense-amount"
          />
          <Text variant="subhead" tone="secondary">
            يُحسب على شهر
          </Text>
          <ChipRow options={months} value={month} onChange={setMonth} />
          {closed ? (
            <Text variant="caption" tone="warning" testID="expense-closed">
              ربع هذا الشهر مُقفل: أعد إصدار إقفال الربع بعد الإضافة ليشملها.
            </Text>
          ) : null}
          <Button
            title="إضافة المصروف"
            icon="plus.circle.fill"
            fullWidth
            onPress={saveOnce}
            testID="expense-add"
          />
        </Card>

        {groups.length === 0 ? (
          <EmptyState icon="banknote" title="لا توجد مصروفات بعد" />
        ) : (
          groups.map((g) => (
            <ListGroup
              key={g.month}
              header={`${monthTitle(g.month)} • ${formatLyd(g.total)}`}
              footer={isMonthClosed(ctx, g.month) ? 'ربع هذا الشهر مُقفل.' : undefined}>
              {g.items.map((e) => (
                <ListRow
                  key={e.id}
                  icon="banknote"
                  title={e.description}
                  subtitle={`سُجل ${formatDate(new Date(e.createdAt))}`}
                  value={formatLyd(e.amount)}
                  onPress={() => remove(e)}
                  chevron={false}
                  testID={`expense-${e.id}`}
                />
              ))}
            </ListGroup>
          ))
        )}
        {groups.length ? (
          <View>
            <Text variant="caption" tone="secondary" center>
              اضغط على مصروف لحذفه.
            </Text>
          </View>
        ) : null}
      </KeyboardAwareScrollView>
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/expenses');
