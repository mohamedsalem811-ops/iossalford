/**
 * Hands the week's reminders (J6, `domain/notify`) to iOS as local notifications: scheduled on the
 * device, shown while the app is closed, no internet and no Apple push service. Each system
 * replaces only its own (their ids start with the system), so both systems' reminders stay.
 */
import * as Notifications from 'expo-notifications';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

import { firstBackup, lastCopied } from '@/backup/store';
import type { Ctx } from '@/domain/context';
import { planReminders } from '@/domain/notify';
import { logError } from '@/lib/error-log';
import { useOnDataChanged } from '@/state/data-events';

export type NotifyPermission = 'granted' | 'denied' | 'undetermined';

export async function notifyPermission(): Promise<NotifyPermission> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted ? 'granted' : p.canAskAgain ? 'undetermined' : 'denied';
}

/** Asks iOS once (the owner turns reminders on); later, only the device's Settings change it. */
export async function askNotifyPermission(): Promise<boolean> {
  const p = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: false, allowSound: true },
  });
  return p.granted;
}

/** Plans the coming week again for this system. Returns how many were scheduled. */
export async function syncReminders(ctx: Ctx): Promise<number> {
  if ((await notifyPermission()) !== 'granted') return 0;
  const planned = planReminders(ctx, {
    lastCopied: lastCopied(ctx.system),
    firstBackup: firstBackup(ctx.system),
  });
  const mine = (await Notifications.getAllScheduledNotificationsAsync()).filter((n) =>
    n.identifier.startsWith(`${ctx.system}-`),
  );
  await Promise.all(mine.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));
  for (const r of planned) {
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body, sound: true, data: { system: ctx.system } },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at },
    });
  }
  return planned.length;
}

/**
 * Keeps the open system's reminders up to date: when it opens, a little after each change, and
 * every time the app goes to the background (the plan for while it is closed).
 */
export function ReminderSync({ ctx }: { ctx: Ctx }) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const run = useRef(() => {});
  useEffect(() => {
    run.current = () => {
      syncReminders(ctx).catch((error) => logError('التنبيهات', error));
    };
  }, [ctx]);
  useEffect(() => {
    run.current();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') run.current();
    });
    return () => {
      sub.remove();
      if (timer.current) clearTimeout(timer.current);
    };
  }, [ctx]);
  useOnDataChanged(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run.current(), 3_000);
  });
  return null;
}
