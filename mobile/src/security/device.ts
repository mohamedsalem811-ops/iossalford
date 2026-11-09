/** The PIN vault and Face ID wired to the device (Keychain, SHA-256, LocalAuthentication). */
import * as Crypto from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import type { SystemId } from '@/theme';

import { PinVault, type SecureKv } from './pin';

/** Kept in the Keychain, readable only while the device is unlocked, never synced or backed up. */
const options: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

const keychain: SecureKv = {
  get: (k) => SecureStore.getItemAsync(k, options),
  set: (k, v) => SecureStore.setItemAsync(k, v, options),
  remove: (k) => SecureStore.deleteItemAsync(k, options),
};

const toHex = (bytes: Uint8Array) =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const pinVault = new PinVault(
  keychain,
  (text) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, text),
  () => toHex(Crypto.getRandomBytes(16)),
);

/** Face ID is offered for the jewelry system only, and only when it is set up on the device. */
export async function faceIdAvailable(system: SystemId): Promise<boolean> {
  if (system !== 'jewelry') return false;
  try {
    return (
      (await LocalAuthentication.hasHardwareAsync()) &&
      (await LocalAuthentication.isEnrolledAsync())
    );
  } catch {
    return false;
  }
}

/** Asks for Face ID. True only on success; cancelling or failing falls back to the PIN. */
export async function askFaceId(): Promise<boolean> {
  try {
    const r = await LocalAuthentication.authenticateAsync({
      promptMessage: 'افتح نظام المجوهرات',
      cancelLabel: 'استخدم رمز PIN',
      // The shop's own PIN is the fallback, not the device passcode.
      disableDeviceFallback: true,
    });
    return r.success;
  } catch {
    return false;
  }
}

const LAST_SYSTEM = 'last-system';

/** The system used last, to highlight it on the start screen. */
export function lastSystem(): SystemId | null {
  try {
    const v = SecureStore.getItem(LAST_SYSTEM);
    return v === 'jewelry' || v === 'scarves' ? v : null;
  } catch {
    return null;
  }
}

export function rememberSystem(system: SystemId) {
  try {
    SecureStore.setItem(LAST_SYSTEM, system);
  } catch {
    // Only a convenience: forgetting the last system is harmless.
  }
}
