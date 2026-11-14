import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import * as Sharing from 'expo-sharing';
import { ActionSheetIOS, Alert } from 'react-native';

import { getLoyalty } from '@/domain/loyalty';
import { getRate } from '@/domain/settings';
import { promptRate } from '@/features/settings/rate';
import { outcomeMessage, restartWarning, runningLabel } from '@/features/updates/model';
import { useAppUpdate } from '@/features/updates/use-app-update';
import { formatRate } from '@/lib/money';
import { SettingsScreen } from '@/screens/settings';
import { getAppearance, setAppearance } from '@/state/appearance';
import { clearLog, logFileUri, readLog } from '@/lib/error-log';
import { getCart } from '@/state/cart';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { useCan } from '@/staff/use-can';

/** "1.0.0 (1)", or "… — Expo Go" while testing there. */
function versionText() {
  const v = Constants.expoConfig?.version ?? '—';
  const build = Constants.expoConfig?.ios?.buildNumber;
  return `${v}${build ? ` (${build})` : ''}${isRunningInExpoGo() ? ' — Expo Go' : ''}`;
}

/** Management → Settings. */
export default function SettingsRoute() {
  const ctx = useCtx();
  const mayEditRate = useCan('settings.edit');
  const [rate, setRate] = useState(() => getRate(ctx));
  const [loyaltyOn, setLoyaltyOn] = useState(() => getLoyalty(ctx).enabled);
  const [appearance, setLook] = useState(getAppearance);
  const refresh = useCallback(() => {
    setRate(getRate(ctx));
    setLoyaltyOn(getLoyalty(ctx).enabled);
  }, [ctx]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const update = useAppUpdate();
  const [errorCount, setErrorCount] = useState(() => readLog().length);
  useFocusEffect(useCallback(() => setErrorCount(readLog().length), []));
  const openLog = () =>
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: 'سجل الأخطاء',
        message: readLog()
          .slice(0, 3)
          .map((e) => `${e.at.slice(0, 16).replace('T', ' ')} • ${e.where}: ${e.message}`)
          .join('\n'),
        options: ['مشاركة السجل', 'مسح السجل', 'إغلاق'],
        destructiveButtonIndex: 1,
        cancelButtonIndex: 2,
      },
      (i) => {
        const uri = logFileUri();
        if (i === 0 && uri)
          Sharing.shareAsync(uri, { mimeType: 'text/plain', UTI: 'public.plain-text' }).catch(
            () => {},
          );
        if (i === 1) {
          clearLog();
          setErrorCount(0);
        }
      },
    );
  const restart = () => {
    const pieces = getCart(ctx.system).reduce((n, l) => n + l.quantity, 0);
    Alert.alert('تحديث جاهز', restartWarning(pieces), [
      { text: 'لاحقاً', style: 'cancel' },
      { text: 'إعادة التشغيل', onPress: () => void update.restart() },
    ]);
  };
  const check = async () => {
    const outcome = await update.check();
    if (outcome === 'ready') restart();
    else Alert.alert('التحديثات', outcomeMessage(outcome));
  };
  return (
    <>
      <Stack.Title>الإعدادات</Stack.Title>
      <SettingsScreen
        system={ctx.system}
        rate={formatRate(rate)}
        appearance={appearance}
        version={versionText()}
        updates={{
          enabled: update.facts.enabled,
          running: runningLabel(update.facts),
          pending: update.pending,
          busy: update.busy,
          onCheck: () => void check(),
          onRestart: restart,
        }}
        errors={{ count: errorCount, onOpen: openLog }}
        onEditRate={mayEditRate ? () => promptRate(ctx, refresh) : undefined}
        loyalty={
          mayEditRate
            ? {
                on: loyaltyOn,
                onOpen: () =>
                  router.push({
                    pathname: '/[system]/more/loyalty',
                    params: { system: ctx.system },
                  }),
              }
            : undefined
        }
        onChangePin={() =>
          router.push({ pathname: '/[system]/change-pin', params: { system: ctx.system } })
        }
        onAppearance={(a) => {
          setAppearance(a);
          setLook(a);
        }}
      />
    </>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('more/settings');
