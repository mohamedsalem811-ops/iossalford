import { SLOW_STEP_MS, slowStepLogged } from './photos';

jest.mock('expo-image-picker', () => ({}));
jest.mock('expo-image-manipulator', () => ({ ImageManipulator: {}, SaveFormat: {} }));
jest.mock('expo-file-system', () => ({ File: class {} }));

describe('slowStepLogged', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('logs nothing for a quick step and returns its result', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(slowStepLogged('resize', async () => 7)).resolves.toBe(7);
    jest.advanceTimersByTime(SLOW_STEP_MS * 2);
    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  it('logs a slow step while it runs and when it ends', async () => {
    const error = jest.spyOn(console, 'error').mockImplementation(() => {});
    let finish: (v: string) => void = () => {};
    const done = slowStepLogged('save', () => new Promise<string>((r) => (finish = r)));
    jest.advanceTimersByTime(SLOW_STEP_MS);
    expect(error).toHaveBeenCalledWith('[photo] save still running after 10s');
    finish('ok');
    await expect(done).resolves.toBe('ok');
    expect(error).toHaveBeenLastCalledWith(expect.stringMatching(/^\[photo\] save ended after \d+s$/));
    error.mockRestore();
  });
});
