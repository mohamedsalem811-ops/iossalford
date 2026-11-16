import { closeReminder } from './my-sales';

describe('the close-shift reminder', () => {
  const opened = '2026-11-15T09:05:00';
  it('comes at the owner’s hour on the shift’s day', () => {
    expect(closeReminder(opened, new Date(2026, 10, 15, 20, 59), 21)).toBe(false);
    expect(closeReminder(opened, new Date(2026, 10, 15, 21, 0), 21)).toBe(true);
  });
  it('stays on a shift left open from an earlier day', () => {
    expect(closeReminder(opened, new Date(2026, 10, 16, 8, 0), 21)).toBe(true);
  });
  it('never comes when the owner turned it off', () => {
    expect(closeReminder(opened, new Date(2026, 10, 16, 23, 0), 0)).toBe(false);
  });
});
