import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert } from 'react-native';

import { getRate } from '@/domain/settings';
import { promptRate } from '@/features/settings/rate';
import { outcomeMessage, restartWarning, runningLabel } from '@/features/updates/model';
import { useAppUpdate } from '@/features/updates/use-app-update';
import { formatRate } from '@/lib/money';
import { SettingsScreen } from '@/screens/settings';
import { getAppearance, setAppearance } from '@/state/appearance';
import { getCart } from '@/state/cart';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';

/** "1.0.0 (1)", or "… — Expo Go" while testing there. */
function versionText() {
  const v = Constants.expoConfig?.version ?? '—';
  const build = Constants.expoConfig?.ios?.buildNumber;
  return `${v}${build ? ` (${build})` : ''}${isRunningInExpoGo() ? ' — Expo Go' : ''}`;
}

/** Management → Settings. */
export default function SettingsRoute() {
  const ctx = useCtx();
  const [rate, setRate] = useState(() => getRate(ctx));
  const [appearance, setLook] = useState(getAppearance);
  const refresh = useCallback(() => setRate(getRate(ctx)), [ctx]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  const update = useAppUpdate();
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
        onEditRate={() => promptRate(ctx, refresh)}
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
