import { fireEvent, screen } from '@testing-library/react-native';
import { Alert, type AlertButton } from 'react-native';

import { makeCtx, type TestCtx } from '@/domain/testing/ctx';
import { renderScreen } from '@/testing/render';

import { BackupScreen } from './backup-screen';

jest.mock('expo-symbols', () => ({ SymbolView: () => null }));
jest.mock('expo-haptics', () => ({
  selectionAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  NotificationFeedbackType: { Success: 'success' },
}));
jest.mock('@/backup/exclusion', () => ({
  canExcludeFromBackup: () => false,
  isAppDataExcluded: () => true,
}));
jest.mock('@/backup/store', () => ({
  confirmCopied: jest.fn(),
  deleteBackup: jest.fn(),
  discardPicked: jest.fn(),
  pickBackupFile: jest.fn(),
  readBackupFile: jest.fn(),
  restore: jest.fn(),
  saveBackup: jest.fn(),
  savedBackupUri: jest.fn(),
  shareCopy: jest.fn(() => Promise.resolve()),
}));

const store = jest.requireMock('@/backup/store') as Record<string, jest.Mock>;

/** The buttons of the last question asked. */
const lastButtons = (spy: jest.SpyInstance) => (spy.mock.calls.at(-1)?.[2] ?? []) as AlertButton[];

describe('copying a backup off the device', () => {
  let ctx: TestCtx;
  let alert: jest.SpyInstance;
  beforeEach(() => {
    ctx = makeCtx();
    alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.clearAllMocks();
  });
  afterEach(() => {
    alert.mockRestore();
    ctx.close();
  });

  const render = (lastCopied: Date | null) =>
    renderScreen(
      <BackupScreen
        ctx={ctx}
        backups={[]}
        lastCopied={lastCopied}
        firstBackup={new Date(2026, 9, 1)}
        onChanged={jest.fn()}
      />,
    );

  it('shows the reminder in red, then counts the copy only when the owner says it arrived', async () => {
    await render(null);
    expect(screen.getByTestId('backup-reminder')).toHaveTextContent(/لم تُنسخ أي نسخة/);

    await fireEvent.press(screen.getByTestId('backup-copy'));
    expect(store.shareCopy).toHaveBeenCalled();
    expect(alert).toHaveBeenLastCalledWith(
      'هل حُفظت النسخة خارج الجهاز؟',
      expect.any(String),
      expect.any(Array),
    );
    // "لا": the share sheet was cancelled, or the copy did not arrive. Nothing is recorded.
    lastButtons(alert)
      .find((b) => b.text === 'لا')
      ?.onPress?.();
    expect(store.confirmCopied).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('backup-copy'));
    lastButtons(alert)
      .find((b) => b.text === 'نعم، حُفظت')
      ?.onPress?.();
    expect(store.confirmCopied).toHaveBeenCalledWith(ctx);
  });

  it('does not ask when the copy could not be made', async () => {
    store.shareCopy.mockRejectedValueOnce(new Error('disk full'));
    await render(new Date());
    expect(screen.queryByTestId('backup-reminder')).toBeNull();
    await fireEvent.press(screen.getByTestId('backup-copy'));
    expect(alert).toHaveBeenCalledTimes(1);
    expect(alert.mock.calls[0][0]).toBe('لم تُنسخ النسخة');
  });
});
