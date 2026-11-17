import { parseTime, scheduledText, timeText } from './model';

it('reads a time of day, Arabic digits too', () => {
  expect(parseTime('9')).toEqual({ hour: 9, minute: 0 });
  expect(parseTime('21:30')).toEqual({ hour: 21, minute: 30 });
  expect(parseTime('21.30')).toEqual({ hour: 21, minute: 30 });
  expect(parseTime('٩:٣٠')).toEqual({ hour: 9, minute: 30 });
  expect(parseTime('24:00')).toBeNull();
  expect(parseTime('9:75')).toBeNull();
  expect(parseTime('صباحاً')).toBeNull();
});

it('writes it back with two digits', () => {
  expect(timeText(9, 0)).toBe('09:00');
  expect(timeText(21, 30)).toBe('21:30');
});

it('says what is scheduled', () => {
  expect(scheduledText(0, 'denied')).toContain('غير مسموح');
  expect(scheduledText(0, 'granted')).toContain('لا شيء');
  expect(scheduledText(1, 'granted')).toBe('1 تنبيه مجدول للأيام السبعة القادمة.');
  expect(scheduledText(7, 'granted')).toBe('7 تنبيهات مجدولة للأيام السبعة القادمة.');
  expect(scheduledText(14, 'granted')).toBe('14 تنبيهاً مجدولاً للأيام السبعة القادمة.');
});
