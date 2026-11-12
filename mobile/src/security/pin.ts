/**
 * PIN rules for both systems. A PIN is 8 digits (0-9), stored only as a salted, slow hash
 * (PBKDF2-SHA256, PIN_ROUNDS rounds) in the Keychain; PINs saved before as one salted SHA-256
 * are upgraded at the next correct entry. After 5 wrong attempts the system locks for 30 seconds, and every further wrong
 * attempt doubles the wait (capped at 30 minutes). There is no default PIN: the owner creates
 * both on first launch.
 *
 * Storage and hashing are passed in, so the rules are tested without the device.
 */
import type { SystemId } from '@/theme';

export const PIN_LENGTH = 8;
export const FREE_ATTEMPTS = 5;
const FIRST_WAIT_MS = 30_000;
const MAX_WAIT_MS = 30 * 60_000;

export interface SecureKv {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

/** SHA-256 of a string, as lowercase hex. */
export type Digest = (text: string) => Promise<string>;
/** PBKDF2-SHA256 of the PIN with the salt, PIN_ROUNDS rounds, as lowercase hex. */
export type Derive = (pin: string, salt: string) => Promise<string>;

/** PBKDF2 rounds: each guess costs this many hashes, while a PIN entry stays quick. */
export const PIN_ROUNDS = 10_000;

/** v2: PBKDF2. No version: the first format (one salted SHA-256). */
type PinRecord = { salt: string; hash: string; v?: 2 };
type LockRecord = { failures: number; lockedUntil: number };

const pinKey = (s: SystemId) => `pin.${s}`;
const lockKey = (s: SystemId) => `pin-lock.${s}`;

/** Why a new PIN is refused, or null when it is acceptable. */
export function pinProblem(pin: string): string | null {
  if (!new RegExp(`^[0-9]{${PIN_LENGTH}}$`).test(pin))
    return `الرمز يجب أن يكون ${PIN_LENGTH} أرقام`;
  if (/^(\d)\1+$/.test(pin)) return 'رمز سهل التخمين: لا تكرر الرقم نفسه';
  const digits = [...pin].map(Number);
  const step = digits[1] - digits[0];
  if (Math.abs(step) === 1 && digits.every((d, i) => i === 0 || d - digits[i - 1] === step)) {
    return 'رمز سهل التخمين: لا تستخدم أرقاماً متتالية';
  }
  return null;
}

/** How long the system stays locked after this many wrong attempts in a row. */
export function lockDelayMs(failures: number): number {
  if (failures < FREE_ATTEMPTS) return 0;
  return Math.min(MAX_WAIT_MS, FIRST_WAIT_MS * 2 ** (failures - FREE_ATTEMPTS));
}

export type VerifyResult =
  | { ok: true }
  /** Wrong PIN; `attemptsLeft` before a lockout starts (0 once locking). */
  | { ok: false; attemptsLeft: number; lockedUntil: number }
  /** Still locked: no attempt was counted. */
  | { ok: false; locked: true; lockedUntil: number };

export class PinVault {
  constructor(
    private kv: SecureKv,
    private digest: Digest,
    private randomHex: () => string,
    private now: () => number = Date.now,
    private derive?: Derive,
  ) {}

  /** The first format, still read for PINs saved before PBKDF2. */
  private async legacyHash(pin: string, salt: string) {
    return this.digest(`salford-pos:${salt}:${pin}`);
  }

  private async record(pin: string): Promise<PinRecord> {
    const salt = this.randomHex();
    return this.derive
      ? { v: 2, salt, hash: await this.derive(pin, salt) }
      : { salt, hash: await this.legacyHash(pin, salt) };
  }

  private async matches(pin: string, r: PinRecord): Promise<boolean> {
    if (r.v === 2) return !!this.derive && (await this.derive(pin, r.salt)) === r.hash;
    return (await this.legacyHash(pin, r.salt)) === r.hash;
  }

  async hasPin(system: SystemId): Promise<boolean> {
    return (await this.kv.get(pinKey(system))) !== null;
  }

  /** Both systems have a PIN (first-launch setup is done). */
  async ready(): Promise<boolean> {
    return (await this.hasPin('jewelry')) && (await this.hasPin('scarves'));
  }

  /** Saves a new PIN (first launch, or after the current one was confirmed). Clears any lockout. */
  async setPin(system: SystemId, pin: string): Promise<void> {
    const problem = pinProblem(pin);
    if (problem) throw new Error(problem);
    await this.kv.set(pinKey(system), JSON.stringify(await this.record(pin)));
    await this.kv.remove(lockKey(system));
  }

  private async lockState(system: SystemId): Promise<LockRecord> {
    const raw = await this.kv.get(lockKey(system));
    if (!raw) return { failures: 0, lockedUntil: 0 };
    try {
      const v = JSON.parse(raw) as LockRecord;
      return { failures: Number(v.failures) || 0, lockedUntil: Number(v.lockedUntil) || 0 };
    } catch {
      return { failures: FREE_ATTEMPTS, lockedUntil: this.now() + FIRST_WAIT_MS };
    }
  }

  /** When the system is locked out, the time it opens again (ms since epoch); otherwise 0. */
  async lockedUntil(system: SystemId): Promise<number> {
    const s = await this.lockState(system);
    return s.lockedUntil > this.now() ? s.lockedUntil : 0;
  }

  async verify(system: SystemId, pin: string): Promise<VerifyResult> {
    const state = await this.lockState(system);
    if (state.lockedUntil > this.now())
      return { ok: false, locked: true, lockedUntil: state.lockedUntil };
    const raw = await this.kv.get(pinKey(system));
    if (raw) {
      const record = JSON.parse(raw) as PinRecord;
      if (await this.matches(pin, record)) {
        // A PIN saved in the first format is saved again with PBKDF2, now that it is known.
        if (record.v !== 2 && this.derive)
          await this.kv.set(pinKey(system), JSON.stringify(await this.record(pin)));
        await this.kv.remove(lockKey(system));
        return { ok: true };
      }
    }
    const failures = state.failures + 1;
    const delay = lockDelayMs(failures);
    const lockedUntil = delay ? this.now() + delay : 0;
    await this.kv.set(lockKey(system), JSON.stringify({ failures, lockedUntil }));
    return { ok: false, attemptsLeft: Math.max(0, FREE_ATTEMPTS - failures), lockedUntil };
  }

  /** Face ID opened the system: wrong-PIN counting starts again. */
  async clearFailures(system: SystemId): Promise<void> {
    await this.kv.remove(lockKey(system));
  }
}
