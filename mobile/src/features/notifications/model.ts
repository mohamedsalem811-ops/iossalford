/**
 * What the reminders screen shows and checks (J6), apart from the screen so it can be tested.
 */

/** "09:00" */
export const timeText = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

/** "9", "9:30", "21.30" or "٩:٣٠" as hour and minute; null for anything else. */
export function parseTime(text: string): { hour: number; minute: number } | null {
  const latin = text.trim().replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  const m = /^(\d{1,2})(?:[:.](\d{2}))?$/.exec(latin);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = m[2] ? Number(m[2]) : 0;
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

/** "7 تنبيهات مجدولة للأيام السبعة القادمة", or why none. */
export function scheduledText(count: number, permission: 'granted' | 'denied' | 'undetermined') {
  if (permission !== 'granted') return 'التنبيهات غير مسموح بها على هذا الجهاز بعد.';
  if (count === 0) return 'لا شيء يُنبَّه عنه في الأيام السبعة القادمة.';
  return `${count} ${count === 1 ? 'تنبيه مجدول' : count === 2 ? 'تنبيهان مجدولان' : count <= 10 ? 'تنبيهات مجدولة' : 'تنبيهاً مجدولاً'} للأيام السبعة القادمة.`;
}
