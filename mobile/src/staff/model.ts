/**
 * The shop's people: the owner (one per device, whose PIN is the system PIN since Phase 3) and
 * employees, each with their own 6-digit PIN for both systems. Pure rules; the file is store.ts.
 * Employees are suspended, never deleted, so their sales keep their name.
 */
import type { PinAccount } from '@/security/pin';
import type { SystemId } from '@/theme';

import { GRANTABLE, type Permission } from './permissions';

export type Employee = {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  /** Signed in with a temporary PIN (set by the owner, or none yet after a transfer). */
  mustChangePin: boolean;
  /** What the owner gave this person beyond an employee's permissions (GRANTABLE only). */
  grants?: Permission[];
};

/** Who is using the app now. */
export type Actor = { kind: 'owner' } | { kind: 'employee'; id: string; name: string };
export const OWNER: Actor = { kind: 'owner' };

export const isOwner = (a: Actor | null | undefined): boolean => a?.kind === 'owner';

/** A stable key per person (carts, settings): "owner" or "emp-<id>". */
export const actorKey = (a: Actor): string => (a.kind === 'owner' ? 'owner' : `emp-${a.id}`);

/** Whose PIN opens this person: the owner's PIN of the system, or the employee's own. */
export const pinAccountOf = (a: Actor, system: SystemId): PinAccount =>
  a.kind === 'owner' ? system : `user.${a.id}`;

export const actorName = (a: Actor): string => (a.kind === 'owner' ? 'المالك' : a.name);

/** Auto-lock of an employee (and of the owner if chosen), in minutes; owner settings. */
export type LockSettings = {
  lockMinutes: number;
  warnMinutes: number;
  /** The owner is locked the same way (otherwise only when leaving the app). */
  ownerToo: boolean;
};
export const DEFAULT_LOCK: LockSettings = { lockMinutes: 7, warnMinutes: 2, ownerToo: false };
export const LOCK_CHOICES = [3, 5, 7, 10, 15, 20, 30];
export const WARN_CHOICES = [1, 2, 3];

export type Staff = { employees: Employee[]; lock: LockSettings };
export const EMPTY_STAFF: Staff = { employees: [], lock: DEFAULT_LOCK };

const clean = (name: string) => name.trim().replace(/\s+/g, ' ');
const same = (a: string, b: string) => clean(a).toLowerCase() === clean(b).toLowerCase();

/** Why a name can't be used, or null. */
export function nameProblem(staff: Staff, name: string, exceptId?: string): string | null {
  const n = clean(name);
  if (!n) return 'اكتب اسم الموظف';
  if (n.length > 30) return 'الاسم طويل جداً';
  if (same(n, 'المالك')) return 'هذا الاسم محجوز للمالك';
  if (staff.employees.some((e) => e.id !== exceptId && same(e.name, n)))
    return 'يوجد موظف بهذا الاسم';
  return null;
}

export function addEmployee(staff: Staff, name: string, id: string, now: Date): Staff {
  const problem = nameProblem(staff, name);
  if (problem) throw new Error(problem);
  const employee: Employee = {
    id,
    name: clean(name),
    active: true,
    createdAt: now.toISOString(),
    mustChangePin: true,
  };
  return { ...staff, employees: [...staff.employees, employee] };
}

const update = (staff: Staff, id: string, change: Partial<Employee>): Staff => ({
  ...staff,
  employees: staff.employees.map((e) => (e.id === id ? { ...e, ...change } : e)),
});

export const renameEmployee = (staff: Staff, id: string, name: string): Staff => {
  const problem = nameProblem(staff, name, id);
  if (problem) throw new Error(problem);
  return update(staff, id, { name: clean(name) });
};
export const setActive = (staff: Staff, id: string, active: boolean) =>
  update(staff, id, { active });
/** Gives or takes back one of the GRANTABLE permissions from an employee. */
export function setGrant(staff: Staff, id: string, permission: Permission, on: boolean): Staff {
  if (!GRANTABLE[permission]) return staff;
  const e = staff.employees.find((x) => x.id === id);
  if (!e) return staff;
  const rest = (e.grants ?? []).filter((g) => g !== permission);
  return update(staff, id, { grants: on ? [...rest, permission] : rest });
}

export const setMustChangePin = (staff: Staff, id: string, must: boolean) =>
  update(staff, id, { mustChangePin: must });

/** Active employees first, then by name. */
export const sortedStaff = (staff: Staff) =>
  [...staff.employees].sort(
    (a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name, 'ar'),
  );

export const activeEmployees = (staff: Staff) => sortedStaff(staff).filter((e) => e.active);

/** Reads a saved staff file; anything unreadable gives an empty list (the owner still opens). */
export function parseStaff(text: string | null): Staff {
  if (!text) return EMPTY_STAFF;
  try {
    const v = JSON.parse(text) as Partial<Staff>;
    const employees = (Array.isArray(v.employees) ? v.employees : []).filter(
      (e): e is Employee =>
        !!e &&
        typeof e.id === 'string' &&
        typeof e.name === 'string' &&
        typeof e.active === 'boolean',
    );
    const l = (v.lock ?? {}) as Partial<LockSettings>;
    const lock: LockSettings = {
      lockMinutes: LOCK_CHOICES.includes(l.lockMinutes ?? -1) ? l.lockMinutes! : 7,
      warnMinutes: WARN_CHOICES.includes(l.warnMinutes ?? -1) ? l.warnMinutes! : 2,
      ownerToo: l.ownerToo === true,
    };
    return {
      employees: employees.map((e) => ({
        ...e,
        mustChangePin: e.mustChangePin !== false,
        grants: (Array.isArray(e.grants) ? e.grants : []).filter((g) => GRANTABLE[g] === true),
      })),
      lock,
    };
  } catch {
    return EMPTY_STAFF;
  }
}

/** The list sent to the other device: names and ids only, never a PIN. */
export function transferText(staff: Staff): string {
  return JSON.stringify({
    kind: 'salford-staff',
    employees: staff.employees.map(({ id, name, active }) => ({ id, name, active })),
  });
}

/**
 * Adds the people of a transferred list who are not on this device yet (same id), each with no
 * PIN here: their first sign-in needs the owner's approval, then they choose their PIN.
 */
export function mergeTransfer(
  staff: Staff,
  text: string,
  now: Date,
): { staff: Staff; added: number } {
  let v: { kind?: string; employees?: { id?: unknown; name?: unknown; active?: unknown }[] };
  try {
    v = JSON.parse(text);
  } catch {
    throw new Error('هذا الملف ليس قائمة موظفين من SALFORD POS');
  }
  if (v.kind !== 'salford-staff' || !Array.isArray(v.employees))
    throw new Error('هذا الملف ليس قائمة موظفين من SALFORD POS');
  let next = staff;
  let added = 0;
  for (const e of v.employees) {
    if (typeof e.id !== 'string' || typeof e.name !== 'string') continue;
    if (next.employees.some((x) => x.id === e.id)) continue;
    const name = nameProblem(next, e.name) ? `${clean(e.name)} (2)` : clean(e.name);
    next = {
      ...next,
      employees: [
        ...next.employees,
        {
          id: e.id,
          name,
          active: e.active !== false,
          createdAt: now.toISOString(),
          mustChangePin: true,
        },
      ],
    };
    added++;
  }
  return { staff: next, added };
}

/** What the idle timer says: keep going, warn (with the time left) or lock. */
export function idlePhase(
  idleMs: number,
  lock: Pick<LockSettings, 'lockMinutes' | 'warnMinutes'>,
): { phase: 'ok' | 'warn' | 'lock'; leftMs: number } {
  const lockMs = lock.lockMinutes * 60_000;
  const warnMs = Math.min(lock.warnMinutes, lock.lockMinutes) * 60_000;
  const leftMs = Math.max(0, lockMs - idleMs);
  if (leftMs === 0) return { phase: 'lock', leftMs };
  if (leftMs <= warnMs) return { phase: 'warn', leftMs };
  return { phase: 'ok', leftMs };
}
