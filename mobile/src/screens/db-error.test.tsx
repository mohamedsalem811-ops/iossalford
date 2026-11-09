import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';

import { setAsideUnreadable } from '@/db/manager';
import { renderScreen } from '@/testing/render';

import { DbErrorScreen } from './db-error';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('@/db/manager', () => ({ setAsideUnreadable: jest.fn(async () => 'set-aside.db') }));

type AlertButton = { text?: string; onPress?: () => Promise<void> | void };

describe('DbErrorScreen', () => {
  afterEach(() => jest.restoreAllMocks());

  it('moves the unreadable file aside only after the owner confirms', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const onRetry = jest.fn();
    await renderScreen(
      <DbErrorScreen
        system="jewelry"
        result={{ status: 'unreadable', message: 'file is not a database' }}
        onRetry={onRetry}
        onBack={() => {}}
      />,
    );
    expect(screen.getByText('file is not a database')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'البدء بقاعدة جديدة' }));
    expect(setAsideUnreadable).not.toHaveBeenCalled();

    const buttons = alert.mock.calls[0][2] as AlertButton[];
    expect(buttons.map((b) => b.text)).toEqual(['إلغاء', 'نقل الملف والبدء من جديد']);
    await act(async () => {
      await buttons[1].onPress?.();
    });
    expect(setAsideUnreadable).toHaveBeenCalledWith('jewelry');
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('never offers a fresh start for data from a newer version', async () => {
    const onRetry = jest.fn();
    const onBack = jest.fn();
    await renderScreen(
      <DbErrorScreen
        system="scarves"
        result={{ status: 'too-new', message: 'version 9' }}
        onRetry={onRetry}
        onBack={onBack}
      />,
      'scarves',
    );
    expect(screen.getByText('هذه البيانات من إصدار أحدث')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'البدء بقاعدة جديدة' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'حاول مرة أخرى' }));
    await fireEvent.press(screen.getByRole('button', { name: 'رجوع' }));
    expect(onRetry).toHaveBeenCalled();
    expect(onBack).toHaveBeenCalled();
  });
});
