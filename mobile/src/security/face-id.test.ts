import { faceIdFailure, faceIdFor, faceIdNote } from './face-id';

describe('Face ID messages', () => {
  it('stays quiet when the owner chose the PIN', () => {
    for (const e of ['user_cancel', 'system_cancel', 'app_cancel', 'user_fallback']) {
      expect(faceIdFailure(e)).toBeNull();
    }
  });

  it('explains a failed scan, a lockout and a device without Face ID', () => {
    expect(faceIdFailure('authentication_failed')).toContain('لم يتعرّف Face ID عليك');
    expect(faceIdFailure('lockout')).toContain('افتح قفل الجهاز');
    expect(faceIdFailure('not_enrolled')).toContain('غير مفعّل');
    expect(faceIdFailure('passcode_not_set')).toContain('غير مفعّل');
    expect(faceIdFailure('missing_usage_description')).toBe(
      'تعذّر استخدام Face ID الآن. أدخل رمز PIN.',
    );
  });

  it('has a note for Expo Go and for Face ID not set up, none otherwise', () => {
    expect(faceIdNote('expo-go')).toContain('Expo Go');
    expect(faceIdNote('not-enrolled')).toContain('إعدادات الجهاز');
    expect(faceIdNote('ready')).toBeNull();
    expect(faceIdNote('none')).toBeNull();
  });
});

describe('Face ID for a system (audit 1)', () => {
  it('is off unless the owner switched it on, and only for the jewelry system', () => {
    expect(faceIdFor('jewelry', false, 'ready')).toBe('off');
    expect(faceIdFor('jewelry', true, 'ready')).toBe('ready');
    expect(faceIdFor('jewelry', true, 'not-enrolled')).toBe('not-enrolled');
    expect(faceIdFor('scarves', true, 'ready')).toBe('none');
    expect(faceIdNote('off')).toBeNull();
  });
});
