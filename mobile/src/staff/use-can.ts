import { useSyncExternalStore } from 'react';

import { getActor, onActorChange } from '@/state/session';

import type { Actor } from './model';
import { can, type Permission } from './permissions';

/** Who is signed in now; screens re-render when it changes. */
export function useActor(): Actor | null {
  return useSyncExternalStore(onActorChange, getActor, getActor);
}

/**
 * True when the person signed in may do or see this. Screens use it to hide buttons and figures;
 * the business rules check again on their own, so a hidden button is never the only guard.
 */
export function useCan(permission: Permission): boolean {
  return can(useActor(), permission);
}
