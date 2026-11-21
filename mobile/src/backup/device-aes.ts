/**
 * The device's own AES-256-GCM (iOS CryptoKit, through expo-crypto) for sealed backups, and its
 * random bytes. Kept apart so the tests can put Node's in its place.
 */
import {
  aesDecryptAsync,
  aesEncryptAsync,
  AESEncryptionKey,
  AESSealedData,
  getRandomBytes,
} from 'expo-crypto';

import type { Aes } from './seal';

export const deviceAes: Aes = {
  async encrypt(raw, plain, aad) {
    const key = await AESEncryptionKey.import(raw);
    const sealed = await aesEncryptAsync(plain, key, { additionalData: aad });
    return sealed.combined();
  },
  async decrypt(raw, sealed, aad) {
    const key = await AESEncryptionKey.import(raw);
    return aesDecryptAsync(AESSealedData.fromCombined(sealed), key, {
      additionalData: aad,
      output: 'bytes',
    });
  },
};

export const randomBytes = (n: number): Uint8Array => getRandomBytes(n);
