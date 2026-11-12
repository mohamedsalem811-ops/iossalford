import { outcomeMessage, restartWarning, runningLabel } from './model';

const base = { enabled: true, embedded: false, createdAt: null, emergency: false };

describe('instant updates in Settings', () => {
  it('says updates only work in the installed app (Expo Go, test builds)', () => {
    expect(runningLabel({ ...base, enabled: false })).toBe('التحديثات تعمل في التطبيق المثبّت فقط');
  });

  it('names the code inside the .ipa, and a fallback after a failed update', () => {
    expect(runningLabel({ ...base, embedded: true })).toBe('النسخة المثبّتة');
    expect(runningLabel({ ...base, emergency: true, embedded: true })).toMatch(/رجوع تلقائي/);
  });

  it('shows when the running update was published, with digits 0-9', () => {
    const label = runningLabel({ ...base, createdAt: new Date(2026, 10, 12, 9, 5) });
    expect(label).toBe('تحديث 12 نوفمبر 2026 09:05');
    expect(label).not.toMatch(/[٠-٩]/);
  });

  it('explains every check result without blocking the app', () => {
    expect(outcomeMessage('up-to-date')).toMatch(/محدّث/);
    expect(outcomeMessage('ready')).toMatch(/أعد التشغيل/);
    expect(outcomeMessage('failed')).toMatch(/الإنترنت/);
    expect(outcomeMessage('failed')).toMatch(/يعمل كالمعتاد/);
  });

  it('warns that restarting empties an open sale', () => {
    expect(restartWarning(2)).toMatch(/السلة/);
    expect(restartWarning(0)).toMatch(/رمز الدخول/);
  });
});
