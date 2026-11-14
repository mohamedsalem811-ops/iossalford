import { useMemo, useReducer } from 'react';

import { setupCount, setupNeeds, type SetupItem } from '@/domain/setup';
import { useActor } from '@/staff/use-can';
import { useOnDataChanged } from '@/state/data-events';
import { useCtx } from '@/state/system-db';

/**
 * What still needs setting up (H2), read again after every change and when the person signed in
 * changes: the owner's items, nothing for anyone else.
 */
export function useSetup(): { items: SetupItem[]; count: number } {
  const ctx = useCtx();
  const actor = useActor();
  const [version, changed] = useReducer((n: number) => n + 1, 0);
  useOnDataChanged(changed);
  return useMemo(
    () => ({ items: setupNeeds(ctx), count: setupCount(ctx) }),
    // `actor` and `version`: read again when they change (ctx reads the actor itself).
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ctx, actor, version],
  );
}
