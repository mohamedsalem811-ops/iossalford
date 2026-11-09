import { useState } from 'react';
import { Alert, View } from 'react-native';

import { Button, EmptyState, Screen, Text } from '@/components';
import { setAsideUnreadable } from '@/db/manager';
import type { OpenResult } from '@/db/manager';
import { spacing, type SystemId } from '@/theme';

/**
 * Shown when a system's database can't be opened. Nothing is ever deleted: the owner can retry,
 * go back, or — only after confirming — move the unreadable file aside (kept for recovery) and
 * start that system empty, then restore a backup.
 */
export function DbErrorScreen({
  system,
  result,
  onRetry,
  onBack,
}: {
  system: SystemId;
  result: Exclude<OpenResult, { status: 'ok' }>;
  onRetry: () => void;
  onBack: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const tooNew = result.status === 'too-new';

  const setAside = () =>
    Alert.alert(
      'البدء بقاعدة جديدة؟',
      'سيُنقل الملف الحالي جانباً ويُحفظ كما هو (لن يُحذف)، ويبدأ هذا النظام فارغاً. يمكنك بعدها استعادة آخر نسخة احتياطية.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'نقل الملف والبدء من جديد',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await setAsideUnreadable(system);
              onRetry();
            } catch (e) {
              Alert.alert('تعذر نقل الملف', e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );

  return (
    <Screen>
      <EmptyState
        icon="externaldrive.badge.exclamationmark"
        title={tooNew ? 'هذه البيانات من إصدار أحدث' : 'تعذر فتح بيانات هذا النظام'}
        message={
          tooNew
            ? 'البيانات محفوظة كما هي. ثبّت آخر إصدار من التطبيق ثم افتحه مرة أخرى.'
            : 'البيانات لم تُحذف. حاول مرة أخرى، وإن استمرت المشكلة يمكنك البدء بقاعدة جديدة مع الاحتفاظ بالملف القديم.'
        }
      />
      <View style={{ gap: spacing.sm }}>
        <Button
          title="حاول مرة أخرى"
          icon="arrow.clockwise"
          fullWidth
          onPress={onRetry}
          disabled={busy}
        />
        {tooNew ? null : (
          <Button
            title="البدء بقاعدة جديدة"
            variant="destructive"
            fullWidth
            onPress={setAside}
            loading={busy}
          />
        )}
        <Button title="رجوع" variant="ghost" fullWidth onPress={onBack} disabled={busy} />
      </View>
      <Text variant="caption" tone="secondary" center selectable>
        {result.message}
      </Text>
    </Screen>
  );
}
