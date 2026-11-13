/**
 * One save refreshes the open screens once, and a screen out of view waits until it comes back
 * (audit F-3).
 */
import { act, renderHook } from '@testing-library/react-native';
import { NavigationContext } from 'expo-router/build/react-navigation/core/NavigationContext';
import type { ReactNode } from 'react';

import { notifyDataChanged, scheduleDataChanged, useOnDataChanged } from './data-events';

const flush = () => act(async () => {});

it('refreshes once for a save the screen also announced', async () => {
  const onChange = jest.fn();
  await renderHook(() => useOnDataChanged(onChange));
  // The database's signal at commit, then the screen's own call: one refresh.
  scheduleDataChanged();
  notifyDataChanged();
  await flush();
  expect(onChange).toHaveBeenCalledTimes(1);
  // A save the screen forgot to announce still refreshes, once for several changes.
  scheduleDataChanged();
  scheduleDataChanged();
  await flush();
  expect(onChange).toHaveBeenCalledTimes(2);
  // A change after the screen's call refreshes again.
  scheduleDataChanged();
  notifyDataChanged();
  scheduleDataChanged();
  await flush();
  expect(onChange).toHaveBeenCalledTimes(4);
});

it('lets a screen out of view wait until it comes back', async () => {
  let focused = false;
  let onFocus: (() => void) | undefined;
  const navigation = {
    isFocused: () => focused,
    addListener: (_: string, cb: () => void) => {
      onFocus = cb;
      return () => (onFocus = undefined);
    },
  } as unknown as NonNullable<React.ContextType<typeof NavigationContext>>;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NavigationContext.Provider value={navigation}>{children}</NavigationContext.Provider>
  );
  const onChange = jest.fn();
  await renderHook(() => useOnDataChanged(onChange), { wrapper });
  notifyDataChanged();
  notifyDataChanged();
  expect(onChange).not.toHaveBeenCalled();
  focused = true;
  await act(() => onFocus?.());
  expect(onChange).toHaveBeenCalledTimes(1);
  // Nothing changed while away: coming back reads nothing more.
  await act(() => onFocus?.());
  expect(onChange).toHaveBeenCalledTimes(1);
  notifyDataChanged();
  expect(onChange).toHaveBeenCalledTimes(2);
});
