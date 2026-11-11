import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { firstBackup, lastCopied, listBackups } from '@/backup/store';
import { BackupScreen } from '@/features/backup/backup-screen';
import { useCtx } from '@/state/system-db';

/** Management → Backup. */
export default function BackupRoute() {
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
