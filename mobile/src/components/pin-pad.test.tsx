import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import { ThemeProvider } from '@/theme';

import { PinPad } from './pin-pad';

jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  impactAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-symbols', () => ({ SymbolView: () => null }));

function Harness({
  onComplete,
  disabled,
}: {
  onComplete: (v: string) => void;
  disabled?: boolean;
}) {
  const [v, setV] = useState('');
  return (
    <ThemeProvider system="jewelry" appearance="light">
      <PinPad value={v} onChange={setV} onComplete={onComplete} disabled={disabled} />
    </ThemeProvider>
  );
}

async function press(key: string) {
  await fireEvent.press(screen.getByTestId(`pin-key-${key}`));
}

describe('PinPad', () => {
  it('collects 8 digits and reports the PIN once complete', async () => {
    const done = jest.fn();
    await render(<Harness onComplete={done} />);
    for (const d of '2580147') await press(d);
    expect(done).not.toHaveBeenCalled();
    expect(screen.getByLabelText('تم إدخال 7 من 8')).toBeOnTheScreen();
    await press('0');
    expect(done).toHaveBeenCalledWith('25801470');
    await press('9'); // ignored once full
    expect(screen.getByLabelText('تم إدخال 8 من 8')).toBeOnTheScreen();
  });

  it('deletes the last digit', async () => {
    const done = jest.fn();
    await render(<Harness onComplete={done} />);
    await press('1');
    await press('2');
    await press('del');
    expect(screen.getByLabelText('تم إدخال 1 من 8')).toBeOnTheScreen();
  });

  it('keeps both digits of two keys pressed before the screen redraws', async () => {
    // The parent hasn't re-rendered with the first digit yet when the second key comes in (a
    // busy moment on the device): the second key adds to it instead of replacing it.
    const change = jest.fn();
    await render(
      <ThemeProvider system="jewelry" appearance="light">
        <PinPad value="" onChange={change} />
      </ThemeProvider>,
    );
    await press('1');
    await press('2');
    expect(change.mock.calls.map((c) => c[0])).toEqual(['1', '12']);
  });

  it('ignores keys while disabled (locked out)', async () => {
    const done = jest.fn();
    await render(<Harness onComplete={done} disabled />);
    await press('1');
    expect(screen.getByLabelText('تم إدخال 0 من 8')).toBeOnTheScreen();
  });
});
