import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import { PinVault, type SecureKv } from '@/security/pin';
import type { Employee } from '@/staff/model';
import { renderScreen } from '@/testing/render';

import { SignInScreen, type SignInDeps } from './sign-in';

jest.mock('expo-haptics', () => ({}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Node's crypto in tests
const { createHash, randomBytes } = require('node:crypto') as {
  createHash: (a: string) => { update: (t: string) => { digest: (e: 'hex') => string } };
  randomBytes: (n: number) => { toString: (e: 'hex') => string };
};

function setup(employees: Employee[]) {
  const data = new Map<string, string>();
  const kv: SecureKv = {
    get: async (k) => data.get(k) ?? null,
    set: async (k, v) => void data.set(k, v),
    remove: async (k) => void data.delete(k),
  };
  const vault = new PinVault(
    kv,
    async (t) => createHash('sha256').update(t).digest('hex'),
    () => randomBytes(16).toString('hex'),
  );
  const pinChanged = jest.fn();
  const deps: SignInDeps = {
    verify: (a, p) => vault.verify(a, p),
    lockedUntil: (a) => vault.lockedUntil(a),
    clearFailures: (a) => vault.clearFailures(a),
    faceIdStatus: async () => 'none',
    askFaceId: async () => ({ ok: false, error: 'not_available' }),
    hasPin: (a) => vault.hasPin(a),
    setPin: (a, p) => vault.setPin(a, p),
    emergencyKind: () => vault.emergencyKind(),
    checkEmergencyCode: (c) => vault.checkEmergencyCode(c),
    pinChanged,
    pinReset: jest.fn(),
  };
  return { vault, deps, pinChanged };
}

const sara = (over: Partial<Employee> = {}): Employee => ({
  id: 'a',
  name: 'سارة',
  active: true,
  createdAt: 'x',
  mustChangePin: false,
  ...over,
});

async function enter(pin: string) {
  for (const d of pin) await fireEvent.press(screen.getByTestId(`pin-key-${d}`));
}

describe('signing in', () => {
  it("is the owner's PIN as before when there are no employees", async () => {
    const { vault, deps } = setup([]);
    await vault.setPin('jewelry', '25801470');
    const onUnlock = jest.fn();
    await renderScreen(
      <SignInScreen
        system="jewelry"
        employees={[]}
        deps={deps}
        onUnlock={onUnlock}
        onBack={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('sign-in-people')).toBeNull();
    await enter('25801470');
    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith({ kind: 'owner' }));
  });

  it('shows the names; an employee opens with their own 6-digit PIN', async () => {
    const { vault, deps } = setup([sara()]);
    await vault.setPin('jewelry', '25801470');
    await vault.setPin('user.a', '258014');
    const onUnlock = jest.fn();
    await renderScreen(
      <SignInScreen
        system="jewelry"
        employees={[sara()]}
        deps={deps}
        onUnlock={onUnlock}
        onBack={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('person-سارة'));
    expect(await screen.findByTestId('login-person')).toHaveTextContent('سارة');
    // The owner's PIN does not open her account.
    await enter('258014');
    await waitFor(() =>
      expect(onUnlock).toHaveBeenCalledWith({ kind: 'employee', id: 'a', name: 'سارة' }),
    );
  });

  it('makes an employee with a temporary PIN choose their own at once', async () => {
    const { vault, deps, pinChanged } = setup([]);
    await vault.setPin('user.a', '147036');
    const onUnlock = jest.fn();
    const e = sara({ mustChangePin: true });
    await renderScreen(
      <SignInScreen
        system="scarves"
        employees={[e]}
        deps={deps}
        onUnlock={onUnlock}
        onBack={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('person-سارة'));
    await screen.findByTestId('login-person');
    await enter('147036');
    expect(await screen.findByText('سارة: اختر رمزك')).toBeOnTheScreen();
    expect(onUnlock).not.toHaveBeenCalled();
    await enter('963258');
    await enter('963258');
    await waitFor(() => expect(onUnlock).toHaveBeenCalled());
    expect(pinChanged).toHaveBeenCalledWith('a');
    expect(await vault.verify('user.a', '963258')).toEqual({ ok: true });
  });

  it("needs the owner's approval for someone transferred from the other device", async () => {
    const { vault, deps } = setup([]);
    await vault.setPin('jewelry', '25801470');
    const onUnlock = jest.fn();
    const e = sara({ mustChangePin: true });
    await renderScreen(
      <SignInScreen
        system="jewelry"
        employees={[e]}
        deps={deps}
        onUnlock={onUnlock}
        onBack={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('person-سارة'));
    expect(await screen.findByText(/موافقة المالك/)).toBeOnTheScreen();
    await enter('25801470');
    expect(await screen.findByText('سارة: اختر رمزك')).toBeOnTheScreen();
    await enter('963258');
    await enter('963258');
    await waitFor(() =>
      expect(onUnlock).toHaveBeenCalledWith({ kind: 'employee', id: 'a', name: 'سارة' }),
    );
  });

  it('lets the owner set a new PIN with the emergency code', async () => {
    const { vault, deps } = setup([]);
    await vault.setPin('jewelry', '25801470');
    const code = await vault.newEmergencyCode();
    const onUnlock = jest.fn();
    await renderScreen(
      <SignInScreen
        system="jewelry"
        employees={[]}
        deps={deps}
        onUnlock={onUnlock}
        onBack={jest.fn()}
      />,
    );
    await fireEvent.press(await screen.findByTestId('login-forgot'));
    await fireEvent.changeText(screen.getByTestId('emergency-code'), '0000-0000-0000');
    await fireEvent.press(screen.getByTestId('emergency-check'));
    expect(await screen.findByTestId('emergency-message')).toHaveTextContent(/غير صحيح/);
    await fireEvent.changeText(screen.getByTestId('emergency-code'), code);
    await fireEvent.press(screen.getByTestId('emergency-check'));
    expect(await screen.findByText('رمز جديد للمالك')).toBeOnTheScreen();
    await enter('36925814');
    await enter('36925814');
    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith({ kind: 'owner' }));
    expect(await vault.verify('jewelry', '36925814')).toEqual({ ok: true });
  });

  it('opens with the emergency password the owner chose, and sets a new PIN (K10)', async () => {
    const { vault, deps } = setup([]);
    await vault.setPin('jewelry', '25801470');
    await vault.setEmergencyPassword('Mona2026Salem');
    const onUnlock = jest.fn();
    await renderScreen(
      <SignInScreen
        system="jewelry"
        employees={[]}
        deps={deps}
        onUnlock={onUnlock}
        onBack={jest.fn()}
      />,
    );
    await fireEvent.press(await screen.findByTestId('login-forgot'));
    expect(await screen.findByTestId('emergency-message')).toHaveTextContent(/كلمة سر الطوارئ/);
    await fireEvent.changeText(screen.getByTestId('emergency-code'), 'Mona2026Salen');
    await fireEvent.press(screen.getByTestId('emergency-check'));
    expect(await screen.findByTestId('emergency-message')).toHaveTextContent(/غير صحيحة/);
    await fireEvent.changeText(screen.getByTestId('emergency-code'), 'mona2026salem');
    await fireEvent.press(screen.getByTestId('emergency-check'));
    expect(await screen.findByText('رمز جديد للمالك')).toBeOnTheScreen();
    await enter('36925814');
    await enter('36925814');
    await waitFor(() => expect(onUnlock).toHaveBeenCalledWith({ kind: 'owner' }));
  });

  it('shows «نسيت الرمز؟» clearly after 3 wrong PINs (point 1)', async () => {
    const { vault, deps } = setup([]);
    await vault.setPin('jewelry', '25801470');
    await vault.setEmergencyPassword('Mona2026Salem');
    await renderScreen(
      <SignInScreen
        system="jewelry"
        employees={[]}
        deps={deps}
        onUnlock={jest.fn()}
        onBack={jest.fn()}
      />,
    );
    await screen.findByTestId('login-forgot');
    expect(screen.queryByTestId('login-forgot-hint')).toBeNull();
    for (let i = 0; i < 3; i++) await enter('11223344');
    expect(await screen.findByTestId('login-forgot-hint')).toHaveTextContent(/كلمة سر الطوارئ/);
  });

  it('lets the owner reset a forgotten employee PIN at the counter, logged (points 3, 4)', async () => {
    const { vault, deps, pinChanged } = setup([]);
    await vault.setPin('jewelry', '25801470');
    await vault.setPin('user.a', '963258');
    const onUnlock = jest.fn();
    await renderScreen(
      <SignInScreen
        system="jewelry"
        employees={[sara()]}
        deps={deps}
        onUnlock={onUnlock}
        onBack={jest.fn()}
      />,
    );
    await fireEvent.press(screen.getByTestId('person-سارة'));
    // The employee's own way is always there; after 3 wrong PINs it says to ask the owner.
    for (let i = 0; i < 3; i++) await enter('111222');
    expect(await screen.findByTestId('login-forgot-hint')).toHaveTextContent(/المالك/);
    await fireEvent.press(screen.getByTestId('login-forgot'));
    expect(await screen.findByText(/موافقة المالك لإعادة رمز سارة/)).toBeOnTheScreen();
    // An employee can't approve it with their own PIN.
    await enter('96325811');
    expect(screen.queryByText('سارة: اختر رمزك')).toBeNull();
    await enter('25801470');
    expect(await screen.findByText('سارة: اختر رمزك')).toBeOnTheScreen();
    expect(deps.pinReset).toHaveBeenCalledWith({ kind: 'employee', id: 'a', name: 'سارة' });
    await enter('741852');
    await enter('741852');
    await waitFor(() =>
      expect(onUnlock).toHaveBeenCalledWith({ kind: 'employee', id: 'a', name: 'سارة' }),
    );
    expect(pinChanged).toHaveBeenCalledWith('a');
    expect(await vault.verify('user.a', '741852')).toEqual({ ok: true });
  });
});
