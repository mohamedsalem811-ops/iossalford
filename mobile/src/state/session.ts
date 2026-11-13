/**
 * Who is signed in, readable outside React (the cart, actions after an alert). Set only by the
 * lock (state/lock.tsx) when a system opens and cleared when it locks.
 */
import { actorKey, OWNER, type Actor } from '@/staff/model';

let current: Actor | null = null;
const listeners = new Set<() => void>();

export const getActor = (): Actor | null => current;
/** The person whose cart and settings are in use; the owner when nobody is signed in (tests). */
export const currentActorKey = () => actorKey(current ?? OWNER);

export function setActor(actor: Actor | null) {
  current = actor;
  listeners.forEach((l) => l());
}

export function onActorChange(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
