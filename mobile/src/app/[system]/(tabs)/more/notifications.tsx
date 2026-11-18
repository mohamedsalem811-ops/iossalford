import { Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, Linking } from 'react-native';

import { Button, Card, ListGroup, ListRow, Page, Text, TextField } from '@/components';
import { errorBoundary } from '@/components/error-screen';
import { RuleError } from '@/domain/context';
import {
  getNotifyRules,
  NOTIFY_KINDS,
  NOTIFY_LABELS,
  setNotifyRules,
  type NotifyRules,
} from '@/domain/notify';
import { parseTime, scheduledText, timeText } from '@/features/notifications/model';
import {
  askNotifyPermission,
  notifyPermission,
  syncReminders,
  type NotifyPermission,
} from '@/features/notifications/scheduler';
import { haptic } from '@/lib/haptics';
import { logError } from '@/lib/error-log';
import { notifyDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { Allowed } from '@/staff/allowed';

/**
 * Settings → التنبيهات (J6), the owner's: reminders on this device while the app is closed (local
 * only, no internet): each kind on or off, the morning time and the closing time, and names
 * hidden on the lock screen. A phone number never shows there.
 */
function NotificationsScreen() {
  const ctx = useCtx();
  const [rules, setRules] = useState(() => getNotifyRules(ctx));
  const [morning, setMorning] = useState(() => timeText(rules.hour, rules.minute));
  const [closing, setClosing] = useState(() => timeText(rules.closeHour, rules.closeMinute));
  const [permission, setPermission] = useState<NotifyPermission>('undetermined');
  const [count, setCount] = useState(0);

  const sync = useCallback(async () => {
    const p = await notifyPermission();
    setPermission(p);
    setCount(await syncReminders(ctx));
  }, [ctx]);
  const syncSafely = useCallback(
    () => void sync().catch((error) => logError('التنبيهات', error)),
    [sync],
  );
  useFocusEffect(syncSafely);

  const save = (changes: Partial<NotifyRules>) => {
    try {
      setRules(setNotifyRules(ctx, changes));
      haptic.tap();
      notifyDataChanged();
      syncSafely();
      return true;
    } catch (error) {
      haptic.error();
      Alert.alert(
        'لم تُحفظ التنبيهات',
        error instanceof RuleError ? error.message : 'حدث خطأ غير متوقع، لم يُحفظ شيء.',
      );
      return false;
    }
  };

  const saveTimes = () => {
    const m = parseTime(morning);
    const c = parseTime(closing);
    if (!m || !c) {
      haptic.error();
      Alert.alert('وقت غير صحيح', 'اكتب الوقت بالساعة والدقيقة، مثلاً 09:00 أو 21:30');
      return;
    }
    if (save({ hour: m.hour, minute: m.minute, closeHour: c.hour, closeMinute: c.minute })) {
      setMorning(timeText(m.hour, m.minute));
      setClosing(timeText(c.hour, c.minute));
    }
  };

  const allow = async () => {
    const granted = await askNotifyPermission().catch(() => false);
    if (!granted) {
      setPermission(await notifyPermission());
      return;
    }
    syncSafely();
  };

  return (
    <>
      <Stack.Title>التنبيهات</Stack.Title>
      <Page keyboard>
        <Card>
          <Text variant="body" testID="notify-status">
            {scheduledText(count, permission)}
          </Text>
          {permission === 'undetermined' ? (
            <Button
              title="السماح بالتنبيهات"
              icon="bell.badge"
              fullWidth
              onPress={() => void allow()}
              testID="notify-allow"
            />
          ) : permission === 'denied' ? (
            <>
              <Text variant="caption" tone="secondary">
                افتح إعدادات الجهاز ← SALFORD ← الإشعارات، وفعّل «السماح بالإشعارات».
              </Text>
              <Button
                title="فتح إعدادات الجهاز"
                icon="gear"
                variant="secondary"
                fullWidth
                onPress={() => void Linking.openSettings()}
                testID="notify-settings"
              />
            </>
          ) : null}
          <Text variant="caption" tone="secondary" testID="notify-per-system">
            {`هذه الإعدادات لنظام ${ctx.system === 'jewelry' ? 'المجوهرات' : 'الأوشحة'} وحده، وللنظام الآخر إعداداته. تُجدَّد تنبيهات كل نظام كلما فُتح، فافتح النظامين مرة في الأسبوع على الأقل.`}
          </Text>
          <Text variant="caption" tone="secondary">
            تنبيهات على هذا الجهاز فقط، تعمل والتطبيق مغلق ودون إنترنت. لا يظهر رقم هاتف أي زبون على
            شاشة القفل.
          </Text>
        </Card>

        <ListGroup header="ما يُنبَّه عنه">
          {NOTIFY_KINDS.map((k) => (
            <ListRow
              key={k}
              icon={rules.on[k] ? 'checkmark.circle.fill' : 'circle'}
              title={NOTIFY_LABELS[k]}
              value={rules.on[k] ? 'تعمل' : 'متوقفة'}
              chevron={false}
              onPress={() => save({ on: { ...rules.on, [k]: !rules.on[k] } })}
              testID={`notify-kind-${k}`}
            />
          ))}
        </ListGroup>

        <ListGroup
          header="شاشة القفل"
          footer="عند الإخفاء يظهر العدد فقط، مثلاً «موعدها اليوم: 2»، دون أسماء الزبائن.">
          <ListRow
            icon={rules.hideNames ? 'eye.slash' : 'eye'}
            title="إخفاء أسماء الزبائن"
            value={rules.hideNames ? 'مخفية' : 'ظاهرة'}
            chevron={false}
            onPress={() => save({ hideNames: !rules.hideNames })}
            testID="notify-hide-names"
          />
        </ListGroup>

        <Card>
          <TextField
            label="وقت تنبيهات الصباح"
            value={morning}
            onChangeText={setMorning}
            placeholder="09:00"
            keyboardType="numbers-and-punctuation"
            testID="notify-morning"
          />
          <TextField
            label="وقت إغلاق المحل (للوردية المفتوحة)"
            value={closing}
            onChangeText={setClosing}
            placeholder="21:30"
            keyboardType="numbers-and-punctuation"
            testID="notify-closing"
          />
          <Button
            title="حفظ الأوقات"
            icon="clock"
            fullWidth
            onPress={saveTimes}
            testID="notify-save-times"
          />
        </Card>
      </Page>
    </>
  );
}

export default function NotificationsRoute() {
  return (
    <Allowed permission="settings.edit" title="التنبيهات">
      <NotificationsScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/notifications');
