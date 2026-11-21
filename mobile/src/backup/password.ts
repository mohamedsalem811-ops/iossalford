/**
 * The owner's backup password (audit 2). Only the key made from it is kept, in this device's
 * Keychain (readable while the device is unlocked, never copied to another device or to iCloud),
 * with its salt: backups are sealed without asking for the password. On another device, or for a
 * backup sealed with an older password, the password is typed to open it.
 */
import { pbkdf2Async } from '@noble/hashes/pbkdf2';
import { sha256 } from '@noble/hashes/sha256';
import * as SecureStore from 'expo-secure-store';

import { logAction } from '@/domain/activity';
import { allow, RuleError, type Ctx } from '@/domain/context';

import { randomBytes } from './device-aes';
import { BACKUP_ROUNDS, SALT_BYTES, type SealHeader } from './seal';

const KEY = 'backup.key';
const OPTIONS = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type BackupKey = { salt: Uint8Array; rounds: number; key: Uint8Array };

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (h) => parseInt(h, 16));
const same = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((x, i) => x === b[i]);

/** The key of the backup password on this device, or null when none is set. */
export function backupKey(): BackupKey | null {
  try {
    const raw = SecureStore.getItem(KEY, OPTIONS);
    if (!raw) return null;
    const v = JSON.parse(raw) as { salt: string; rounds: number; key: string };
    const key = unhex(v.key);
    if (key.length !== 32 || !Number.isInteger(v.rounds)) return null;
    return { salt: unhex(v.salt), rounds: v.rounds, key };
  } catch {
    return null;
  }
}

export const hasBackupPassword = () => backupKey() !== null;

export async function deriveKey(password: string, salt: Uint8Array, rounds: number) {
  return pbkdf2Async(sha256, password.normalize('NFC'), salt, { c: rounds, dkLen: 32 });
}

/** What is wrong with a new backup password, or null. */
export function backupPasswordProblem(password: string): string | null {
  if (password.length < 8) return 'كلمة السر 8 أحرف أو أرقام على الأقل';
  if (password.length > 64) return 'كلمة السر طويلة (64 على الأكثر)';
  if (/^(.)\1+$/.test(password)) return 'كلمة السر سهلة التخمين: حروف أو أرقام مكررة';
  return null;
}

/**
 * Sets (or changes) the backup password; returns the key it replaced, if any, so the backups
 * sealed with it can be sealed again with the new one.
 */
export async function setBackupPassword(ctx: Ctx, password: string): Promise<BackupKey | null> {
  allow(ctx, 'backup.manage');
  const problem = backupPasswordProblem(password);
  if (problem) throw new RuleError(problem);
  const old = backupKey();
  const salt = randomBytes(SALT_BYTES);
  const key = await deriveKey(password, salt, BACKUP_ROUNDS);
  SecureStore.setItem(
    KEY,
    JSON.stringify({ salt: hex(salt), rounds: BACKUP_ROUNDS, key: hex(key) }),
    OPTIONS,
  );
  logAction(
    ctx,
    'backup.password',
    old ? 'تغيير كلمة سر النسخ الاحتياطي' : 'وضع كلمة سر للنسخ الاحتياطي',
  );
  return old;
}

/** A sealed file needs the backup password typed (another device, or an older password). */
export class BackupPasswordNeeded extends RuleError {
  constructor() {
    super('هذه النسخة مقفلة بكلمة سر النسخ الاحتياطي: اكتبها لفتحها.');
    this.name = 'BackupPasswordNeeded';
  }
}

/** The key that opens a file sealed with this header: this device's, or the password typed. */
export async function keyFor(
  h: SealHeader,
  password?: string,
  extra: (BackupKey | null)[] = [],
): Promise<Uint8Array> {
  for (const k of [backupKey(), ...extra])
    if (k && same(k.salt, h.salt) && k.rounds === h.rounds) return k.key;
  if (password === undefined) throw new BackupPasswordNeeded();
  return deriveKey(password, h.salt, h.rounds);
}
