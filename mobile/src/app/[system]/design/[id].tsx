import { router, useLocalSearchParams } from 'expo-router';

import { DesignFormView } from '@/features/scarves/design-form';
import { useCtx } from '@/state/system-db';
import { errorBoundary } from '@/components/error-screen';

/** /scarves/design/new adds a design; /scarves/design/<id> edits it with all its sizes. */
export default function DesignRoute() {
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

/** If this screen hits an unexpected error: a retry screen, and the error goes to the log. */
export const ErrorBoundary = errorBoundary('design/[id]');
