import * as SecureStore from 'expo-secure-store';
import { Appearance } from 'react-native';

import { applySavedAppearance, getAppearance, setAppearance } from './appearance';

jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>();
  return {
    getItem: jest.fn((k: string) => store.get(k) ?? null),
    setItem: jest.fn((k: string, v: string) => store.set(k, v)),
  };
});

describe('appearance', () => {
  it('follows the device until the owner picks light or dark, and keeps the choice', () => {
    const set = jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});
    expect(getAppearance()).toBe('system');
    setAppearance('dark');
    expect(set).toHaveBeenLastCalledWith('dark');
    expect(SecureStore.setItem).toHaveBeenCalledWith('appearance', 'dark');
    expect(getAppearance()).toBe('dark');
    applySavedAppearance();
    expect(set).toHaveBeenLastCalledWith('dark');
    setAppearance('system');
    expect(set).toHaveBeenLastCalledWith('unspecified');
  });
});
