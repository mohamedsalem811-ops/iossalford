import { isRunningInExpoGo } from 'expo';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActionSheetIOS, Alert, View } from 'react-native';

import { Button, Card, ListGroup, ListRow, Page, Text } from '@/components';
import { backupContents } from '@/domain/backup';
import { RuleError, type Ctx } from '@/domain/context';
import { canExcludeFromBackup, isAppDataExcluded } from '@/backup/exclusion';
import { agoText, copyReminder, KIND_LABELS, type BackupInfo } from '@/backup/model';
import {
  deleteBackup,
  pickBackupFile,
  readBackupFile,
  restore,
  saveBackup,
  savedBackupUri,
  shareCopy,
  type BackupFile,
} from '@/backup/store';
import { formatDate, formatTime } from '@/lib/dates';
import { notifyDataChanged } from '@/state/data-events';
import { spacing } from '@/theme';

const SYSTEM_NAMES = { jewelry: 'المجوهرات', scarves: 'الأوشحة' } as const;

const fail = (error: unknown, title = 'تعذّرت العملية') =>
  Alert.alert(
    title,
    error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يتغير شيء.',
  );

/**
 * Management → Backup: backups saved on this device (automatic on leaving the app, or now),
 * a copy off the device (AirDrop, Files, a computer) with the photos, and restoring from a saved
 * backup or a file, checked first, confirmed, with a safety copy of the data it replaces.
 */
export function BackupScreen({
  ctx,
  backups,
  lastCopied,
  firstBackup,
  onChanged,
}: {
  ctx: Ctx;
  backups: BackupInfo[];
  lastCopied: Date | null;
  firstBackup: Date | null;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const now = ctx.now();
  const reminder = copyReminder(lastCopied, now, firstBackup);
  const system = SYSTEM_NAMES[ctx.system];

  const saveNow = () => {
    try {
      saveBackup(ctx, 'manual');
    } catch (error) {
      return fail(error, 'لم تُحفظ النسخة');
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onChanged();
  };

  const copy = async () => {
    setBusy(true);
    try {
      await shareCopy(ctx);
    } catch (error) {
      fail(error, 'لم تُنسخ النسخة');
    } finally {
      setBusy(false);
      onChanged();
    }
  };

  /** Shows what the backup holds and asks; restores only on "استعادة". */
  const confirmRestore = (file: BackupFile) => {
    const c = backupContents(file);
    const when = new Date(c.exportedAt);
    Alert.alert(
      `استعادة نسخة نظام ${system}؟`,
      [
        `نسخة ${formatDate(when)} ${formatTime(when)}:`,
        `${c.products} قطعة، ${c.sales} بيعة، ${c.customers} زبون، ${c.receipts} إيصال${file.photos ? `، ${Object.keys(file.photos).length} صورة` : ''}.`,
        '',
        `تحل محل كل بيانات نظام ${system} الحالية. تُحفظ نسخة أمان من البيانات الحالية أولاً، فيمكن التراجع.`,
      ].join('\n'),
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استعادة',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await restore(ctx, file);
            } catch (error) {
              fail(error, 'لم تتم الاستعادة');
              return;
            } finally {
              setBusy(false);
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            notifyDataChanged();
            onChanged();
            Alert.alert(
              'تمت الاستعادة',
              'حُفظت نسخة أمان من البيانات السابقة في القائمة («قبل الاستعادة»).',
            );
          },
        },
      ],
    );
  };

  const restoreFrom = async (uri: string) => {
    try {
      confirmRestore(await readBackupFile(ctx, uri));
    } catch (error) {
      fail(error, 'لا يمكن استعادة هذا الملف');
    }
  };

  const fromFile = async () => {
    const uri = await pickBackupFile().catch(() => null);
    if (uri) await restoreFrom(uri);
  };

  const backupMenu = (b: BackupInfo) => {
    const items = [
      { title: 'استعادة هذه النسخة', run: () => restoreFrom(savedBackupUri(ctx.system, b.name)) },
      {
        title: 'حذف النسخة',
        run: () =>
          Alert.alert('حذف هذه النسخة؟', b.name, [
            { text: 'إلغاء', style: 'cancel' },
            {
              text: 'حذف',
              style: 'destructive',
              onPress: () => {
                deleteBackup(ctx.system, b.name);
                onChanged();
              },
            },
          ]),
      },
    ];
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `${formatDate(b.at)} ${formatTime(b.at)} • ${KIND_LABELS[b.kind]}`,
        options: [...items.map((i) => i.title), 'إغلاق'],
        cancelButtonIndex: items.length,
        destructiveButtonIndex: 1,
      },
      (i) => items[i]?.run(),
    );
  };

  return (
    <Page>
      {reminder ? (
        <Card>
          <Text variant="bodyStrong" tone="warning" testID="backup-reminder">
            {reminder}
          </Text>
        </Card>
      ) : null}

      <Card>
        <Text variant="headline">{`نظام ${system}`}</Text>
        <Text variant="subhead" tone="secondary">
          {backups[0]
            ? `آخر نسخة على الجهاز: ${agoText(backups[0].at, now)}، ${formatTime(backups[0].at)}`
            : 'لا توجد نسخ على الجهاز بعد'}
        </Text>
        <Text variant="subhead" tone="secondary" testID="backup-copied">
          {lastCopied
            ? `آخر نسخة خارج الجهاز: ${agoText(lastCopied, now)}`
            : 'لم تُنسخ نسخة خارج الجهاز بعد'}
        </Text>
        <Button
          title="نسخ خارج الجهاز"
          icon="square.and.arrow.up"
          size="lg"
          fullWidth
          loading={busy}
          onPress={copy}
          testID="backup-copy"
        />
        <Text variant="caption" tone="secondary">
          ملف واحد بالبيانات والصور: أرسله بـ AirDrop إلى الجهاز الآخر، أو احفظه في الملفات، أو
          انقله إلى كمبيوتر.
        </Text>
        <Button
          title="نسخة على الجهاز الآن"
          icon="tray.and.arrow.down"
          variant="secondary"
          fullWidth
          disabled={busy}
          onPress={saveNow}
          testID="backup-now"
        />
      </Card>

      <ListGroup
        header={`النسخ على هذا الجهاز (${backups.length})`}
        footer="تُحفظ نسخة تلقائياً كلما خرجت من التطبيق (إن تغيّر شيء)، ويُحتفظ بآخر 10. اضغط على نسخة لاستعادتها أو حذفها.">
        {backups.length === 0 ? (
          <ListRow icon="externaldrive" title="لا توجد نسخ بعد" />
        ) : (
          backups.map((b) => (
            <ListRow
              key={b.name}
              icon={b.kind === 'safety' ? 'lifepreserver' : 'externaldrive'}
              title={`${formatDate(b.at)} • ${formatTime(b.at)}`}
              subtitle={`${KIND_LABELS[b.kind]} • ${agoText(b.at, now)}`}
              onPress={() => backupMenu(b)}
              testID={`backup-${b.name}`}
            />
          ))
        )}
      </ListGroup>

      <Button
        title="استعادة من ملف"
        icon="arrow.down.doc"
        variant="secondary"
        fullWidth
        disabled={busy}
        onPress={fromFile}
        testID="backup-from-file"
      />

      <View style={{ gap: spacing.xs, paddingHorizontal: spacing.xs }}>
        <Text variant="caption" tone="secondary">
          {isRunningInExpoGo()
            ? 'في Expo Go تُحفظ النسخ داخل Expo Go للتجربة فقط. في التطبيق المثبّت تجدها في الملفات ← على الـ iPhone (أو الـ iPad) ← SALFORD POS ← Backups.'
            : 'تجد النسخ في تطبيق الملفات ← على الـ iPhone (أو الـ iPad) ← SALFORD POS ← Backups، وعلى الكمبيوتر عبر الكابل (Finder ← الجهاز ← الملفات ← SALFORD POS).'}
        </Text>
        <Text variant="caption" tone="secondary" testID="backup-icloud">
          {canExcludeFromBackup()
            ? isAppDataExcluded()
              ? 'لا يُرفع شيء إلى iCloud: بيانات التطبيق ونسخه مستثناة من نسخة الجهاز الاحتياطية في iCloud.'
              : 'لا يُرفع شيء إلى iCloud.'
            : 'لا يُرفع شيء إلى iCloud. (استثناء البيانات من نسخة iCloud للجهاز يعمل في التطبيق المثبّت.)'}
        </Text>
        <Text variant="caption" tone="secondary">
          حذف التطبيق يحذف بياناته ونسخه، لذا احتفظ بنسخة على الجهاز الآخر أو على كمبيوتر.
        </Text>
      </View>
    </Page>
  );
}
