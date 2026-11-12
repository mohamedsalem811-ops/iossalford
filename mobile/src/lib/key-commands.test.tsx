import { act, render } from '@testing-library/react-native';
import { Text } from 'react-native';

import { runShortcut, useShortcut } from './key-commands';

let mockFocused = true;
jest.mock('expo-router', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- jest.mock factories cannot use imports
  const { useEffect } = require('react');
  return {
    // Focus effects run like plain effects while the screen is "in front".
    useFocusEffect: (effect: () => void | (() => void)) =>
      useEffect(() => (mockFocused ? effect() : undefined), [effect]),
  };
});
jest.mock('../../modules/key-commands/src/KeyCommandsModule', () => null);

function Screen({ name, log }: { name: string; log: string[] }) {
  useShortcut('new', () => log.push(name));
  return <Text>{name}</Text>;
}

describe('keyboard shortcuts', () => {
  it('runs the shortcut of the screen in front, and nothing once it closes', async () => {
    const log: string[] = [];
    const app = await render(
      <>
        <Screen name="products" log={log} />
        <Screen name="customers" log={log} />
      </>,
    );
    await act(() => runShortcut('new'));
    expect(log).toEqual(['customers']);
    // The screen in front closes: the one behind gets the shortcut again.
    await app.rerender(<Screen name="products" log={log} />);
    await act(() => runShortcut('new'));
    expect(log).toEqual(['customers', 'products']);
    await app.unmount();
    await act(() => runShortcut('new'));
    expect(log).toHaveLength(2);
  });
});
