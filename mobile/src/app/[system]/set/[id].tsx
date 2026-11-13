import { router, useLocalSearchParams } from 'expo-router';

import { SetFormView } from '@/features/sets/set-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** /jewelry/set/new creates a set; /jewelry/set/3 edits set 3. */
function SetRouteScreen() {
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

/** Guarded as a whole: only someone with `sets.edit` can open it (see staff/permissions.ts). */
export default function SetRoute() {
  return (
    <Allowed permission="sets.edit">
      <SetRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('set/[id]');
