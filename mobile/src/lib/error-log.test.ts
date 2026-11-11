import { appendEntry, clearLog, logError, MAX_ENTRIES, parseLog, readLog } from './error-log';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
jest.mock('expo-file-system', () => require('@/testing/memory-fs').memoryFs());
jest.mock('expo', () => ({ isRunningInExpoGo: () => false }));
jest.mock('expo-constants', () => ({ expoConfig: { version: '1.0.0' } }));

const entry = (n: number) => ({ at: `2026-11-12T10:00:0${n}`, where: 'x', message: `e${n}` });

describe('the error log on the device', () => {
  beforeEach(() => clearLog());

  it('keeps only the newest entries', () => {
    let text = '';
    for (let i = 0; i < 5; i++) text = appendEntry(text, entry(i), 3);
    expect(parseLog(text).map((e) => e.message)).toEqual(['e2', 'e3', 'e4']);
    expect(MAX_ENTRIES).toBe(200);
  });

  it('writes where and what happened, newest first, and can be cleared', () => {
    logError('المبيعات', new Error('boom'), new Date(2026, 10, 12, 10));
    logError('نسخة تلقائية', 'disk full', new Date(2026, 10, 12, 11));
    const log = readLog();
    expect(log.map((e) => [e.where, e.message])).toEqual([
      ['نسخة تلقائية', 'disk full'],
      ['المبيعات', 'boom'],
    ]);
    expect(log[1].stack).toBeTruthy();
    expect(log[1].version).toBe('1.0.0');
    clearLog();
    expect(readLog()).toEqual([]);
  });

  it('skips a damaged line instead of failing', () => {
    expect(parseLog('{"at":"a","where":"w","message":"m"}\nnot json\n')).toHaveLength(1);
  });
});
