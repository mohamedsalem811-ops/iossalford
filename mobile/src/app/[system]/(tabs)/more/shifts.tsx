import { FlashList } from '@shopify/flash-list';
import { router, Stack } from 'expo-router';
import { useCallback } from 'react';
import { Pressable } from 'react-native';

import { EmptyState, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { differenceText, listShifts, type Shift } from '@/domain/shifts';
import { usePaged } from '@/hooks/use-paged';
import { useReadable } from '@/hooks/use-readable';
import { formatDay, formatTime } from '@/lib/dates';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { radius, spacing, useTheme } from '@/theme';

const at = (stamp: string) => `${formatDay(new Date(stamp))} ${formatTime(new Date(stamp))}`;

const status = (s: Shift) => (s.difference === null ? 'مفتوحة' : differenceText(s.difference));

/** Management → Shifts and the cash count (phase S5, the owner): every shift, newest first. */
function ShiftsScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const shown = usePaged(
    useCallback((limit: number, offset: number) => listShifts(ctx, { limit, offset }), [ctx]),
  );
  return (
    <>
      <Stack.Title>الورديات وعدّ النقد</Stack.Title>
      <FlashList
        data={shown.items}
        onEndReached={shown.loadMore}
        onEndReachedThreshold={0.5}
        keyExtractor={(s) => String(s.id)}
        contentInsetAdjustmentBehavior="automatic"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListEmptyComponent={<EmptyState icon="tray" title="لا توجد ورديات" />}
        renderItem={({ item: s }) => (
          <Pressable
            onPress={() =>
              router.push({
                pathname: '/[system]/more/shift-report/[id]',
                params: { system: ctx.system, id: String(s.id) },
              })
            }
            accessibilityRole="button"
            accessibilityLabel={`وردية ${s.personName}، ${status(s)}`}
            testID={`shift-${s.id}`}
            style={({ pressed }) => ({
              marginBottom: spacing.sm,
              padding: spacing.md,
              gap: spacing.xxs,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: pressed ? colors.accentSoft : colors.surface,
            })}>
            <Text variant="headline">{`${s.personName} • وردية رقم ${s.id}`}</Text>
            <Text variant="caption" tone="secondary">
              {s.closedAt ? `${at(s.openedAt)} ← ${at(s.closedAt)}` : `منذ ${at(s.openedAt)}`}
            </Text>
            <Text
              variant="bodyStrong"
              tone={(s.difference ?? 0) < 0 ? 'warning' : undefined}
              testID={`shift-${s.id}-status`}>
              {status(s)}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}

/** The owner only (`shifts.view`). */
export default function ShiftsRoute() {
  return (
    <Allowed permission="shifts.view" title="الورديات">
      <ShiftsScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/shifts');
