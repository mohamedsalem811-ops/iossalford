import { act, render, screen } from '@testing-library/react-native';
import { AppState, Linking, Text, type AppStateStatus } from 'react-native';

import { isShown, LockProvider, openOutside, OUTSIDE_GRACE_MS, shouldLock, useLock } from './lock';

describe('when the app hides or locks', () => {
  it('hides the screen when inactive or in the background', () => {
    expect(isShown('active')).toBe(true);
    expect(isShown('unknown')).toBe(true);
    expect(isShown(null)).toBe(true);
    expect(isShown('inactive')).toBe(false);
    expect(isShown('background')).toBe(false);
  });

  it('locks only in the background, not for the app switcher or Face ID', () => {
    expect(shouldLock('background')).toBe(true);
    expect(shouldLock('inactive')).toBe(false);
    expect(shouldLock('active')).toBe(false);
  });
});

describe('LockProvider', () => {
  let emit: (state: AppStateStatus) => void = () => {};
  beforeEach(() => {
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      emit = handler as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  let api: ReturnType<typeof useLock>;
  function Probe() {
    api = useLock();
    return (
      <Text testID="state">{`${api.unlocked ?? 'locked'} ${api.active ? 'shown' : 'hidden'}`}</Text>
    );
  }

  it('opens one system and locks it when the app goes to the background', async () => {
    await render(
      <LockProvider>
        <Probe />
      </LockProvider>,
    );
    await act(async () => api.unlock('jewelry'));
    expect(screen.getByTestId('state')).toHaveTextContent('jewelry shown');

    await act(async () => emit('inactive'));
    expect(screen.getByTestId('state')).toHaveTextContent('jewelry hidden');

    await act(async () => emit('background'));
    expect(screen.getByTestId('state')).toHaveTextContent('locked hidden');

    await act(async () => emit('active'));
    expect(screen.getByTestId('state')).toHaveTextContent('locked shown');
  });

  it('shows the screen at launch even if iOS still reports "inactive"', async () => {
    const appState = AppState as { currentState: unknown };
    const original = appState.currentState;
    appState.currentState = 'inactive';
    try {
      await render(
        <LockProvider>
          <Probe />
        </LockProvider>,
      );
      expect(screen.getByTestId('state')).toHaveTextContent('locked shown');
    } finally {
      appState.currentState = original;
    }
  });

  it('keeps its place when SALFORD itself opened WhatsApp and the person is back in a minute', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await render(
      <LockProvider>
        <Probe />
      </LockProvider>,
    );
    await act(async () => api.unlock('jewelry'));
    await act(async () => {
      await openOutside('https://wa.me/218912345678');
    });
    await act(async () => emit('background'));
    now += 50_000;
    await act(async () => emit('active'));
    expect(screen.getByTestId('state')).toHaveTextContent('jewelry shown');

    // Back after the grace: locked.
    await act(async () => {
      await openOutside('https://wa.me/218912345678');
    });
    await act(async () => emit('background'));
    now += OUTSIDE_GRACE_MS + 1;
    await act(async () => emit('active'));
    expect(screen.getByTestId('state')).toHaveTextContent('locked shown');

    // Leaving any other way still locks at once.
    await act(async () => api.unlock('jewelry'));
    await act(async () => emit('background'));
    expect(screen.getByTestId('state')).toHaveTextContent('locked hidden');
  });

  it('gives the grace only to leaving right after SALFORD opened WhatsApp, for 1 minute (audit 6)', async () => {
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    let now = 1_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => now);
    await render(
      <LockProvider>
        <Probe />
      </LockProvider>,
    );
    expect(OUTSIDE_GRACE_MS).toBe(60_000);
    await act(async () => api.unlock('jewelry'));
    await act(async () => {
      await openOutside('https://wa.me/218912345678');
    });
    // Still in SALFORD 30 s later, then leaving by the home button: locks at once.
    now += 30_000;
    await act(async () => emit('background'));
    expect(screen.getByTestId('state')).toHaveTextContent('locked hidden');

    // The grace is used once: back from WhatsApp, a later leaving locks.
    await act(async () => emit('active'));
    await act(async () => api.unlock('jewelry'));
    await act(async () => {
      await openOutside('https://wa.me/218912345678');
    });
    await act(async () => emit('background'));
    now += 10_000;
    await act(async () => emit('active'));
    expect(screen.getByTestId('state')).toHaveTextContent('jewelry shown');
    now += 5_000;
    await act(async () => emit('background'));
    expect(screen.getByTestId('state')).toHaveTextContent('locked hidden');
  });

  it('locks on request', async () => {
    await render(
      <LockProvider>
        <Probe />
      </LockProvider>,
    );
    await act(async () => api.unlock('scarves'));
    await act(async () => api.lock());
    expect(screen.getByTestId('state')).toHaveTextContent('locked', { exact: false });
  });
});
