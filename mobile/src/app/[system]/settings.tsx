import Constants from 'expo-constants';
import { isRunningInExpoGo } from 'expo';
import { router, Stack, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getRate } from '@/domain/settings';
import { promptRate } from '@/features/settings/rate';
import { formatRate } from '@/lib/money';
import { SettingsScreen } from '@/screens/settings';
import { getAppearance, setAppearance } from '@/state/appearance';
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
  return (
    <>
      <Stack.Title>الإعدادات</Stack.Title>
      <SettingsScreen
        system={ctx.system}
        rate={formatRate(rate)}
        appearance={appearance}
        version={versionText()}
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
