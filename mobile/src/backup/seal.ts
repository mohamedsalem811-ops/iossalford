/**
 * Sealed backups (audit 2): a backup file encrypted with the owner's backup password, so a copy
 * found in Files, AirDropped or left on a computer cannot be read without it.
 *
 * The file keeps its ".db" name (so iOS still offers "Open in SALFORD"); what is inside is:
 *
 *   "SALFORDENC" · version 1 · salt (16 bytes) · PBKDF2 rounds (4) · chunk size (4)
 *   then chunks: length (4) · AES-256-GCM sealed bytes (nonce 12 · data · tag 16)
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
export const SALT_BYTES = 16;
/** PBKDF2 rounds for the backup password: typed only when it is set and on another device. */
export const BACKUP_ROUNDS = 100_000;
export const CHUNK = 1 << 20;
const HEADER = MAGIC.length + 1 + SALT_BYTES + 4 + 4;

/** AES-256-GCM: `encrypt` returns nonce · ciphertext · tag; `decrypt` throws when it doesn't match. */
export type Aes = {
  encrypt(key: Uint8Array, plain: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
  decrypt(key: Uint8Array, sealed: Uint8Array, aad: Uint8Array): Promise<Uint8Array>;
};

/** Reads the next bytes of a file (fewer at its end). */
export type Reader = { size: number; read(n: number): Uint8Array | Promise<Uint8Array> };
export type Writer = { write(bytes: Uint8Array): void | Promise<void> };

export type SealHeader = { salt: Uint8Array; rounds: number; chunk: number };

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
  return concat(ascii(MAGIC), Uint8Array.of(VERSION), h.salt, u32(h.rounds), u32(h.chunk));
}

/** True when these first bytes are a sealed backup's. */
export function isSealed(first: Uint8Array): boolean {
  if (first.length < MAGIC.length) return false;
  return MAGIC.split('').every((c, i) => first[i] === c.charCodeAt(0));
}

/** The header of a sealed file, from its first bytes. */
export function readHeader(first: Uint8Array): SealHeader {
  if (!isSealed(first) || first.length < HEADER || first[MAGIC.length] !== VERSION)
    throw new WrongBackupPassword();
  const at = MAGIC.length + 1;
  const rounds = readU32(first, at + SALT_BYTES);
  const chunk = readU32(first, at + SALT_BYTES + 4);
  // Bounded: a damaged or made-up file must not make the device work for minutes.
  if (rounds < 1 || rounds > 2_000_000 || chunk < 1 || chunk > 64 << 20)
    throw new WrongBackupPassword();
  return { salt: first.slice(at, at + SALT_BYTES), rounds, chunk };
}

export const HEADER_BYTES = HEADER;

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
  const first = await readFull(from, HEADER);
  const h = readHeader(first);
  const header = headerBytes(h);
  let left = from.size - HEADER;
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
