/**
 * Handing the week's reminders to iOS (J6): nothing without the permission; with it, this
 * system's old reminders replaced by the new plan, the other system's left alone.
 */
import * as Notifications from 'expo-notifications';

import { takeRepair } from '@/domain/repairs';
import { makeCtx, type TestCtx } from '@/domain/testing/ctx';

import { showWhileOpen, syncReminders } from './scheduler';

jest.mock('@/backup/store', () => ({ lastCopied: () => null, firstBackup: () => null }));

const N = jest.mocked(Notifications);
let ctx: TestCtx;
beforeEach(() => {
  jest.clearAllMocks();
  ctx = makeCtx('jewelry', new Date(2026, 10, 17, 8));
  takeRepair(ctx, {
    customer: { name: 'منى', phone: '0912345678' },
    description: 'خاتم',
    work: 'polish',
    price: 10_000,
    readyBy: '2026-11-18',
  });
});
afterEach(() => ctx.close());

it('schedules nothing without the permission', async () => {
  expect(await syncReminders(ctx)).toBe(0);
  expect(N.scheduleNotificationAsync).not.toHaveBeenCalled();
});

it('replaces this system’s reminders and leaves the other system’s', async () => {
  N.getPermissionsAsync.mockResolvedValueOnce({ granted: true, canAskAgain: true } as never);
  N.getAllScheduledNotificationsAsync.mockResolvedValueOnce([
    { identifier: 'jewelry-repairs-2026-11-10' },
    { identifier: 'scarves-orders-2026-11-18' },
  ] as never);
  const count = await syncReminders(ctx);
  expect(count).toBeGreaterThan(0);
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledTimes(1);
  expect(N.cancelScheduledNotificationAsync).toHaveBeenCalledWith('jewelry-repairs-2026-11-10');
  expect(N.scheduleNotificationAsync).toHaveBeenCalledTimes(count);
  expect(N.scheduleNotificationAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      identifier: 'jewelry-repairs-2026-11-18',
      content: expect.objectContaining({ title: 'الصيانة • المجوهرات', body: 'موعدها اليوم: منى' }),
      trigger: { type: 'date', date: new Date(2026, 10, 18, 9, 0) },
    }),
  );
});

it('shows a reminder while the app is open too (the iPad is the till)', async () => {
  showWhileOpen();
  const handler = N.setNotificationHandler.mock.calls[0][0]!;
  await expect(handler.handleNotification({} as never)).resolves.toMatchObject({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
  });
});
