/**
 * The app side of phase S3's guards, kept on this device (the Keychain, never in the databases a
 * backup can replace): the device id stamped on every new record, the clock guard's latest time,
 * and the activity log's remembered last line and the breaks the owner has seen.
 */
import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';

import type { Db } from '@/db/types';
import type { SystemId } from '@/theme';

import { ClockGuard } from './clock';

const read = (k: string): string | null => {
  try {
    const v: unknown = SecureStore.getItem(k);
    return typeof v === 'string' ? v : null;
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    SecureStore.setItem(k, v);
  } catch {
    // Kept for this run only; the next write tries again.
  }
};

// ---------- The device id ----------

let device: string | null = null;

/** This device's id: made once, kept in the Keychain (it survives reinstalling the app). */
export function deviceId(): string {
  if (device) return device;
  device = read('device.id');
  if (!device) {
    device = Crypto.randomUUID().replace(/-/g, '');
    write('device.id', device);
  }
  return device;
}

/**
 * Tells the database which device it is on, so the records it makes carry this device's id. Done
 * on every open and after a restore (a backup from the other device brings that device's id).
 */
export function stampDevice(db: Db) {
  db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('device_id', ?)", [deviceId()]);
}

// ---------- The clock ----------

/** One guard for the whole app (the device has one clock). */
export const clockGuard = new ClockGuard({
  get: () => read('clock.latest'),
  set: (v) => write('clock.latest', v),
});

// ---------- The activity log ----------

type Anchor = { id: number; hash: string };

const json = <T>(k: string, fallback: T): T => {
  try {
    const v = read(k);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
};

export const readAnchor = (system: SystemId) => json<Anchor | null>(`log.anchor.${system}`, null);
export const saveAnchor = (system: SystemId, a: Anchor) =>
  write(`log.anchor.${system}`, JSON.stringify(a));

/** Breaks already reported (a log line was written) and those the owner has acknowledged. */
export const reportedBreaks = (system: SystemId) => json<number[]>(`log.reported.${system}`, []);
export const saveReported = (system: SystemId, ids: number[]) =>
  write(`log.reported.${system}`, JSON.stringify(ids));
const acked = (system: SystemId) => json<number[]>(`log.ack.${system}`, []);

/** After a restore the log is the backup's: what was remembered of the old one no longer applies. */
export function forgetLog(system: SystemId) {
  write(`log.anchor.${system}`, '');
  write(`log.reported.${system}`, '[]');
  write(`log.ack.${system}`, '[]');
  useLogAlerts.getState().set(system, []);
}

/** Breaks in the log the owner has not acknowledged yet, per system (the Management banner). */
export const useLogAlerts = create<{
  broken: Partial<Record<SystemId, number[]>>;
  set: (system: SystemId, ids: number[]) => void;
}>()((set) => ({
  broken: {},
  set: (system, ids) => set((s) => ({ broken: { ...s.broken, [system]: ids } })),
}));

/** The breaks found, less those the owner has already acknowledged. */
export function showBreaks(system: SystemId, broken: number[]) {
  const seen = new Set(acked(system));
  useLogAlerts.getState().set(
    system,
    broken.filter((id) => !seen.has(id)),
  );
}

/** The owner has seen the alert: these breaks are not shown again (new ones still are). */
export function acknowledgeBreaks(system: SystemId) {
  const now = useLogAlerts.getState().broken[system] ?? [];
  write(`log.ack.${system}`, JSON.stringify([...new Set([...acked(system), ...now])]));
  useLogAlerts.getState().set(system, []);
}

// ---------- Events waiting for the database ----------

const waiting = new Map<SystemId, ((ctx: never) => void)[]>();

/**
 * Sign-ins and wrong PINs happen before the system's database is open: they wait here and are
 * written as soon as it is (see LogGuard).
 */
export function whenOpen<C>(system: SystemId, write: (ctx: C) => void) {
  const list = waiting.get(system) ?? [];
  list.push(write as (ctx: never) => void);
  waiting.set(system, list);
}

export function takeWaiting<C>(system: SystemId): ((ctx: C) => void)[] {
  const list = waiting.get(system) ?? [];
  waiting.delete(system);
  return list as unknown as ((ctx: C) => void)[];
}

// ---------- The open system ----------

let open: {
  system: SystemId;
  write: (summary: string, details?: Record<string, unknown>) => void;
} | null = null;

/** Set by LogGuard while a system is open: staff changes (shared by both systems) go to its log. */
export function setOpenLog(o: typeof open) {
  open = o;
}

/** A log line for a staff change, in the open system's log. */
export function logStaffChange(summary: string, details?: Record<string, unknown>) {
  open?.write(summary, details);
}
