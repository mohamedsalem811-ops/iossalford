import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import {
  Button,
  Card,
  KEYBOARD_GAP,
  ListGroup,
  ListRow,
  NumberField,
  Text,
  TextField,
} from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  addCashMove,
  cashMoves,
  closeShift,
  differenceText,
  openShift,
  openShiftOf,
} from '@/domain/shifts';
import { showError } from '@/features/products/actions';
import { useReadable } from '@/hooks/use-readable';
import { useSaveOnce } from '@/hooks/use-save-once';
import { formatDay, formatTime } from '@/lib/dates';
import { parseThousandths } from '@/lib/digits';
import { haptic } from '@/lib/haptics';
import { formatLyd } from '@/lib/money';
import { notifyDataChanged, useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { actorKey } from '@/staff/model';
import { useActor } from '@/staff/use-can';
import { spacing, useTheme } from '@/theme';

type Closed = { shiftId: number; expected: number; counted: number; difference: number };

/** "120" or "" → dirhams, or null when it is not a number. Empty is null too. */
const dinars = (t: string) => (t.trim() ? parseThousandths(t) : null);

/**
 * Management → The shift (phase S5): the person's own shift. Opening it with the cash in the
 * drawer; cash put in or taken out with a reason; and closing it with a blind count: the
 * expected cash is shown only after the count is saved.
 */
function ShiftScreen() {
  const ctx = useCtx();
  const actor = useActor();
  const readable = useReadable();
  const { colors } = useTheme();
  // One guard per action: a cash move just saved does not hold back the close.
  const onceOpen = useSaveOnce(true);
  const onceMove = useSaveOnce(true);
  const onceClose = useSaveOnce(true);
  const read = useCallback(() => {
    const shift = actor ? openShiftOf(ctx, actorKey(actor)) : undefined;
    return { shift, moves: shift ? cashMoves(ctx, shift.id) : [] };
  }, [ctx, actor]);
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const [opening, setOpening] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [counted, setCounted] = useState('');
  const [note, setNote] = useState('');
  const [closed, setClosed] = useState<Closed | null>(null);

  const done = () => {
    haptic.success();
    notifyDataChanged();
    refresh();
  };

  const open = () => {
    const cash = opening.trim() ? parseThousandths(opening) : 0;
    if (cash === null) {
      haptic.error();
      Alert.alert('لم تُفتح الوردية', 'اكتب النقد الموجود في الدرج بالدينار (صفر إن كان فارغاً).');
      return;
    }
    try {
      openShift(ctx, cash);
    } catch (error) {
      showError(error);
      return;
    }
    setOpening('');
    setClosed(null);
    done();
    return true;
  };

  const move = (kind: 'in' | 'out') => {
    const value = dinars(amount);
    if (value === null || value <= 0) {
      haptic.error();
      Alert.alert('لم يُسجَّل', 'اكتب المبلغ بالدينار.');
      return;
    }
    try {
      addCashMove(ctx, kind, value, reason);
    } catch (error) {
      showError(error);
      return;
    }
    setAmount('');
    setReason('');
    done();
    return true;
  };

  const close = () => {
    const value = dinars(counted);
    if (value === null) {
      haptic.error();
      Alert.alert('لم تُغلق الوردية', 'عدّ النقد في الدرج واكتبه بالدينار (صفر إن كان فارغاً).');
      return;
    }
    Alert.alert(
      'إغلاق الوردية؟',
      `النقد المعدود: ${formatLyd(value)}. لا يمكن تعديله بعد الإغلاق.`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'إغلاق',
          style: 'destructive',
          onPress: () =>
            onceClose(() => {
              try {
                setClosed(closeShift(ctx, value, { note }));
              } catch (error) {
                showError(error);
                return;
              }
              setCounted('');
              setNote('');
              done();
              return true;
            }),
        },
      ],
    );
  };

  const report = (id: number) =>
    router.push({
      pathname: '/[system]/more/shift-report/[id]',
      params: { system: ctx.system, id: String(id) },
    });

  const { shift, moves } = data;
  return (
    <>
      <Stack.Title>الوردية</Stack.Title>
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
        {closed ? (
          <Card testID="shift-closed">
            <Text variant="headline">أُغلقت الوردية</Text>
            <Text
              variant="body"
              testID="shift-expected">{`المتوقع: ${formatLyd(closed.expected)}`}</Text>
            <Text variant="body">{`المعدود: ${formatLyd(closed.counted)}`}</Text>
            <Text
              variant="bodyStrong"
              tone={closed.difference < 0 ? 'warning' : undefined}
              testID="shift-difference">
              {differenceText(closed.difference)}
            </Text>
            <Button
              title="تقرير الوردية"
              variant="secondary"
              onPress={() => report(closed.shiftId)}
              testID="shift-closed-report"
            />
          </Card>
        ) : null}
        {!shift ? (
          <Card>
            <Text variant="headline">فتح وردية</Text>
            <Text variant="caption" tone="secondary">
              عدّ النقد في الدرج قبل أن تبدأ. البيع يحتاج وردية مفتوحة.
            </Text>
            <NumberField
              label="النقد في الدرج"
              value={opening}
              onChangeText={setOpening}
              suffix="د.ل"
              placeholder="0"
              testID="shift-opening"
            />
            <Button
              title="فتح الوردية"
              icon="play.circle.fill"
              size="lg"
              fullWidth
              onPress={() => onceOpen(open)}
              testID="shift-open"
            />
          </Card>
        ) : (
          <>
            <Card testID="shift-open-card">
              <Text variant="headline">وردية مفتوحة</Text>
              <Text variant="caption" tone="secondary">
                {`منذ ${formatDay(new Date(shift.openedAt))} ${formatTime(new Date(shift.openedAt))} • نقد البداية ${formatLyd(shift.openingCash)}`}
              </Text>
            </Card>
            <Card>
              <Text variant="headline">إدخال أو إخراج نقد</Text>
              <NumberField
                label="المبلغ"
                value={amount}
                onChangeText={setAmount}
                suffix="د.ل"
                testID="shift-move-amount"
              />
              <TextField
                label="السبب"
                value={reason}
                onChangeText={setReason}
                placeholder="مثلاً: فكة، دفع للمورد"
                testID="shift-move-reason"
              />
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="إدخال"
                    icon="plus.circle"
                    variant="secondary"
                    fullWidth
                    onPress={() => onceMove(() => move('in'))}
                    testID="shift-cash-in"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="إخراج"
                    icon="minus.circle"
                    variant="secondary"
                    fullWidth
                    onPress={() => onceMove(() => move('out'))}
                    testID="shift-cash-out"
                  />
                </View>
              </View>
            </Card>
            {moves.length ? (
              <ListGroup header="حركات النقد">
                {moves.map((m) => (
                  <ListRow
                    key={m.id}
                    title={m.reason}
                    subtitle={`${m.kind === 'in' ? 'إدخال' : 'إخراج'} • ${formatTime(new Date(m.createdAt))}`}
                    value={`${m.kind === 'in' ? '+' : '−'}${formatLyd(m.amount)}`}
                    testID={`shift-move-${m.id}`}
                  />
                ))}
              </ListGroup>
            ) : null}
            <Card>
              <Text variant="headline">إغلاق الوردية</Text>
              <Text variant="caption" tone="secondary">
                عدّ النقد في الدرج واكتبه. يظهر المتوقع والفرق بعد الإغلاق.
              </Text>
              <NumberField
                label="النقد المعدود"
                value={counted}
                onChangeText={setCounted}
                suffix="د.ل"
                testID="shift-counted"
              />
              <TextField
                label="ملاحظة (اختياري)"
                value={note}
                onChangeText={setNote}
                testID="shift-note"
              />
              <Button
                title="إغلاق الوردية"
                icon="stop.circle.fill"
                size="lg"
                fullWidth
                onPress={close}
                testID="shift-close"
              />
            </Card>
          </>
        )}
      </KeyboardAwareScrollView>
    </>
  );
}

/** Anyone signed in who sells (`shifts.open`). */
export default function ShiftRoute() {
  return (
    <Allowed permission="shifts.open" title="الوردية">
      <ShiftScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/shift');
