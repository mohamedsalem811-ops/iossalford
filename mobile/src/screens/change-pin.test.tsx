import { fireEvent, screen } from '@testing-library/react-native';

import type { VerifyResult } from '@/security/pin';
import { renderScreen } from '@/testing/render';

import { ChangePinScreen, type ChangePinDeps } from './change-pin';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

const CURRENT = '19283746';
const NEXT = '56473829';

function setup(over: Partial<ChangePinDeps> = {}) {
  const deps = {
    verify: jest.fn(async (_s, pin): Promise<VerifyResult> =>
      pin === CURRENT ? { ok: true } : { ok: false, attemptsLeft: 3, lockedUntil: 0 },
    ),
    setPin: jest.fn(async () => {}),
    now: () => 1_000_000,
    ...over,
  } satisfies ChangePinDeps;
  const onDone = jest.fn();
  return { deps, onDone };
}

async function enter(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`pin-key-${d}`));
}

const message = () => screen.getByTestId('change-pin-message');

describe('ChangePinScreen', () => {
  it('asks for the current PIN, then the new one twice, and saves it', async () => {
    const { deps, onDone } = setup();
    await renderScreen(<ChangePinScreen account="jewelry" deps={deps} onDone={onDone} />);
    expect(message()).toHaveTextContent('أدخل الرمز الحالي');
    await enter(CURRENT);
    expect(message()).toHaveTextContent('أدخل الرمز الجديد (8 أرقام)');
    await enter(NEXT);
    expect(message()).toHaveTextContent('أعد إدخال الرمز الجديد');
    await enter(NEXT);
    expect(deps.setPin).toHaveBeenCalledWith('jewelry', NEXT);
    expect(onDone).toHaveBeenCalled();
  });

  it('counts a wrong current PIN and says how many attempts are left', async () => {
    const { deps, onDone } = setup();
    await renderScreen(<ChangePinScreen account="scarves" deps={deps} onDone={onDone} />);
    await enter('11223344');
    expect(message()).toHaveTextContent('رمز خاطئ، بقيت 3 محاولات قبل القفل المؤقت');
    expect(deps.setPin).not.toHaveBeenCalled();
  });

  it('shows the lockout wait', async () => {
    const { deps, onDone } = setup({
      verify: jest.fn(async (): Promise<VerifyResult> => ({
        ok: false,
        locked: true,
        lockedUntil: 1_090_000,
      })),
    });
    await renderScreen(<ChangePinScreen account="scarves" deps={deps} onDone={onDone} />);
    await enter(CURRENT);
    expect(message()).toHaveTextContent('محاولات خاطئة كثيرة — حاول بعد 1:30');
  });

  it('refuses an easy PIN, the same PIN, and two PINs that differ', async () => {
    const { deps, onDone } = setup();
    await renderScreen(<ChangePinScreen account="jewelry" deps={deps} onDone={onDone} />);
    await enter(CURRENT);
    await enter('11111111');
    expect(message()).toHaveTextContent(/رمز سهل التخمين/);
    await enter(CURRENT);
    expect(message()).toHaveTextContent('الرمز الجديد يجب أن يختلف عن الحالي');
    await enter(NEXT);
    await enter('56473820');
    expect(message()).toHaveTextContent(/الرمزان غير متطابقين/);
    expect(deps.setPin).not.toHaveBeenCalled();
    // Starts again at the new PIN.
    await enter(NEXT);
    await enter(NEXT);
    expect(deps.setPin).toHaveBeenCalledWith('jewelry', NEXT);
  });
});
