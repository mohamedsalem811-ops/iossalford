import { router, useLocalSearchParams } from 'expo-router';

import { DesignFormView } from '@/features/scarves/design-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';
import { Allowed } from '@/staff/allowed';

/** /scarves/design/new adds a design; /scarves/design/<id> edits it with all its sizes. */
function DesignRouteScreen() {
  const ctx = useCtx();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <DesignFormView
      key={id}
      ctx={ctx}
      designId={id === 'new' ? undefined : id}
      onDone={() => router.back()}
    />
  );
}

/** Guarded as a whole: only someone with `products.edit` can open it (see staff/permissions.ts). */
export default function DesignRoute() {
  return (
    <Allowed permission="products.edit">
      <DesignRouteScreen />
    </Allowed>
  );
}

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('design/[id]');
