import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listSets } from '@/domain/sets';
import { SetPicker } from '@/features/sets/set-picker';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';

/** Sale → sets: add a whole set to the cart. */
export default function SetsRoute() {
  const ctx = useCtx();
  const read = useCallback(() => listSets(ctx), [ctx]);
  const [sets, setSets] = useState(read);
  const refresh = useCallback(() => setSets(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return (
    <SetPicker
      ctx={ctx}
      sets={sets}
      onDone={() => router.back()}
      onNew={() =>
        router.push({ pathname: '/[system]/set/[id]', params: { system: ctx.system, id: 'new' } })
      }
    />
  );
}
