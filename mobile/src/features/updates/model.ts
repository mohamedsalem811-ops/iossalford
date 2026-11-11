/**
 * What Settings says about instant updates. Kept apart from expo-updates so it is tested.
 *
 * The installed app checks for an update when it opens and the device is online, downloads it in
 * the background and never waits: with no internet it opens with the version it has. A downloaded
 * update runs on the next launch, or at once from the "update ready" row.
 */
import { formatDate, formatTime } from '@/lib/dates';

export type RunningFacts = {
  /** False in Expo Go and in test builds without updates. */
  enabled: boolean;
  /** Running the code inside the installed .ipa, not a downloaded update. */
  embedded: boolean;
  /** When the running update was published. */
  createdAt: Date | null;
  /** expo-updates fell back to the code inside the .ipa because an update failed to start. */
  emergency: boolean;
};

/** The "running version" line in Settings. */
export function runningLabel(f: RunningFacts): string {
  if (!f.enabled) return 'التحديثات تعمل في التطبيق المثبّت فقط';
  if (f.emergency) return 'النسخة المثبّتة (رجوع تلقائي بعد تحديث لم يعمل)';
  if (f.embedded || !f.createdAt) return 'النسخة المثبّتة';
  return `تحديث ${formatDate(f.createdAt)} ${formatTime(f.createdAt)}`;
}

/** What a check for updates found. */
export type CheckOutcome = 'up-to-date' | 'ready' | 'failed';

export function outcomeMessage(o: CheckOutcome): string {
  switch (o) {
    case 'up-to-date':
      return 'التطبيق محدّث. لا يوجد تحديث جديد.';
    case 'ready':
      return 'تم تنزيل التحديث. أعد التشغيل الآن أو سيعمل في المرة القادمة التي تفتح فيها التطبيق.';
    case 'failed':
      return 'تعذّر التحقق من التحديثات. تأكد من الاتصال بالإنترنت ثم حاول مجدداً. التطبيق يعمل كالمعتاد.';
  }
}

/** Restarting reloads the app: say so first when a sale is open (its cart would be emptied). */
export function restartWarning(cartPieces: number): string {
  return cartPieces > 0
    ? 'السلة المفتوحة ستُفرَّغ عند إعادة التشغيل. أكمل البيع أولاً أو أعد التشغيل لاحقاً.'
    : 'سيُغلق التطبيق ويفتح من جديد بالنسخة الجديدة، ثم يطلب رمز الدخول.';
}
