import { act, fireEvent, screen } from '@testing-library/react-native';

import type { VerifyResult } from '@/security/pin';
import { renderScreen } from '@/testing/render';

import { attemptsLeftText, countdown, LoginScreen, type LoginDeps } from './login';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const PIN = '19283746';

function makeDeps(over: Partial<LoginDeps> = {}) {
  let clock = 1_000_000;
  const deps = {
    verify: jest.fn(async (_s, pin): Promise<VerifyResult> =>
      pin === PIN ? { ok: true } : { ok: false, attemptsLeft: 4, lockedUntil: 0 },
    ),
    lockedUntil: jest.fn(async () => 0),
    faceIdAvailable: jest.fn(async () => false),
    askFaceId: jest.fn(async () => false),
    clearFailures: jest.fn(async () => {}),
    now: () => clock,
    ...over,
  } satisfies LoginDeps;
  return { deps, advance: (ms: number) => (clock += ms) };
}

async function enter(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`pin-key-${d}`));
}

describe('countdown and attempts text', () => {
  it('formats minutes and seconds with 0-9 digits', () => {
    expect(countdown(30_000)).toBe('0:30');
    expect(countdown(29_001)).toBe('0:30');
    expect(countdown(120_000)).toBe('2:00');
    expect(countdown(-5)).toBe('0:00');
  });

  it('uses the Arabic forms for 1 and 2', () => {
    expect(attemptsLeftText(1)).toBe('محاولة واحدة');
    expect(attemptsLeftText(2)).toBe('محاولتان');
    expect(attemptsLeftText(4)).toBe('4 محاولات');
  });
});

describe('LoginScreen', () => {
  it('opens with the right PIN', async () => {
    const { deps } = makeDeps();
    const onUnlock = jest.fn();
    await renderScreen(
      <LoginScreen system="scarves" deps={deps} onUnlock={onUnlock} onBack={() => {}} />,
      'scarves',
    );
    expect(screen.getByText('نظام الأوشحة')).toBeOnTheScreen();
    await enter(PIN);
    expect(deps.verify).toHaveBeenCalledWith('scarves', PIN);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('says how many attempts are left after a wrong PIN', async () => {
    const { deps } = makeDeps();
    const onUnlock = jest.fn();
    await renderScreen(
      <LoginScreen system="scarves" deps={deps} onUnlock={onUnlock} onBack={() => {}} />,
    );
    await enter('56473820');
    expect(onUnlock).not.toHaveBeenCalled();
    expect(screen.getByTestId('login-message')).toHaveTextContent(
      'رمز خاطئ، بقيت 4 محاولات قبل القفل المؤقت',
    );
    expect(screen.getByLabelText('تم إدخال 0 من 8')).toBeOnTheScreen();
  });

  it('locks the keypad during a lockout and opens it again when the wait ends', async () => {
    jest.useFakeTimers();
    try {
      const { deps, advance } = makeDeps({
        verify: jest.fn(async () => ({
          ok: false as const,
          attemptsLeft: 0,
          lockedUntil: 1_000_000 + 30_000,
        })),
      });
      await renderScreen(
        <LoginScreen system="scarves" deps={deps} onUnlock={() => {}} onBack={() => {}} />,
      );
      await enter('56473820');
      expect(screen.getByTestId('login-message')).toHaveTextContent(
        'محاولات خاطئة كثيرة — حاول بعد 0:30',
      );
      await fireEvent.press(screen.getByTestId('pin-key-1'));
      expect(screen.getByLabelText('تم إدخال 0 من 8')).toBeOnTheScreen();

      advance(10_000);
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      expect(screen.getByTestId('login-message')).toHaveTextContent('حاول بعد 0:20', {
        exact: false,
      });

      advance(20_000);
      await act(async () => {
        jest.advanceTimersByTime(1_000);
      });
      expect(screen.getByTestId('login-message')).toHaveTextContent('أدخل رمز الدخول');
      await fireEvent.press(screen.getByTestId('pin-key-1'));
      expect(screen.getByLabelText('تم إدخال 1 من 8')).toBeOnTheScreen();
    } finally {
      jest.useRealTimers();
    }
  });

  it('shows a lockout that is still running when the screen opens', async () => {
    const { deps } = makeDeps({ lockedUntil: jest.fn(async () => 1_000_000 + 90_000) });
    await renderScreen(
      <LoginScreen system="scarves" deps={deps} onUnlock={() => {}} onBack={() => {}} />,
    );
    expect(await screen.findByText('النظام مقفل مؤقتاً — حاول بعد 1:30')).toBeOnTheScreen();
  });

  it('asks for Face ID once when it is set up, and opens on success', async () => {
    const { deps } = makeDeps({
      faceIdAvailable: jest.fn(async () => true),
      askFaceId: jest.fn(async () => true),
    });
    const onUnlock = jest.fn();
    const ui = (fn: () => void) => (
      <LoginScreen system="jewelry" deps={deps} onUnlock={fn} onBack={() => {}} />
    );
    const { rerender } = await renderScreen(ui(onUnlock));
    await act(async () => {});
    expect(deps.askFaceId).toHaveBeenCalledTimes(1);
    expect(deps.clearFailures).toHaveBeenCalledWith('jewelry');
    expect(onUnlock).toHaveBeenCalledTimes(1);

    // A new onUnlock (a parent re-render) must not ask again.
    await rerender(ui(jest.fn()));
    await act(async () => {});
    expect(deps.askFaceId).toHaveBeenCalledTimes(1);
  });

  it('waits until the app is on screen before asking for Face ID', async () => {
    const { deps } = makeDeps({
      faceIdAvailable: jest.fn(async () => true),
      askFaceId: jest.fn(async () => true),
    });
    const onUnlock = jest.fn();
    const ui = (active: boolean) => (
      <LoginScreen
        system="jewelry"
        deps={deps}
        onUnlock={onUnlock}
        onBack={() => {}}
        active={active}
      />
    );
    const { rerender } = await renderScreen(ui(false));
    await act(async () => {});
    expect(deps.askFaceId).not.toHaveBeenCalled();
    await rerender(ui(true));
    await act(async () => {});
    expect(deps.askFaceId).toHaveBeenCalledTimes(1);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('keeps the PIN when Face ID is cancelled, with a button to try again', async () => {
    const { deps } = makeDeps({
      faceIdAvailable: jest.fn(async () => true),
      askFaceId: jest.fn(async () => false),
    });
    const onUnlock = jest.fn();
    await renderScreen(
      <LoginScreen system="jewelry" deps={deps} onUnlock={onUnlock} onBack={() => {}} />,
    );
    const button = await screen.findByRole('button', { name: 'الدخول بـ Face ID' });
    expect(onUnlock).not.toHaveBeenCalled();
    await fireEvent.press(button);
    expect(deps.askFaceId).toHaveBeenCalledTimes(2);
    await enter(PIN);
    expect(onUnlock).toHaveBeenCalledTimes(1);
  });

  it('offers no Face ID when it is not available', async () => {
    const { deps } = makeDeps();
    await renderScreen(
      <LoginScreen system="scarves" deps={deps} onUnlock={() => {}} onBack={() => {}} />,
    );
    await act(async () => {});
    expect(deps.askFaceId).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'الدخول بـ Face ID' })).toBeNull();
  });

  it('goes back to the system choice', async () => {
    const { deps } = makeDeps();
    const onBack = jest.fn();
    await renderScreen(
      <LoginScreen system="scarves" deps={deps} onUnlock={() => {}} onBack={onBack} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'تغيير النظام' }));
    expect(onBack).toHaveBeenCalled();
  });
});
