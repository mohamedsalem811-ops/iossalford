/**
 * Sealed backups (audit 2): a backup file encrypted with the owner's backup password, so a copy
 * found in Files, AirDropped or left on a computer cannot be read without it.
 *
 * The file keeps its ".db" name (so iOS still offers "Open in SALFORD"); what is inside is:
 *
 *   "SALFORDENC" · version 1 · salt (16 bytes) · PBKDF2 rounds (4) · chunk size (4)
 *   then chunks: length (4) · AES-256-GCM sealed bytes (nonce 12 · data · tag 16)
 *
 * Version 2 (K10) adds a second lock after the chunk size: a flag (1) · the emergency password's
 * salt (16) · its rounds (4) · the file's key sealed with the emergency password's key (60). So the
 * owner's emergency password also opens the backup when the backup password is forgotten.
 *
 * The key is PBKDF2-SHA256 of the password with the file's salt. Each chunk is authenticated with
 * the header, its number and whether it is the last, so a chunk changed, moved, or cut off at the
 * end is refused. Large files are read and written one chunk at a time (memory stays small).
 *
 * This module only frames the bytes; the AES itself is passed in (the device's own, through
 * expo-crypto; Node's in the tests).
 */
export const MAGIC = 'SALFORDENC';
const VERSION = 1;
const VERSION_2 = 2;
const WRAPPED_BYTES = 12 + 32 + 16;
export const SALT_BYTES = 16;
/** PBKDF2 rounds for the backup password: typed only when it is set and on another device. */
export const BACKUP_ROUNDS = 100_000;
export const CHUNK = 1 << 20;
const HEADER = MAGIC.length + 1 + SALT_BYTES + 4 + 4;
const HEADER_2 = HEADER + 1 + SALT_BYTES + 4 + WRAPPED_BYTES;

/** AES-256-GCM: `encrypt` returns nonce · ciphertext · tag; `decrypt` throws when it doesn't match. */
export type Aes = {
  encrypt(key: Uint8Array, plain: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  decrypt(key: Uint8Array, sealed: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
};

/** Reads the next bytes of a file (fewer at its end). */
export type Reader = { size: number; read(n: number): Uint8Array | Promise<Uint8Array> };
export type Writer = { write(bytes: Uint8Array): void | Promise<void> };

/** The second lock (K10): the file's key, sealed with the emergency password's key. */
export type Recovery = { salt: Uint8Array; rounds: number; wrapped: Uint8Array };
export type SealHeader = { salt: Uint8Array; rounds: number; chunk: number; recovery?: Recovery };

export class WrongBackupPassword extends Error {
  constructor() {
    super('كلمة سر النسخ الاحتياطي غير صحيحة، أو الملف تالف.');
    this.name = 'WrongBackupPassword';
  }
}

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0));
const u32 = (n: number) => {
  const b = new Uint8Array(4);
  new DataView(b.buffer).setUint32(0, n);
  return b;
};
const readU32 = (b: Uint8Array, at: number) =>
  new DataView(b.buffer, b.byteOffset + at, 4).getUint32(0);
const concat = (...parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
};

export function headerBytes(h: SealHeader): Uint8Array {
  if (!h.recovery)
    return concat(ascii(MAGIC), Uint8Array.of(VERSION), h.salt, u32(h.rounds), u32(h.chunk));
  const r = h.recovery;
  return concat(
    ascii(MAGIC),
    Uint8Array.of(VERSION_2),
    h.salt,
    u32(h.rounds),
    u32(h.chunk),
    Uint8Array.of(1),
    r.salt,
    u32(r.rounds),
    r.wrapped,
  );
}

/** What the second lock is tied to: the file's own salt and rounds. */
const wrapAad = (salt: Uint8Array, rounds: number) =>
  concat(ascii(MAGIC), Uint8Array.of(VERSION_2), salt, u32(rounds));

/** Seals the file's key with the emergency password's key, for a version 2 header. */
export async function wrapKey(
  aes: Aes,
  recoveryKey: Uint8Array,
  fileKey: Uint8Array,
  h: { salt: Uint8Array; rounds: number },
): Promise<Uint8Array> {
  return aes.encrypt(recoveryKey, fileKey, wrapAad(h.salt, h.rounds));
}

/** The file's key from its second lock; throws WrongBackupPassword when it doesn't open. */
export async function unwrapKey(aes: Aes, recoveryKey: Uint8Array, h: SealHeader) {
  if (!h.recovery) throw new WrongBackupPassword();
  try {
    return await aes.decrypt(recoveryKey, h.recovery.wrapped, wrapAad(h.salt, h.rounds));
  } catch {
    throw new WrongBackupPassword();
  }
}

const lengthOf = (version: number) => (version === VERSION_2 ? HEADER_2 : HEADER);

/** True when these first bytes are a sealed backup's. */
export function isSealed(first: Uint8Array): boolean {
  if (first.length < MAGIC.length) return false;
  return MAGIC.split('').every((c, i) => first[i] === c.charCodeAt(0));
}

/** The header of a sealed file, from its first bytes. */
export function readHeader(first: Uint8Array): SealHeader {
  const version = first[MAGIC.length];
  if (!isSealed(first) || (version !== VERSION && version !== VERSION_2))
    throw new WrongBackupPassword();
  if (first.length < lengthOf(version)) throw new WrongBackupPassword();
  const at = MAGIC.length + 1;
  const rounds = readU32(first, at + SALT_BYTES);
  const chunk = readU32(first, at + SALT_BYTES + 4);
  // Bounded: a damaged or made-up file must not make the device work for minutes.
  if (rounds < 1 || rounds > 2_000_000 || chunk < 1 || chunk > 64 << 20)
    throw new WrongBackupPassword();
  const salt = first.slice(at, at + SALT_BYTES);
  if (version === VERSION) return { salt, rounds, chunk };
  let r = at + SALT_BYTES + 8;
  if (first[r] !== 1) throw new WrongBackupPassword();
  r += 1;
  const rsalt = first.slice(r, r + SALT_BYTES);
  const rrounds = readU32(first, r + SALT_BYTES);
  if (rrounds < 1 || rrounds > 2_000_000) throw new WrongBackupPassword();
  const wrapped = first.slice(r + SALT_BYTES + 4, r + SALT_BYTES + 4 + WRAPPED_BYTES);
  return { salt, rounds, chunk, recovery: { salt: rsalt, rounds: rrounds, wrapped } };
}

/** Enough first bytes to read any header (version 1 or 2). */
export const HEADER_BYTES = HEADER_2;
/** The length of this header in the file. */
export const headerLength = (h: SealHeader) => (h.recovery ? HEADER_2 : HEADER);

/** What each chunk is tied to: the header, its number, and whether it is the last one. */
const aadOf = (header: Uint8Array, index: number, last: boolean) =>
  concat(
    header,
    u32(Math.floor(index / 2 ** 32)),
    u32(index % 2 ** 32),
    Uint8Array.of(last ? 1 : 0),
  );

async function readFull(r: Reader, n: number): Promise<Uint8Array> {
  const parts: Uint8Array[] = [];
  let got = 0;
  while (got < n) {
    const b = await r.read(n - got);
    if (!b.length) break;
    parts.push(b);
    got += b.length;
  }
  return parts.length === 1 ? parts[0] : concat(...parts);
}

/** Encrypts everything `from` holds into `to`. */
export async function seal(aes: Aes, key: Uint8Array, h: SealHeader, from: Reader, to: Writer) {
  const header = headerBytes(h);
  await to.write(header);
  const count = Math.max(1, Math.ceil(from.size / h.chunk));
  for (let i = 0; i < count; i++) {
    const plain = await readFull(from, Math.min(h.chunk, from.size - i * h.chunk));
    const sealed = await aes.encrypt(key, plain, aadOf(header, i, i === count - 1));
    await to.write(concat(u32(sealed.length), sealed));
  }
}

/** Decrypts a sealed file into `to`; throws WrongBackupPassword when anything doesn't match. */
export async function unseal(aes: Aes, key: Uint8Array, from: Reader, to: Writer) {
  let first = await readFull(from, HEADER);
  if (first[MAGIC.length] === VERSION_2)
    first = concat(first, await readFull(from, HEADER_2 - HEADER));
  const h = readHeader(first);
  const header = headerBytes(h);
  let left = from.size - header.length;
  for (let i = 0; left > 0; i++) {
    const len = readU32(await readFull(from, 4), 0);
    left -= 4;
    if (len < 28 || len > h.chunk + 28 || len > left) throw new WrongBackupPassword();
    const sealed = await readFull(from, len);
    left -= len;
    let plain: Uint8Array;
    try {
      plain = await aes.decrypt(key, sealed, aadOf(header, i, left === 0));
    } catch {
      throw new WrongBackupPassword();
    }
    await to.write(plain);
  }
}
