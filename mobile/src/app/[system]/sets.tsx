import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { listSets } from '@/domain/sets';
import { SetPicker } from '@/features/sets/set-picker';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { useCan } from '@/staff/use-can';

/** Sale → sets: add a whole set to the cart. */
export default function SetsRoute() {
  const ctx = useCtx();
  const mayMake = useCan('sets.edit');
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
      onNew={
        mayMake
          ? () =>
              router.push({
                pathname: '/[system]/set/[id]',
                params: { system: ctx.system, id: 'new' },
              })
          : undefined
      }
    />
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('sets');
