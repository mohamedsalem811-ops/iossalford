import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { firstBackup, lastCopied, listBackups } from '@/backup/store';
import { BackupScreen } from '@/features/backup/backup-screen';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** Management → Backup. */
function BackupRouteScreen() {
  const ctx = useCtx();
  const read = useCallback(
    () => ({
      backups: listBackups(ctx.system),
      lastCopied: lastCopied(ctx.system),
      firstBackup: firstBackup(ctx.system),
    }),
    [ctx],
  );
  const [data, setData] = useState(read);
  const refresh = useCallback(() => setData(read()), [read]);
  useFocusEffect(refresh);
  return (
    <>
      <Stack.Title>النسخ الاحتياطي</Stack.Title>
      <BackupScreen ctx={ctx} {...data} onChanged={refresh} />
    </>
  );
}

/** Guarded as a whole: only someone with `backup.manage` can open it (see staff/permissions.ts). */
export default function BackupRoute() {
  return (
    <Allowed permission="backup.manage" title="النسخ الاحتياطي">
      <BackupRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/backup');
