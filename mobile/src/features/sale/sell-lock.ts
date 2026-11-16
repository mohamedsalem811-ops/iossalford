import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import type { Ctx } from '@/domain/context';
import { openShiftOf } from '@/domain/shifts';
import { actorKey, type Actor } from '@/staff/model';
import { useActor } from '@/staff/use-can';
import { useOnDataChanged } from '@/state/data-events';

/** An employee sells only with a shift open (S5); the owner always may. */
export const sellLocked = (ctx: Ctx, actor: Actor | null | undefined): boolean =>
  !!actor && actor.kind !== 'owner' && !openShiftOf(ctx, actorKey(actor));

/**
 * Whether selling is locked for the person signed in (I3): read again on focus and after each
 * change, so opening the shift unlocks the sale tab at once.
 */
export function useSellLock(ctx: Ctx): boolean {
  const actor = useActor();
  const read = useCallback(() => sellLocked(ctx, actor), [ctx, actor]);
  const [locked, setLocked] = useState(read);
  const refresh = useCallback(() => setLocked(read()), [read]);
  useFocusEffect(refresh);
  useOnDataChanged(refresh);
  return locked;
}
