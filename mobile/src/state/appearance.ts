/**
 * The owner's appearance choice (automatic, light or dark), kept on this device. Applied to the
 * whole app, native parts included (tab bar, sheets, keyboard), through React Native's
 * Appearance override.
 */
import * as SecureStore from 'expo-secure-store';
import { Appearance as RNAppearance } from 'react-native';

import type { Appearance } from '@/theme';

const KEY = 'appearance';

export const APPEARANCES: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'تلقائي' },
  { value: 'light', label: 'فاتح' },
  { value: 'dark', label: 'داكن' },
];

export function getAppearance(): Appearance {
  try {
    const v = SecureStore.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : 'system';
  } catch {
    return 'system';
  }
}

function apply(a: Appearance) {
  RNAppearance.setColorScheme(a === 'system' ? 'unspecified' : a);
}

/** Saves and applies the choice at once. */
export function setAppearance(a: Appearance) {
  try {
    SecureStore.setItem(KEY, a);
  } catch {
    // Only a preference: if it can't be kept, it still applies until the app closes.
  }
  apply(a);
}

/** Applies the saved choice when the app starts. */
export function applySavedAppearance() {
  apply(getAppearance());
}
