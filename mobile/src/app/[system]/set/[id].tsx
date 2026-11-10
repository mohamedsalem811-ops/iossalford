import { router, useLocalSearchParams } from 'expo-router';

import { SetFormView } from '@/features/sets/set-form';
import { useCtx } from '@/state/system-db';

/** /jewelry/set/new creates a set; /jewelry/set/3 edits set 3. */
export default function SetRoute() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  const setId = id === 'new' ? undefined : Number(id);
  return (
    <SetFormView
      key={id}
      ctx={ctx}
      setId={Number.isInteger(setId) ? setId : undefined}
      onDone={() => router.back()}
    />
  );
}
