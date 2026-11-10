/**
 * What the login screen says about Face ID. Kept apart from the device code so it is tested.
 *
 * Face ID only works in the installed app: Expo Go cannot use it on iOS (Expo Go has no Face ID
 * permission text of its own), so there the screen says so instead of offering a button that
 * does nothing.
 */

/** ready: offer it. expo-go: explain it works in the installed app. not-enrolled: set it up first. */
export type FaceIdStatus = 'ready' | 'expo-go' | 'not-enrolled' | 'none';

export type FaceIdResult = { ok: true } | { ok: false; error: string };

/** A line under the keypad for a status that has no Face ID button. */
export function faceIdNote(status: FaceIdStatus): string | null {
  if (status === 'expo-go') return 'Face ID لا يعمل داخل Expo Go. يعمل في التطبيق المثبّت.';
  if (status === 'not-enrolled') return 'لاستخدام Face ID فعّله أولاً من إعدادات الجهاز.';
  return null;
}

/** Why Face ID did not open the system, or null when the owner chose the PIN (no message). */
export function faceIdFailure(error: string): string | null {
  switch (error) {
    case 'user_cancel':
    case 'system_cancel':
    case 'app_cancel':
    case 'user_fallback':
      return null;
    case 'authentication_failed':
      return 'لم يتعرّف Face ID عليك. حاول مرة أخرى أو أدخل رمز PIN.';
    case 'lockout':
      return 'Face ID متوقف بعد محاولات كثيرة. افتح قفل الجهاز برمزه ثم حاول، أو أدخل رمز PIN.';
    case 'not_enrolled':
    case 'passcode_not_set':
      return 'Face ID غير مفعّل على هذا الجهاز. أدخل رمز PIN.';
    default:
      return 'تعذّر استخدام Face ID الآن. أدخل رمز PIN.';
  }
}
