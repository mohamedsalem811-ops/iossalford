import { FlashList } from '@shopify/flash-list';
import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { Button, Card, EmptyState, Text } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import {
  activityDays,
  activityPeople,
  countActivity,
  listActivity,
  type ActivityLine,
} from '@/domain/activity';
import { usePaged } from '@/hooks/use-paged';
import { useReadable } from '@/hooks/use-readable';
import { formatDay, formatTime } from '@/lib/dates';
import { haptic } from '@/lib/haptics';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';
import { acknowledgeBreaks, useLogAlerts } from '@/staff/guards';
import { radius, spacing, useTheme } from '@/theme';

/** Lines the owner should notice: refusals of the PIN, the clock, a broken log. */
const WARNING = new Set(['pin.wrong', 'pin.locked', 'pin.emergency', 'clock.back', 'log.broken']);

const NONE: number[] = [];

const dayOf = (day: string) => formatDay(new Date(`${day}T12:00:00`), true);

/** The details of a line, as plain lines ("saleId: 12"). */
function detailsText(l: ActivityLine): string {
  const at = new Date(l.at);
  const head = `${l.actorName} • ${formatDay(at, true)} ${formatTime(at)}`;
  const rest = l.details
    ? Object.entries(l.details).map(
        ([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`,
      )
    : [];
  return [head, ...rest].join('\n');
}

/**
 * Management → Activity log (phase S3, the owner only): who did what and when, newest first, by
 * person and by day. Lines are only ever added; an alert says when the log was changed outside
 * the app.
 */
function LogRouteScreen() {
  const ctx = useCtx();
  const readable = useReadable();
  const { colors } = useTheme();
  const [actor, setActor] = useState<string | undefined>();
  const [day, setDay] = useState<string | undefined>();
  const broken = useLogAlerts((s) => s.broken[ctx.system]) ?? NONE;
  const shown = usePaged(
    useCallback(
      (limit: number, offset: number) => listActivity(ctx, { actor, day }, { limit, offset }),
      [ctx, actor, day],
    ),
  );
  const readFacts = useCallback(
    () => ({
      people: activityPeople(ctx),
      days: activityDays(ctx),
      count: countActivity(ctx, { actor, day }),
    }),
    [ctx, actor, day],
  );
  const [facts, setFacts] = useState(readFacts);
  const refreshFacts = useCallback(() => setFacts(readFacts()), [readFacts]);
  useFocusEffect(refreshFacts);
  useOnDataChanged(refreshFacts);

  const who = facts.people.find((p) => p.key === actor)?.name;
  const filterText = [who, day ? dayOf(day) : undefined].filter(Boolean).join(' • ');

  return (
    <>
      <Stack.Title>سجل النشاط</Stack.Title>
      <Stack.Toolbar placement="right">
        <Stack.Toolbar.Menu
          icon={actor ? 'person.crop.circle.fill' : 'person.crop.circle'}
          title="الشخص"
          accessibilityLabel="الشخص">
          <Stack.Toolbar.MenuAction isOn={!actor} onPress={() => setActor(undefined)}>
            الجميع
          </Stack.Toolbar.MenuAction>
          {facts.people.map((p) => (
            <Stack.Toolbar.MenuAction
              key={p.key}
              isOn={actor === p.key}
              onPress={() => setActor(p.key)}>
              {p.name}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
        <Stack.Toolbar.Menu
          icon={day ? 'calendar.circle.fill' : 'calendar.circle'}
          title="اليوم"
          accessibilityLabel="اليوم">
          <Stack.Toolbar.MenuAction isOn={!day} onPress={() => setDay(undefined)}>
            كل الأيام
          </Stack.Toolbar.MenuAction>
          {facts.days.map((d) => (
            <Stack.Toolbar.MenuAction key={d} isOn={day === d} onPress={() => setDay(d)}>
              {dayOf(d)}
            </Stack.Toolbar.MenuAction>
          ))}
        </Stack.Toolbar.Menu>
      </Stack.Toolbar>
      <FlashList
        data={shown.items}
        onEndReached={shown.loadMore}
        onEndReachedThreshold={0.5}
        keyExtractor={(l) => String(l.id)}
        contentInsetAdjustmentBehavior="automatic"
        onLayout={readable.onLayout}
        contentContainerStyle={{ paddingHorizontal: readable.side, paddingVertical: spacing.md }}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
            {broken.length ? (
              <Card testID="log-broken">
                <Text variant="bodyStrong" tone="warning">
                  تغيّر السجل خارج التطبيق
                </Text>
                <Text variant="caption" tone="secondary">
                  {`سطر أو أكثر عُدّل أو حُذف دون التطبيق (عند السطر ${broken.join('، ')}). السطور الجديدة تُسجَّل كالعادة.`}
                </Text>
                <Button
                  title="اطلعت على التنبيه"
                  variant="secondary"
                  onPress={() => {
                    acknowledgeBreaks(ctx.system);
                    haptic.tap();
                  }}
                  testID="log-acknowledge"
                />
              </Card>
            ) : null}
            <Text variant="caption" tone="secondary" testID="log-count">
              {`${facts.count} سطر${filterText ? ` • ${filterText}` : ''}`}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState icon="list.bullet.clipboard" title="لا يوجد نشاط" />}
        renderItem={({ item: l }) => (
          <Pressable
            onPress={() => Alert.alert(l.summary, detailsText(l))}
            accessibilityRole="button"
            accessibilityLabel={`${l.summary}، ${l.actorName}، ${formatTime(new Date(l.at))}`}
            testID={`log-${l.id}`}
            style={({ pressed }) => ({
              marginBottom: spacing.sm,
              padding: spacing.md,
              gap: spacing.xxs,
              borderRadius: radius.lg,
              borderCurve: 'continuous',
              backgroundColor: pressed ? colors.accentSoft : colors.surface,
            })}>
            <Text variant="headline" tone={WARNING.has(l.action) ? 'warning' : undefined}>
              {l.summary}
            </Text>
            <Text variant="caption" tone="secondary">
              {`${l.actorName} • ${formatDay(new Date(l.at))} ${formatTime(new Date(l.at))}`}
            </Text>
          </Pressable>
        )}
      />
    </>
  );
}

/** Guarded as a whole: the owner only (`log.view`, see staff/permissions.ts). */
export default function LogRoute() {
  return (
    <Allowed permission="log.view" title="سجل النشاط">
      <LogRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/log');
