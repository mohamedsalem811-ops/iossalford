/** Tests only: Node's AES-256-GCM in place of the device's (expo-crypto), the same layout. */
import type { Aes } from '../seal';

const subtle = globalThis.crypto.subtle;
const keyOf = (raw: Uint8Array) =>
  subtle.importKey('raw', raw as BufferSource, 'AES-GCM', false, ['encrypt', 'decrypt']);

export const nodeAes: Aes = {
  async encrypt(raw, plain, aad) {
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ct = new Uint8Array(
      await subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: aad as BufferSource },
        await keyOf(raw),
        plain as BufferSource,
      ),
    );
    const out = new Uint8Array(12 + ct.length);
    out.set(iv);
    out.set(ct, 12);
    return out;
  },
  async decrypt(raw, sealed, aad) {
    return new Uint8Array(
      await subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: sealed.slice(0, 12) as BufferSource,
          additionalData: aad as BufferSource,
        },
        await keyOf(raw),
        sealed.slice(12) as BufferSource,
      ),
    );
  },
};
