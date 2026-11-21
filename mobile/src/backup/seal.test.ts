/**
 * @jest-environment node
 */
import {
  CHUNK,
  HEADER_BYTES,
  isSealed,
  readHeader,
  seal,
  unseal,
  WrongBackupPassword,
} from './seal';
import { nodeAes as aes } from './testing/node-aes';

const reader = (bytes: Uint8Array) => {
  let at = 0;
  return {
    size: bytes.length,
    read: (n: number) => {
      const b = bytes.slice(at, at + n);
      at += b.length;
      return b;
    },
  };
};
const sink = () => {
  const parts: Uint8Array[] = [];
  return {
    write: (b: Uint8Array) => void parts.push(b),
    bytes: () => {
      const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
      let at = 0;
      for (const p of parts) {
        out.set(p, at);
        at += p.length;
      }
      return out;
    },
  };
};
const key = new Uint8Array(32).fill(7);
const other = new Uint8Array(32).fill(8);
const header = { salt: new Uint8Array(16).fill(1), rounds: 1000, chunk: 64 };
const data = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i * 31) % 251);

async function sealed(bytes: Uint8Array, h = header) {
  const out = sink();
  await seal(aes, key, h, reader(bytes), out);
  return out.bytes();
}
async function opened(bytes: Uint8Array, k = key) {
  const out = sink();
  await unseal(aes, k, reader(bytes), out);
  return out.bytes();
}

describe('sealed backups', () => {
  it('gives back exactly what was sealed, whatever its size', async () => {
    for (const n of [0, 1, 63, 64, 65, 1000]) {
      const plain = data(n);
      const s = await sealed(plain);
      expect(isSealed(s)).toBe(true);
      expect(readHeader(s.slice(0, HEADER_BYTES))).toEqual(header);
      expect(await opened(s)).toEqual(plain);
    }
    // A plain database is not taken for a sealed one.
    expect(isSealed(new TextEncoder().encode('SQLite format 3\0'))).toBe(false);
  });

  it('hides the data: nothing of it is readable in the file', async () => {
    const plain = new TextEncoder().encode('هدى 0912345678 '.repeat(20));
    const s = await sealed(plain);
    expect(new TextDecoder('latin1').decode(s)).not.toContain('0912345678');
  });

  it('refuses the wrong password, a changed byte, chunks moved, and a file cut short', async () => {
    const s = await sealed(data(200));
    await expect(opened(s, other)).rejects.toThrow(WrongBackupPassword);
    const changed = s.slice();
    changed[changed.length - 20] ^= 1;
    await expect(opened(changed)).rejects.toThrow(WrongBackupPassword);
    const salt = s.slice();
    salt[12] ^= 1; // the header is part of every chunk's check
    await expect(opened(salt)).rejects.toThrow(WrongBackupPassword);
    // Cut after a whole chunk: the last one is missing, and that is noticed.
    const len = 4 + 12 + 64 + 16;
    await expect(opened(s.slice(0, HEADER_BYTES + len))).rejects.toThrow(WrongBackupPassword);
    // Two chunks swapped.
    const a = s.slice(HEADER_BYTES, HEADER_BYTES + len);
    const b = s.slice(HEADER_BYTES + len, HEADER_BYTES + 2 * len);
    const swapped = s.slice();
    swapped.set(b, HEADER_BYTES);
    swapped.set(a, HEADER_BYTES + len);
    await expect(opened(swapped)).rejects.toThrow(WrongBackupPassword);
  });

  it('seals a 40 MB backup in 1 MB chunks quickly (the framing; the device does the AES natively)', async () => {
    const big = data(40 * CHUNK);
    const h = { ...header, chunk: CHUNK };
    const started = Date.now();
    const s = await sealed(big, h);
    const back = await opened(s);
    const ms = Date.now() - started;
    expect(back.length).toBe(big.length);
    expect(s.length - big.length).toBe(HEADER_BYTES + 40 * 32);
    expect(ms).toBeLessThan(20_000);
  });
});
