/**
 * @jest-environment node
 */
import { lockDelayMs, PinVault, pinProblem, type SecureKv } from './pin';

// Node's crypto stands in for expo-crypto in tests (loaded with require: the app has no Node types).
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createHash, randomBytes } = require('node:crypto') as {
  createHash: (alg: string) => { update: (t: string) => { digest: (enc: 'hex') => string } };
  randomBytes: (n: number) => { toString: (enc: 'hex') => string };
};

function memoryKv(): SecureKv & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
  };
}

const digest = async (t: string) => createHash('sha256').update(t).digest('hex');
const random = () => randomBytes(16).toString('hex');

function vault(now = { t: 1_000_000 }) {
  const kv = memoryKv();
  return { kv, now, v: new PinVault(kv, digest, random, () => now.t) };
}

describe('pinProblem', () => {
  it('needs exactly 8 digits 0-9', () => {
    expect(pinProblem('1234')).toContain('8');
    expect(pinProblem('١٢٣٤٥٦٧٩')).toContain('8'); // must already be 0-9
    expect(pinProblem('2580 1470')).toContain('8');
    expect(pinProblem('25801470')).toBeNull();
  });

  it('refuses easy-to-guess PINs', () => {
    expect(pinProblem('11111111')).toContain('تكرر');
    expect(pinProblem('12345678')).toContain('متتالية');
    expect(pinProblem('87654321')).toContain('متتالية');
    expect(pinProblem('01020304')).toBeNull();
  });
});

describe('lockDelayMs', () => {
  it('allows 5 attempts, then 30 s doubling up to 30 minutes', () => {
    expect([1, 4].map(lockDelayMs)).toEqual([0, 0]);
    expect(lockDelayMs(5)).toBe(30_000);
    expect(lockDelayMs(6)).toBe(60_000);
    expect(lockDelayMs(7)).toBe(120_000);
    expect(lockDelayMs(20)).toBe(30 * 60_000);
  });
});

describe('PinVault', () => {
  it('stores only a salted hash, never the PIN', async () => {
    const { kv, v } = vault();
    await v.setPin('jewelry', '25801470');
    const stored = kv.data.get('pin.jewelry')!;
    expect(stored).not.toContain('25801470');
    expect(JSON.parse(stored)).toEqual({
      salt: expect.any(String),
      hash: expect.stringMatching(/^[0-9a-f]{64}$/),
    });
    // The same PIN in the other system gets a different salt and hash.
    await v.setPin('scarves', '25801470');
    expect(JSON.parse(kv.data.get('pin.scarves')!).hash).not.toBe(JSON.parse(stored).hash);
  });

  it('is ready only when both systems have a PIN', async () => {
    const { v } = vault();
    expect(await v.ready()).toBe(false);
    await v.setPin('jewelry', '25801470');
    expect(await v.ready()).toBe(false);
    await v.setPin('scarves', '36925814');
    expect(await v.ready()).toBe(true);
  });

  it('refuses a weak PIN', async () => {
    const { v } = vault();
    await expect(v.setPin('jewelry', '00000000')).rejects.toThrow('تكرر');
    expect(await v.hasPin('jewelry')).toBe(false);
  });

  it('accepts the right PIN and keeps the systems apart', async () => {
    const { v } = vault();
    await v.setPin('jewelry', '25801470');
    await v.setPin('scarves', '36925814');
    expect(await v.verify('jewelry', '25801470')).toEqual({ ok: true });
    expect(await v.verify('scarves', '25801470')).toMatchObject({ ok: false, attemptsLeft: 4 });
    expect(await v.verify('scarves', '36925814')).toEqual({ ok: true });
  });

  it('locks after 5 wrong attempts, doubles the wait, and opens again after it', async () => {
    const { v, now } = vault();
    await v.setPin('jewelry', '25801470');
    for (let i = 4; i >= 1; i--)
      expect(await v.verify('jewelry', '00000001')).toMatchObject({
        attemptsLeft: i,
        lockedUntil: 0,
      });
    expect(await v.verify('jewelry', '00000001')).toEqual({
      ok: false,
      attemptsLeft: 0,
      lockedUntil: now.t + 30_000,
    });
    // While locked even the right PIN is not checked or counted.
    expect(await v.verify('jewelry', '25801470')).toEqual({
      ok: false,
      locked: true,
      lockedUntil: now.t + 30_000,
    });
    now.t += 30_000;
    expect(await v.lockedUntil('jewelry')).toBe(0);
    expect(await v.verify('jewelry', '00000001')).toEqual({
      ok: false,
      attemptsLeft: 0,
      lockedUntil: now.t + 60_000,
    });
    now.t += 60_000;
    expect(await v.verify('jewelry', '25801470')).toEqual({ ok: true });
    // A correct PIN starts the count again.
    expect(await v.verify('jewelry', '00000001')).toMatchObject({ attemptsLeft: 4 });
  });

  it('lockout in one system does not lock the other', async () => {
    const { v } = vault();
    await v.setPin('jewelry', '25801470');
    await v.setPin('scarves', '36925814');
    for (let i = 0; i < 5; i++) await v.verify('jewelry', '00000001');
    expect(await v.lockedUntil('jewelry')).toBeGreaterThan(0);
    expect(await v.verify('scarves', '36925814')).toEqual({ ok: true });
  });

  it('setting a new PIN or Face ID clears the lockout', async () => {
    const { v } = vault();
    await v.setPin('jewelry', '25801470');
    for (let i = 0; i < 5; i++) await v.verify('jewelry', '00000001');
    await v.clearFailures('jewelry');
    expect(await v.lockedUntil('jewelry')).toBe(0);
    for (let i = 0; i < 5; i++) await v.verify('jewelry', '00000001');
    await v.setPin('jewelry', '14702580');
    expect(await v.verify('jewelry', '14702580')).toEqual({ ok: true });
  });

  it('treats a damaged lock record as locked, not as unlocked', async () => {
    const { kv, v, now } = vault();
    await v.setPin('jewelry', '25801470');
    kv.data.set('pin-lock.jewelry', '{broken');
    expect(await v.lockedUntil('jewelry')).toBe(now.t + 30_000);
  });
});
