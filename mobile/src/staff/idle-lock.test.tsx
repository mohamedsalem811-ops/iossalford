import { act, fireEvent, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { renderScreen } from '@/testing/render';

import { IdleLock } from './idle-lock';
import { playLockWarning } from './warning-sound';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('./warning-sound', () => ({ playLockWarning: jest.fn() }));

const lock = { lockMinutes: 7, warnMinutes: 2 };
let t = 0;
const now = () => t;
const pass = async (minutes: number) => {
  for (let s = 0; s < minutes * 60; s++) {
    t += 1000;
    await act(() => jest.advanceTimersByTime(1000));
  }
};

beforeEach(() => {
  jest.useFakeTimers();
  t = 0;
  (playLockWarning as jest.Mock).mockClear();
});
afterEach(() => jest.useRealTimers());

describe('the automatic lock of an employee', () => {
  it('warns with the sound 2 minutes before, again at one minute, then locks at 7', async () => {
    const onLock = jest.fn();
    await renderScreen(
      <IdleLock enabled lock={lock} onLock={onLock} now={now}>
        <Text>البيع</Text>
      </IdleLock>,
    );
    await pass(4.9);
    expect(screen.queryByTestId('idle-warning')).toBeNull();
    await pass(0.2);
    expect(screen.getByTestId('idle-warning')).toHaveTextContent(/سيُقفل الحساب بعد 1:5\d/);
    expect(playLockWarning).toHaveBeenCalledTimes(1);
    await pass(1);
    expect(playLockWarning).toHaveBeenCalledTimes(2);
    expect(onLock).not.toHaveBeenCalled();
    await pass(1);
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('starts again from zero on any touch', async () => {
    const onLock = jest.fn();
    await renderScreen(
      <IdleLock enabled lock={lock} onLock={onLock} now={now}>
        <Text>البيع</Text>
      </IdleLock>,
    );
    await pass(6);
    expect(screen.getByTestId('idle-warning')).toBeOnTheScreen();
    await fireEvent(screen.getByText('البيع'), 'touchStart');
    expect(screen.queryByTestId('idle-warning')).toBeNull();
    await pass(6);
    expect(onLock).not.toHaveBeenCalled();
  });

  it('does nothing for the owner unless chosen', async () => {
    const onLock = jest.fn();
    await renderScreen(
      <IdleLock enabled={false} lock={lock} onLock={onLock} now={now}>
        <Text>البيع</Text>
      </IdleLock>,
    );
    await pass(8);
    expect(onLock).not.toHaveBeenCalled();
    expect(playLockWarning).not.toHaveBeenCalled();
  });
});
